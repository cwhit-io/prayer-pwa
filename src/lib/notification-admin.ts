import {
  applyMergeTags,
  getCatalogEntry,
  NOTIFICATION_CATALOG,
  type NotificationAudience,
  type NotificationFrequency
} from "@/lib/notification-catalog";
import { notifyUser, type NotificationChannel } from "@/lib/notifications";
import { query } from "@/lib/postgres";

const NOTIFICATION_SCHEMA_SQL = `
create table if not exists notification_definitions (
  key text primary key,
  label text not null,
  description text not null,
  category text not null,
  supports_email boolean not null default true,
  supports_sms boolean not null default true,
  default_frequency text not null default 'manual',
  default_audience text not null default 'members',
  is_system boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists notification_settings (
  notification_key text primary key references notification_definitions(key) on delete cascade,
  enabled boolean not null default false,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  frequency text not null default 'weekly',
  send_day_of_week integer null check (send_day_of_week is null or (send_day_of_week between 0 and 6)),
  send_hour_local integer not null default 9 check (send_hour_local between 0 and 23),
  audience text not null default 'members',
  updated_at timestamptz not null default now()
);

create table if not exists notification_templates (
  notification_key text primary key references notification_definitions(key) on delete cascade,
  email_subject text not null default '',
  email_text text not null default '',
  email_html text not null default '',
  sms_body text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists notification_send_log (
  id uuid primary key default gen_random_uuid(),
  notification_key text not null,
  channel text not null,
  recipient text not null,
  subject text null,
  status text not null,
  error_message text null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_send_log_created
  on notification_send_log (created_at desc);

create index if not exists idx_notification_send_log_key
  on notification_send_log (notification_key, created_at desc);
`;

let schemaReady: Promise<void> | null = null;

export async function ensureNotificationSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await query(NOTIFICATION_SCHEMA_SQL);
      await seedNotificationCatalog();
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

async function seedNotificationCatalog() {
  for (const item of NOTIFICATION_CATALOG) {
    await query(
      `insert into notification_definitions (
         key, label, description, category, supports_email, supports_sms,
         default_frequency, default_audience, is_system, sort_order
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (key) do update set
         label = excluded.label,
         description = excluded.description,
         category = excluded.category,
         supports_email = excluded.supports_email,
         supports_sms = excluded.supports_sms,
         default_frequency = excluded.default_frequency,
         default_audience = excluded.default_audience,
         is_system = excluded.is_system,
         sort_order = excluded.sort_order`,
      [
        item.key,
        item.label,
        item.description,
        item.category,
        item.supportsEmail,
        item.supportsSms,
        item.defaultFrequency,
        item.defaultAudience,
        item.isSystem,
        item.sortOrder
      ]
    );

    await query(
      `insert into notification_settings (
         notification_key, enabled, email_enabled, sms_enabled, frequency,
         send_day_of_week, send_hour_local, audience
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (notification_key) do nothing`,
      [
        item.key,
        item.defaultEnabled,
        item.defaultEmailEnabled,
        item.defaultSmsEnabled,
        item.defaultFrequency,
        item.defaultFrequency === "weekly" || item.defaultFrequency === "biweekly" ? 1 : null,
        9,
        item.defaultAudience
      ]
    );

    await query(
      `insert into notification_templates (
         notification_key, email_subject, email_text, email_html, sms_body
       )
       values ($1,$2,$3,$4,$5)
       on conflict (notification_key) do nothing`,
      [
        item.key,
        item.defaultSubject,
        item.defaultEmailText,
        item.defaultEmailHtml,
        item.defaultSmsBody
      ]
    );
  }
}

export type ManagedNotification = {
  key: string;
  label: string;
  description: string;
  category: string;
  supportsEmail: boolean;
  supportsSms: boolean;
  isSystem: boolean;
  sortOrder: number;
  enabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  frequency: NotificationFrequency;
  sendDayOfWeek: number | null;
  sendHourLocal: number;
  audience: NotificationAudience;
  emailSubject: string;
  emailText: string;
  emailHtml: string;
  smsBody: string;
  mergeTags: string[];
  settingsUpdatedAt: string | null;
  templateUpdatedAt: string | null;
};

type JoinedRow = {
  key: string;
  label: string;
  description: string;
  category: string;
  supports_email: boolean;
  supports_sms: boolean;
  is_system: boolean;
  sort_order: number;
  enabled: boolean;
  email_enabled: boolean;
  sms_enabled: boolean;
  frequency: string;
  send_day_of_week: number | null;
  send_hour_local: number;
  audience: string;
  email_subject: string;
  email_text: string;
  email_html: string;
  sms_body: string;
  settings_updated_at: string | Date | null;
  template_updated_at: string | Date | null;
};

function mapJoined(row: JoinedRow): ManagedNotification {
  const catalog = getCatalogEntry(row.key);
  return {
    key: row.key,
    label: row.label,
    description: row.description,
    category: row.category,
    supportsEmail: row.supports_email,
    supportsSms: row.supports_sms,
    isSystem: row.is_system,
    sortOrder: row.sort_order,
    enabled: row.enabled,
    emailEnabled: row.email_enabled,
    smsEnabled: row.sms_enabled,
    frequency: row.frequency as NotificationFrequency,
    sendDayOfWeek: row.send_day_of_week,
    sendHourLocal: row.send_hour_local,
    audience: row.audience as NotificationAudience,
    emailSubject: row.email_subject,
    emailText: row.email_text,
    emailHtml: row.email_html,
    smsBody: row.sms_body,
    mergeTags: catalog?.mergeTags ?? [],
    settingsUpdatedAt:
      row.settings_updated_at instanceof Date
        ? row.settings_updated_at.toISOString()
        : row.settings_updated_at,
    templateUpdatedAt:
      row.template_updated_at instanceof Date
        ? row.template_updated_at.toISOString()
        : row.template_updated_at
  };
}

const JOIN_SQL = `
  select
    d.key,
    d.label,
    d.description,
    d.category,
    d.supports_email,
    d.supports_sms,
    d.is_system,
    d.sort_order,
    s.enabled,
    s.email_enabled,
    s.sms_enabled,
    s.frequency,
    s.send_day_of_week,
    s.send_hour_local,
    s.audience,
    t.email_subject,
    t.email_text,
    t.email_html,
    t.sms_body,
    s.updated_at as settings_updated_at,
    t.updated_at as template_updated_at
  from notification_definitions d
  join notification_settings s on s.notification_key = d.key
  join notification_templates t on t.notification_key = d.key
`;

export async function listManagedNotifications() {
  await ensureNotificationSchema();
  const result = await query<JoinedRow>(`${JOIN_SQL} order by d.sort_order, d.key`);
  return result.rows.map(mapJoined);
}

export async function getManagedNotification(key: string) {
  await ensureNotificationSchema();
  const result = await query<JoinedRow>(`${JOIN_SQL} where d.key = $1 limit 1`, [key]);
  return result.rows[0] ? mapJoined(result.rows[0]) : null;
}

export async function updateNotificationSettings(input: {
  key: string;
  enabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  frequency: NotificationFrequency;
  sendDayOfWeek: number | null;
  sendHourLocal: number;
  audience: NotificationAudience;
}) {
  await ensureNotificationSchema();
  const existing = await getManagedNotification(input.key);
  if (!existing) {
    throw new Error("Unknown notification type.");
  }

  // System notifications (login) stay enabled so auth keeps working.
  const enabled = existing.isSystem ? true : input.enabled;

  await query(
    `update notification_settings
     set enabled = $2,
         email_enabled = $3,
         sms_enabled = $4,
         frequency = $5,
         send_day_of_week = $6,
         send_hour_local = $7,
         audience = $8,
         updated_at = now()
     where notification_key = $1`,
    [
      input.key,
      enabled,
      input.emailEnabled,
      input.smsEnabled,
      input.frequency,
      input.sendDayOfWeek,
      input.sendHourLocal,
      input.audience
    ]
  );
}

export async function updateNotificationTemplate(input: {
  key: string;
  emailSubject: string;
  emailText: string;
  emailHtml: string;
  smsBody: string;
}) {
  await ensureNotificationSchema();
  const existing = await getManagedNotification(input.key);
  if (!existing) {
    throw new Error("Unknown notification type.");
  }

  await query(
    `update notification_templates
     set email_subject = $2,
         email_text = $3,
         email_html = $4,
         sms_body = $5,
         updated_at = now()
     where notification_key = $1`,
    [input.key, input.emailSubject, input.emailText, input.emailHtml, input.smsBody]
  );
}

export async function resetNotificationTemplate(key: string) {
  const catalog = getCatalogEntry(key);
  if (!catalog) {
    throw new Error("Unknown notification type.");
  }
  await updateNotificationTemplate({
    key,
    emailSubject: catalog.defaultSubject,
    emailText: catalog.defaultEmailText,
    emailHtml: catalog.defaultEmailHtml,
    smsBody: catalog.defaultSmsBody
  });
}

export type SendLogRow = {
  id: string;
  notificationKey: string;
  channel: string;
  recipient: string;
  subject: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
};

export async function listNotificationSendLog(limit = 50) {
  await ensureNotificationSchema();
  const result = await query<{
    id: string;
    notification_key: string;
    channel: string;
    recipient: string;
    subject: string | null;
    status: string;
    error_message: string | null;
    created_at: string | Date;
  }>(
    `select id, notification_key, channel, recipient, subject, status, error_message, created_at
     from notification_send_log
     order by created_at desc
     limit $1`,
    [limit]
  );

  return result.rows.map(
    (row): SendLogRow => ({
      id: row.id,
      notificationKey: row.notification_key,
      channel: row.channel,
      recipient: row.recipient,
      subject: row.subject,
      status: row.status,
      errorMessage: row.error_message,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
    })
  );
}

async function logSend(input: {
  notificationKey: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string | null;
  status: "sent" | "failed" | "skipped";
  errorMessage?: string | null;
  meta?: Record<string, unknown>;
}) {
  await query(
    `insert into notification_send_log (
       notification_key, channel, recipient, subject, status, error_message, meta
     )
     values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [
      input.notificationKey,
      input.channel,
      input.recipient,
      input.subject ?? null,
      input.status,
      input.errorMessage ?? null,
      JSON.stringify(input.meta ?? {})
    ]
  );
}

/** Multi-channel send with correct per-channel bodies + logging. */
export async function dispatchManagedNotification(input: {
  key: string;
  email?: string | null;
  phone?: string | null;
  vars?: Record<string, string | number | null | undefined>;
  force?: boolean;
}) {
  await ensureNotificationSchema();
  const managed = await getManagedNotification(input.key);
  if (!managed) {
    throw new Error(`Unknown notification: ${input.key}`);
  }

  if (!managed.enabled && !managed.isSystem && !input.force) {
    return { skipped: true as const, reason: "disabled" as const, results: [] as Array<{ channel: NotificationChannel; ok: boolean; error?: string }> };
  }

  const vars = {
    app_url: process.env.NEXT_PUBLIC_APP_URL || "https://FortWaynePrays.org",
    minutes: 10,
    ...input.vars
  };

  const subject = applyMergeTags(managed.emailSubject, vars);
  const text = applyMergeTags(managed.emailText, vars);
  const html = applyMergeTags(managed.emailHtml, vars);
  const sms = applyMergeTags(managed.smsBody || managed.emailText, vars);

  const results: Array<{ channel: NotificationChannel; ok: boolean; error?: string }> = [];

  if (managed.supportsEmail && managed.emailEnabled && input.email) {
    const batch = await notifyUser({
      email: input.email,
      subject,
      message: text,
      html: html || undefined,
      channels: ["email"]
    });
    for (const result of batch) {
      results.push(result);
      await logSend({
        notificationKey: input.key,
        channel: "email",
        recipient: input.email,
        subject,
        status: result.ok ? "sent" : "failed",
        errorMessage: result.error ?? null,
        meta: { force: Boolean(input.force) }
      });
    }
  }

  if (managed.supportsSms && managed.smsEnabled && input.phone && sms.trim()) {
    const batch = await notifyUser({
      phone: input.phone,
      message: sms,
      channels: ["sms"]
    });
    for (const result of batch) {
      results.push(result);
      await logSend({
        notificationKey: input.key,
        channel: "sms",
        recipient: input.phone,
        subject: null,
        status: result.ok ? "sent" : "failed",
        errorMessage: result.error ?? null,
        meta: { force: Boolean(input.force) }
      });
    }
  }

  if (results.length === 0) {
    return { skipped: true as const, reason: "no_channels" as const, results };
  }

  return { skipped: false as const, results, subject };
}

export async function getNotificationAdminSummary() {
  await ensureNotificationSchema();
  const [types, logs] = await Promise.all([listManagedNotifications(), listNotificationSendLog(8)]);
  return {
    total: types.length,
    enabled: types.filter((t) => t.enabled).length,
    emailTypes: types.filter((t) => t.emailEnabled && t.enabled).length,
    smsTypes: types.filter((t) => t.smsEnabled && t.enabled).length,
    recentLogs: logs
  };
}
