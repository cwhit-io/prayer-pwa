import { query } from "@/lib/postgres";

export type DashboardSnapshot = {
  totalMinutes: number;
  pledgedMinutes: number;
  thisWeekMinutes: number;
  recentSessions: Array<{
    id: string;
    minutes: number;
    startedAt: string;
    notes: string | null;
    promptTitle: string | null;
    promptCategory: string | null;
  }>;
  pledge: {
    minutesPerWeek: number | null;
    totalPledgedMinutes: number;
    prayerFocus: string | null;
    isPublic: boolean;
  } | null;
};

export type PublicCampaignStats = {
  totalMinutes: number;
  activeParticipants: number;
  pledgedMinutes: number;
  totalPledges: number;
  minutesThisWeek: number;
};

export type PublicActivityItem = {
  id: string;
  kind: "session" | "request" | "prompt";
  title: string;
  detail: string | null;
  metric: string | null;
  href: string;
  occurredAt: string;
};

type PublicActivityRow = {
  id: string;
  kind: "session" | "request" | "prompt";
  title: string;
  detail: string | null;
  metric: string | null;
  href: string;
  occurred_at: string | Date;
};

function formatTimestamp(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

export async function getPublicCampaignStats() {
  const [minutesResult, participantsResult, pledgeResult, pledgeCountResult, weekResult] = await Promise.all([
    query<{ total_minutes: string | null }>(
      `select coalesce(sum(minutes), 0)::text as total_minutes from prayer_sessions`
    ),
    query<{ active_participants: string | null }>(
      `select count(distinct user_id)::text as active_participants from prayer_sessions`
    ),
    query<{ pledged_minutes: string | null }>(
      `select coalesce(sum(total_pledged_minutes), 0)::text as pledged_minutes
       from pledges
       where is_public = true`
    ),
    query<{ total_pledges: string | null }>(
      `select count(*)::text as total_pledges
       from pledges
       where is_public = true`
    ),
    query<{ minutes_this_week: string | null }>(
      `select coalesce(sum(minutes), 0)::text as minutes_this_week
       from prayer_sessions
       where started_at >= now() - interval '7 days'`
    )
  ]);

  return {
    totalMinutes: Number(minutesResult.rows[0]?.total_minutes ?? 0),
    activeParticipants: Number(participantsResult.rows[0]?.active_participants ?? 0),
    pledgedMinutes: Number(pledgeResult.rows[0]?.pledged_minutes ?? 0),
    totalPledges: Number(pledgeCountResult.rows[0]?.total_pledges ?? 0),
    minutesThisWeek: Number(weekResult.rows[0]?.minutes_this_week ?? 0)
  } satisfies PublicCampaignStats;
}

export async function getPublicRecentActivity() {
  const result = await query<PublicActivityRow>(
    `select *
     from (
       select
         id::text,
         'session'::text as kind,
         'Minutes offered to the King'::text as title,
         'Someone joined the church in prayer for Fort Wayne.'::text as detail,
         concat(minutes::text, ' min') as metric,
         '/auth'::text as href,
         started_at as occurred_at
       from prayer_sessions

       union all

       select
         id::text,
         'request'::text as kind,
         'Community prayer shared'::text as title,
         title as detail,
         upper(status) as metric,
         '/requests'::text as href,
         created_at as occurred_at
       from prayer_requests
       where visibility = 'church_anonymous'

       union all

       select
         id::text,
         'prompt'::text as kind,
         'New prayer prompt'::text as title,
         title as detail,
         category as metric,
         '/prompts'::text as href,
         publish_date::timestamptz as occurred_at
       from prayer_prompts
       where is_active = true
         and publish_date <= current_date
     ) activity
     order by occurred_at desc
     limit 4`
  );

  return result.rows.map((row) => ({
    id: `${row.kind}-${row.id}`,
    kind: row.kind,
    title: row.title,
    detail: row.detail,
    metric: row.metric,
    href: row.href,
    occurredAt: formatTimestamp(row.occurred_at)
  })) satisfies PublicActivityItem[];
}

export async function getDashboardSnapshot(userId: string) {
  const [minutesResult, weekResult, pledgeResult, recentSessionsResult] = await Promise.all([
    query<{ total_minutes: string | null }>(
      `select coalesce(sum(minutes), 0)::text as total_minutes
       from prayer_sessions
       where user_id = $1`,
      [userId]
    ),
    query<{ week_minutes: string | null }>(
      `select coalesce(sum(minutes), 0)::text as week_minutes
       from prayer_sessions
       where user_id = $1
         and started_at >= now() - interval '7 days'`,
      [userId]
    ),
    query<{
      minutes_per_week: number | null;
      total_pledged_minutes: number;
      prayer_focus: string | null;
      is_public: boolean;
    }>(
      `select minutes_per_week, total_pledged_minutes, prayer_focus, is_public
       from pledges
       where user_id = $1
       order by created_at desc
       limit 1`,
      [userId]
    ),
    query<{
      id: string;
      minutes: number;
      startedAt: string;
      notes: string | null;
      promptTitle: string | null;
      promptCategory: string | null;
    }>(
      `select
         s.id,
         s.minutes,
         s.started_at as "startedAt",
         s.notes,
         p.title as "promptTitle",
         p.category as "promptCategory"
       from prayer_sessions s
       left join prayer_prompts p on p.id = s.prompt_id
       where s.user_id = $1
       order by s.started_at desc
       limit 8`,
      [userId]
    )
  ]);

  return {
    totalMinutes: Number(minutesResult.rows[0]?.total_minutes ?? 0),
    thisWeekMinutes: Number(weekResult.rows[0]?.week_minutes ?? 0),
    pledgedMinutes: pledgeResult.rows[0]?.total_pledged_minutes ?? 0,
    recentSessions: recentSessionsResult.rows,
    pledge: pledgeResult.rows[0]
        ? {
          minutesPerWeek: pledgeResult.rows[0].minutes_per_week,
          totalPledgedMinutes: pledgeResult.rows[0].total_pledged_minutes,
          prayerFocus: pledgeResult.rows[0].prayer_focus,
          isPublic: pledgeResult.rows[0].is_public
        }
      : null
  } satisfies DashboardSnapshot;
}

export async function getCampaignProgressPercent(goalMinutes?: number) {
  const { getCampaignSettings } = await import("@/lib/settings");
  const settings = await getCampaignSettings();
  const goal = goalMinutes ?? settings.goalMinutes;
  const stats = await getPublicCampaignStats();

  if (goal <= 0) {
    return 0;
  }

  return Math.min(100, (stats.totalMinutes / goal) * 100);
}

export async function getCampaignProgressSnapshot() {
  const { getCampaignCalendarMetrics, getCampaignSettings } = await import("@/lib/settings");
  const [settings, stats] = await Promise.all([getCampaignSettings(), getPublicCampaignStats()]);
  const calendar = getCampaignCalendarMetrics(settings);
  const minutesProgressPercent =
    settings.goalMinutes > 0
      ? Math.min(100, (stats.totalMinutes / settings.goalMinutes) * 100)
      : 0;
  const paceDelta = stats.totalMinutes - calendar.expectedMinutesByNow;

  return {
    settings,
    stats,
    calendar,
    minutesProgressPercent,
    expectedMinutesByNow: calendar.expectedMinutesByNow,
    paceDelta,
    aheadOfPace: paceDelta >= 0
  };
}
