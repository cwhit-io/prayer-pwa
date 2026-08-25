import { getCampaignProgressSnapshot } from "@/lib/campaign";
import {
  dispatchManagedNotification,
  listManagedNotifications,
  type ManagedNotification
} from "@/lib/notification-admin";
import type { NotificationAudience } from "@/lib/notification-catalog";
import { ensureNotificationPreferencesSchema } from "@/lib/notification-preferences";
import { query, withDatabaseClient } from "@/lib/postgres";
import { getLatestPledge } from "@/lib/pledges";
import { createPledgeInvitationUnsubscribeToken } from "@/lib/notification-unsubscribe";

const LOCAL_TIME_ZONE = "America/Indiana/Indianapolis";
const NO_PLEDGE_GAPS_DAYS = [1, 3, 7, 14, 30];
const WORKER_RATE_PER_SECOND = 5;
const WORKER_LIMIT = 2_000;
const WORKER_DEADLINE_MS = 10 * 60 * 1_000;
const SCHEDULED_KEYS = new Set([
  "no_pledge_reminder",
  "pledge_reminder",
  "weekly_digest",
  "leader_follow_up"
]);

const SCHEDULER_SCHEMA_SQL = `
alter table app_users add column if not exists first_seen_at timestamptz null;
alter table app_users add column if not exists last_seen_at timestamptz null;

create table if not exists notification_delivery_queue (
  id uuid primary key default gen_random_uuid(),
  notification_key text not null references notification_definitions(key) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  recipient_email text not null,
  slot_key text not null,
  template_vars jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  provider_message_id text null,
  error_message text null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz null,
  sent_at timestamptz null,
  unique (notification_key, user_id, slot_key)
);

create index if not exists idx_notification_delivery_queue_ready
  on notification_delivery_queue (next_attempt_at, created_at)
  where status = 'queued';
`;

let schedulerSchemaReady: Promise<void> | null = null;

async function ensureSchedulerSchema() {
  if (!schedulerSchemaReady) {
    schedulerSchemaReady = query(SCHEDULER_SCHEMA_SQL)
      .then(() => undefined)
      .catch((error) => {
        schedulerSchemaReady = null;
        throw error;
      });
  }
  await schedulerSchemaReady;
}

type Recipient = {
  id: string;
  name: string;
  email: string;
  firstSeenAt: Date | null;
};

type LocalParts = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
};

function getLocalParts(now: Date): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LOCAL_TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric"
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };
  return {
    year: Number(part("year")),
    month: Number(part("month")),
    day: Number(part("day")),
    weekday: weekdays[part("weekday")] ?? 0,
    hour: Number(part("hour")) % 24
  };
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function sendWindow(notification: ManagedNotification, now: Date) {
  const local = getLocalParts(now);
  const calendar = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const hoursSinceSend =
    local.hour >= notification.sendHourLocal
      ? local.hour - notification.sendHourLocal
      : 24 - notification.sendHourLocal + local.hour;
  if (hoursSinceSend > 6) return null;
  if (local.hour < notification.sendHourLocal) calendar.setUTCDate(calendar.getUTCDate() - 1);
  return {
    calendar,
    weekday: (local.weekday - (local.hour < notification.sendHourLocal ? 1 : 0) + 7) % 7
  };
}

function scheduledSlot(notification: ManagedNotification, now: Date) {
  const window = sendWindow(notification, now);
  if (!window) return null;
  const { calendar, weekday } = window;

  if (notification.frequency === "daily") {
    return `daily:${dateKey(calendar)}`;
  }
  if (notification.frequency === "weekly" || notification.frequency === "biweekly") {
    const sendDay = notification.sendDayOfWeek ?? 1;
    if (weekday !== sendDay) return null;
    return `${notification.frequency}:${dateKey(calendar)}`;
  }
  if (notification.frequency === "monthly") {
    if (calendar.getUTCDate() === 1) {
      return `monthly:${calendar.getUTCFullYear()}-${String(calendar.getUTCMonth() + 1).padStart(2, "0")}`;
    }
    return null;
  }
  return null;
}

function rolesForAudience(audience: NotificationAudience) {
  if (audience === "members") return ["member"];
  if (audience === "admins") return ["admin", "superadmin"];
  if (audience === "prayer_team") return ["admin", "prayer_team", "superadmin"];
  if (audience === "all_users") return ["member", "admin", "prayer_team", "superadmin"];
  return [];
}

function preferenceColumn(key: string) {
  if (key === "no_pledge_reminder") return "email_pledge_invitations";
  if (key === "pledge_reminder" || key === "weekly_digest") return "email_progress_updates";
  return null;
}

async function listRecipients(notification: ManagedNotification) {
  const roles = rolesForAudience(notification.audience);
  if (roles.length === 0) return [];
  const preference = preferenceColumn(notification.key);

  const result = await query<{
    id: string;
    name: string;
    email: string;
    first_seen_at: Date | string | null;
  }>(
    `with unique_verified_emails as (
       select lower(value_normalized) as email, min(user_id::text)::uuid as user_id
       from user_contact_methods
       where type = 'email' and verified_at is not null
       group by lower(value_normalized)
       having count(distinct user_id) = 1
     )
     select u.id, u.name, email.email, u.first_seen_at
     from app_users u
     join unique_verified_emails email on email.user_id = u.id
     left join user_notification_preferences prefs on prefs.user_id = u.id
     where u.role = any($1::text[])
       and u.first_seen_at is not null
       and case $2::text
         when 'email_pledge_invitations' then coalesce(prefs.email_pledge_invitations, false)
         when 'email_progress_updates' then coalesce(prefs.email_progress_updates, false)
         else true
       end`,
    [roles, preference]
  );

  return result.rows.map(
    (row): Recipient => ({
      id: row.id,
      name: row.name,
      email: row.email,
      firstSeenAt:
        row.first_seen_at instanceof Date
          ? row.first_seen_at
          : row.first_seen_at
            ? new Date(row.first_seen_at)
            : null
    })
  );
}

function daysBetween(earlier: Date, later: Date) {
  return (later.getTime() - earlier.getTime()) / 86_400_000;
}

function campaignIsActive(
  settings: { startDate: string | null; endDate: string | null },
  now: Date
) {
  if (!settings.startDate || !settings.endDate) return false;
  const local = getLocalParts(now);
  const today = dateKey(new Date(Date.UTC(local.year, local.month - 1, local.day)));
  return today >= settings.startDate && today <= settings.endDate;
}

async function queueDelivery(input: {
  key: string;
  userId: string;
  email: string;
  slotKey: string;
  vars: Record<string, string | number>;
  dryRun: boolean;
}) {
  if (input.dryRun) return true;
  const result = await query<{ id: string }>(
    `insert into notification_delivery_queue (
       notification_key, user_id, recipient_email, slot_key, template_vars
     ) values ($1, $2, $3, $4, $5::jsonb)
     on conflict (notification_key, user_id, slot_key) do nothing
     returning id`,
    [input.key, input.userId, input.email, input.slotKey, JSON.stringify(input.vars)]
  );
  return Boolean(result.rows[0]);
}

async function noPledgeState(userId: string, campaignKey: string) {
  const [pledge, history] = await Promise.all([
    query<{ exists: boolean }>(
      `select exists(
         select 1 from pledges p
         join campaigns c on c.id = p.campaign_id
         where p.user_id = $1 and c.is_current and p.withdrawn_at is null
       ) as exists`,
      [userId]
    ),
    query<{ sent_count: string; last_sent_at: Date | string | null }>(
      `select count(*)::text as sent_count, max(sent_at) as last_sent_at
       from notification_delivery_queue
       where notification_key = 'no_pledge_reminder'
         and user_id = $1
         and slot_key like $2
         and status = 'sent'`,
      [userId, `${campaignKey}:%`]
    )
  ]);
  const row = history.rows[0];
  return {
    hasPledge: Boolean(pledge.rows[0]?.exists),
    sentCount: Number(row?.sent_count ?? 0),
    lastSentAt:
      row?.last_sent_at instanceof Date
        ? row.last_sent_at
        : row?.last_sent_at
          ? new Date(row.last_sent_at)
          : null
  };
}

async function pledgeProgress(userId: string, now: Date) {
  void now;
  const pledge = await getLatestPledge(userId);
  if (!pledge) return null;
  return {
    pledged: pledge.committedMinutes,
    prayed: pledge.campaignPrayedMinutes,
    behind: pledge.campaignPrayedMinutes < pledge.expectedMinutes
  };
}

async function cadenceAllows(notification: ManagedNotification, userId: string, now: Date) {
  if (notification.frequency !== "biweekly") return true;
  const result = await query<{ created_at: Date | string }>(
    `select created_at from notification_delivery_queue
     where notification_key = $1 and user_id = $2 and status <> 'cancelled'
     order by created_at desc limit 1`,
    [notification.key, userId]
  );
  const value = result.rows[0]?.created_at;
  if (!value) return true;
  const date = value instanceof Date ? value : new Date(value);
  return daysBetween(date, now) >= 13;
}

export async function generateScheduledDeliveries(input: { dryRun?: boolean; now?: Date } = {}) {
  await Promise.all([ensureSchedulerSchema(), ensureNotificationPreferencesSchema()]);
  const now = input.now ?? new Date();
  const campaign = await getCampaignProgressSnapshot();
  const campaignActive = campaignIsActive(campaign.settings, now);
  const campaignKey = campaign.settings.startDate || "campaign";
  const campaignStart = campaign.settings.startDate
    ? new Date(campaign.settings.startDate)
    : null;
  const notifications = await listManagedNotifications();
  const results: Array<{ key: string; candidates: number; queued: number; reason?: string }> = [];

  for (const notification of notifications) {
    if (!SCHEDULED_KEYS.has(notification.key)) continue;
    if (!notification.enabled || !notification.emailEnabled) {
      results.push({ key: notification.key, candidates: 0, queued: 0, reason: "disabled" });
      continue;
    }
    if (notification.key !== "leader_follow_up" && !campaignActive) {
      results.push({ key: notification.key, candidates: 0, queued: 0, reason: "campaign_inactive" });
      continue;
    }

    const recipients = await listRecipients(notification);
    let candidates = 0;
    let queued = 0;

    if (notification.key === "no_pledge_reminder") {
      if (!sendWindow(notification, now)) {
        results.push({ key: notification.key, candidates: 0, queued: 0, reason: "not_scheduled" });
        continue;
      }
      for (const recipient of recipients) {
        if (!recipient.firstSeenAt) continue;
        const state = await noPledgeState(recipient.id, campaignKey);
        if (state.hasPledge || state.sentCount >= NO_PLEDGE_GAPS_DAYS.length) continue;
        const enrollment =
          campaignStart && campaignStart > recipient.firstSeenAt
            ? campaignStart
            : recipient.firstSeenAt;
        const reference = state.lastSentAt ?? enrollment;
        if (daysBetween(reference, now) < NO_PLEDGE_GAPS_DAYS[state.sentCount]) continue;
        const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://fortwayneprays.org").replace(/\/$/, "");
        const unsubscribeToken = createPledgeInvitationUnsubscribeToken(recipient.id);
        candidates++;
        if (
          await queueDelivery({
            key: notification.key,
            userId: recipient.id,
            email: recipient.email,
            slotKey: `${campaignKey}:cadence-${state.sentCount + 1}`,
            vars: {
              name: recipient.name || "Friend",
              app_url: `${siteUrl}/pledge`,
              settings_url: `${siteUrl}/auth?next=${encodeURIComponent("/auth#settings")}#settings`,
              unsubscribe_url: `${siteUrl}/notifications/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`
            },
            dryRun: Boolean(input.dryRun)
          })
        ) queued++;
      }
    } else {
      const slot = scheduledSlot(notification, now);
      if (!slot) {
        results.push({ key: notification.key, candidates: 0, queued: 0, reason: "not_scheduled" });
        continue;
      }
      const openCount =
        notification.key === "leader_follow_up"
          ? Number(
              (
                await query<{ count: string }>(
                  `select count(*)::text as count from prayer_requests
                   where status in ('open', 'praying') and routing_queue in ('pastor', 'prayer_team')`
                )
              ).rows[0]?.count ?? 0
            )
          : 0;

      for (const recipient of recipients) {
        if (!(await cadenceAllows(notification, recipient.id, now))) continue;
        const vars: Record<string, string | number> = {
          name: recipient.name || "Friend",
          app_url: process.env.NEXT_PUBLIC_APP_URL || "https://fortwayneprays.org"
        };
        if (notification.key === "pledge_reminder") {
          const progress = await pledgeProgress(recipient.id, now);
          if (!progress?.behind) continue;
          vars.pledged_minutes = progress.pledged.toLocaleString("en-US");
          vars.prayed_minutes = progress.prayed.toLocaleString("en-US");
          vars.app_url = `${String(vars.app_url).replace(/\/$/, "")}/log`;
        } else if (notification.key === "weekly_digest") {
          vars.church_minutes = campaign.stats.totalMinutes.toLocaleString("en-US");
          vars.goal_minutes = campaign.settings.goalMinutes.toLocaleString("en-US");
        } else if (notification.key === "leader_follow_up") {
          if (openCount === 0) continue;
          vars.open_count = openCount;
          vars.app_url = `${String(vars.app_url).replace(/\/$/, "")}/admin/requests`;
        }
        candidates++;
        if (
          await queueDelivery({
            key: notification.key,
            userId: recipient.id,
            email: recipient.email,
            slotKey: slot,
            vars,
            dryRun: Boolean(input.dryRun)
          })
        ) queued++;
      }
    }
    results.push({ key: notification.key, candidates, queued });
  }

  return { dryRun: Boolean(input.dryRun), ranAt: now.toISOString(), results };
}

async function claimDelivery() {
  const result = await query<{
    id: string;
    notification_key: string;
    user_id: string;
    recipient_email: string;
    template_vars: Record<string, string | number>;
    attempts: number;
  }>(
    `with next as (
       select id from notification_delivery_queue
       where status = 'queued' and next_attempt_at <= now()
       order by next_attempt_at, created_at
       for update skip locked limit 1
     )
     update notification_delivery_queue queue
     set status = 'processing', claimed_at = now(), attempts = attempts + 1
     from next where queue.id = next.id
     returning queue.id, queue.notification_key, queue.user_id, queue.recipient_email,
       queue.template_vars, queue.attempts`
  );
  return result.rows[0] ?? null;
}

async function deliveryIsStillEligible(delivery: {
  notification_key: string;
  user_id: string;
  recipient_email: string;
}, campaignActive: boolean) {
  const result = await query<{ eligible: boolean }>(
    `select (
       exists (
         select 1
         from user_contact_methods own
         where own.user_id = $2
           and own.type = 'email'
           and own.verified_at is not null
           and lower(own.value_normalized) = lower($3)
       )
       and 1 = (
         select count(distinct shared.user_id)
         from user_contact_methods shared
         where shared.type = 'email'
           and shared.verified_at is not null
           and lower(shared.value_normalized) = lower($3)
       )
       and case
         when $1 = 'no_pledge_reminder' then
           $4::boolean
           and coalesce((select email_pledge_invitations from user_notification_preferences where user_id = $2), false)
           and not exists(select 1 from pledges where user_id = $2)
         when $1 in ('pledge_reminder', 'weekly_digest') then
           $4::boolean
           and coalesce((select email_progress_updates from user_notification_preferences where user_id = $2), false)
         when $1 = 'leader_follow_up' then
            exists(select 1 from app_users where id = $2 and role = 'superadmin')
           and exists(
             select 1 from prayer_requests
             where status in ('open', 'praying')
               and routing_queue in ('pastor', 'prayer_team')
           )
         else false
       end
       and exists (
         select 1
         from app_users user_account
         join notification_settings setting on setting.notification_key = $1
         where user_account.id = $2
           and user_account.first_seen_at is not null
           and case setting.audience
             when 'members' then user_account.role = 'member'
              when 'admins' then user_account.role in ('admin', 'superadmin')
              when 'prayer_team' then user_account.role in ('admin', 'prayer_team', 'superadmin')
              when 'all_users' then user_account.role in ('member', 'admin', 'prayer_team', 'superadmin')
             else false
           end
       )
     ) as eligible`,
    [delivery.notification_key, delivery.user_id, delivery.recipient_email, campaignActive]
  );
  if (!result.rows[0]?.eligible) return false;
  if (delivery.notification_key === "pledge_reminder") {
    return Boolean((await pledgeProgress(delivery.user_id, new Date()))?.behind);
  }
  return true;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function processScheduledDeliveries() {
  await ensureSchedulerSchema();
  return withDatabaseClient(async (lockClient) => {
    const lock = await lockClient.query<{ acquired: boolean }>(
      `select pg_try_advisory_lock(748291037) as acquired`
    );
    if (!lock.rows[0]?.acquired) {
      return { sent: 0, failed: 0, cancelled: 0, ratePerSecond: WORKER_RATE_PER_SECOND, busy: true };
    }

    try {
      // A terminated worker may have reached the provider; quarantine stale claims instead of risking duplicates.
      await query(
        `update notification_delivery_queue
         set status = 'failed', error_message = 'Stale processing claim; delivery status is ambiguous'
         where status = 'processing' and claimed_at < now() - interval '20 minutes'`
      );
      const campaign = await getCampaignProgressSnapshot();
      const startedAt = Date.now();
      let sent = 0;
      let failed = 0;
      let cancelled = 0;

      for (let processed = 0; processed < WORKER_LIMIT; processed++) {
        if (Date.now() - startedAt >= WORKER_DEADLINE_MS) break;
        const delivery = await claimDelivery();
        if (!delivery) break;
        if (!(await deliveryIsStillEligible(delivery, campaignIsActive(campaign.settings, new Date())))) {
          await query(
            `update notification_delivery_queue
             set status = 'cancelled', error_message = 'Recipient is no longer eligible'
             where id = $1`,
            [delivery.id]
          );
          cancelled++;
          continue;
        }
        let result;
        try {
          result = await dispatchManagedNotification({
            key: delivery.notification_key,
            email: delivery.recipient_email,
            vars: delivery.template_vars,
            meta: { scheduled: true, userId: delivery.user_id, queueId: delivery.id }
          });
        } catch (error) {
          // Delivery state is ambiguous after an unexpected exception; never auto-resend it.
          await query(
            `update notification_delivery_queue set status = 'failed', error_message = $2 where id = $1`,
            [delivery.id, error instanceof Error ? error.message : "Unexpected delivery failure"]
          );
          failed++;
          continue;
        }
        const delivered = !result.skipped && result.results.some((item) => item.ok);
        const failure = result.results.find((item) => !item.ok);
        const error = failure?.error ?? null;

        if (delivered) {
          await query(
            `update notification_delivery_queue set status = 'sent', sent_at = now(), error_message = null where id = $1`,
            [delivery.id]
          );
          sent++;
        } else if (result.skipped) {
          await query(
            `update notification_delivery_queue set status = 'cancelled', error_message = $2 where id = $1`,
            [delivery.id, result.reason]
          );
          cancelled++;
        } else if (failure?.retryable && !failure.ambiguous && delivery.attempts < 3) {
          const retryMinutes = delivery.attempts === 1 ? 5 : 30;
          await query(
            `update notification_delivery_queue
             set status = 'queued', next_attempt_at = now() + ($2 * interval '1 minute'), error_message = $3
             where id = $1`,
            [delivery.id, retryMinutes, error]
          );
          failed++;
        } else {
          await query(
            `update notification_delivery_queue set status = 'failed', error_message = $2 where id = $1`,
            [delivery.id, failure?.ambiguous ? `Ambiguous provider result: ${error}` : error]
          );
          failed++;
        }
        await wait(1_000 / WORKER_RATE_PER_SECOND);
      }

      return { sent, failed, cancelled, ratePerSecond: WORKER_RATE_PER_SECOND, busy: false };
    } finally {
      await lockClient.query(`select pg_advisory_unlock(748291037)`);
    }
  });
}

export async function runNotificationScheduler(input: { dryRun?: boolean; now?: Date } = {}) {
  const generation = await generateScheduledDeliveries(input);
  const delivery = input.dryRun ? null : await processScheduledDeliveries();
  return { generation, delivery, timeZone: LOCAL_TIME_ZONE };
}
