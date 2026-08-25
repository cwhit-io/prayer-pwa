import { query } from "@/lib/postgres";
import { getCurrentCampaign } from "@/lib/campaign-model";

export type DashboardSnapshot = {
  totalMinutes: number;
  thisWeekMinutes: number;
  currentWeekday: number;
  weekDays: Array<{ dayIndex: number; minutes: number }>;
  recentSessions: Array<{
    id: string;
    minutes: number;
    startedAt: string;
    notes: string | null;
    promptTitle: string | null;
    promptCategory: string | null;
    requestTitle: string | null;
    focusLabel: string | null;
  }>;
};

export type PublicCampaignStats = {
  totalMinutes: number;
  activeParticipants: number;
  committedMinutes: number;
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
  const campaign = await getCurrentCampaign();
  if (!campaign) {
    return { totalMinutes: 0, activeParticipants: 0, committedMinutes: 0, totalPledges: 0, minutesThisWeek: 0 } satisfies PublicCampaignStats;
  }
  const [minutesResult, participantsResult, pledgeResult, pledgeCountResult, weekResult] = await Promise.all([
    query<{ total_minutes: string | null }>(
      `select coalesce(sum(minutes), 0)::text as total_minutes
       from prayer_sessions where campaign_id = $1`,
      [campaign.id]
    ),
    query<{ active_participants: string | null }>(
      `select count(distinct user_id)::text as active_participants
       from prayer_sessions where campaign_id = $1`,
      [campaign.id]
    ),
    query<{ pledged_minutes: string | null }>(
      `select coalesce(sum(committed_minutes), 0)::text as pledged_minutes
       from pledges
       where campaign_id = $1 and is_public = true and withdrawn_at is null`,
      [campaign.id]
    ),
    query<{ total_pledges: string | null }>(
      `select count(distinct user_id)::text as total_pledges
       from pledges
       where campaign_id = $1 and is_public = true and withdrawn_at is null`,
      [campaign.id]
    ),
    query<{ minutes_this_week: string | null }>(
       `with bounds as (
          select (date_trunc('week', now() at time zone 'America/Indiana/Indianapolis' + interval '1 day') - interval '1 day') at time zone 'America/Indiana/Indianapolis' as week_start
        )
        select coalesce(sum(minutes), 0)::text as minutes_this_week
        from prayer_sessions, bounds
        where started_at >= week_start
          and started_at < week_start + interval '7 days'
          and campaign_id = $1`,
      [campaign.id]
    )
  ]);

  return {
    totalMinutes: Number(minutesResult.rows[0]?.total_minutes ?? 0),
    activeParticipants: Number(participantsResult.rows[0]?.active_participants ?? 0),
    committedMinutes: Number(pledgeResult.rows[0]?.pledged_minutes ?? 0),
    totalPledges: Number(pledgeCountResult.rows[0]?.total_pledges ?? 0),
    minutesThisWeek: Number(weekResult.rows[0]?.minutes_this_week ?? 0)
  } satisfies PublicCampaignStats;
}

export async function getPublicRecentActivity() {
  const campaign = await getCurrentCampaign();
  const result = await query<PublicActivityRow>(
    `select *
     from (
       select
         id::text,
         'session'::text as kind,
         'Minutes offered to the King'::text as title,
         'Someone joined the church in prayer for Fort Wayne.'::text as detail,
         concat(minutes::text, ' min') as metric,
          '/help'::text as href,
         started_at as occurred_at
        from prayer_sessions
        where campaign_id = $1

       union all

       select
         id::text,
         'request'::text as kind,
         'Community prayer shared'::text as title,
         'A church member shared a request with the signed-in community.'::text as detail,
          'SHARED'::text as metric,
         '/requests'::text as href,
         created_at as occurred_at
       from prayer_requests
       where visibility = 'church_anonymous'
         and status in ('open', 'praying', 'answered')
         and board_moderation = 'published'
         and (publish_at is null or publish_at <= now())

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
     limit 4`,
    [campaign?.id ?? null]
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
  const [minutesResult, weekDaysResult, recentSessionsResult] = await Promise.all([
    query<{ total_minutes: string | null }>(
      `select coalesce(sum(minutes), 0)::text as total_minutes
       from prayer_sessions
       where user_id = $1`,
      [userId]
    ),
    query<{
      day_index: number;
      minutes: string;
      current_weekday: number;
    }>(
      `with bounds as (
         select
           (date_trunc('week', now() at time zone 'America/Indiana/Indianapolis' + interval '1 day') - interval '1 day') at time zone 'America/Indiana/Indianapolis' as week_start,
           extract(dow from now() at time zone 'America/Indiana/Indianapolis')::int as current_weekday
       )
       select
         days.day_index,
         coalesce(sum(s.minutes), 0)::text as minutes,
         bounds.current_weekday
       from bounds
       cross join generate_series(0, 6) as days(day_index)
       left join prayer_sessions s
         on s.user_id = $1
        and s.started_at >= bounds.week_start + days.day_index * interval '1 day'
        and s.started_at < bounds.week_start + (days.day_index + 1) * interval '1 day'
       group by days.day_index, bounds.current_weekday
       order by days.day_index`,
      [userId]
    ),
    query<{
      id: string;
      minutes: number;
      startedAt: string;
      notes: string | null;
       promptTitle: string | null;
       promptCategory: string | null;
       requestTitle: string | null;
       focusLabel: string | null;
    }>(
      `select
         s.id,
         s.minutes,
         s.started_at as "startedAt",
         s.notes,
         p.title as "promptTitle",
         p.category as "promptCategory",
         r.title as "requestTitle",
         s.focus_label as "focusLabel"
       from prayer_sessions s
       left join prayer_prompts p on p.id = s.prompt_id
       left join prayer_requests r on r.id = s.request_id
       where s.user_id = $1
       order by s.started_at desc
       limit 8`,
      [userId]
    )
  ]);

  const weekDays = weekDaysResult.rows.map((row) => ({
    dayIndex: Number(row.day_index),
    minutes: Number(row.minutes)
  }));

  return {
    totalMinutes: Number(minutesResult.rows[0]?.total_minutes ?? 0),
    thisWeekMinutes: weekDays.reduce((total, day) => total + day.minutes, 0),
    currentWeekday: Number(weekDaysResult.rows[0]?.current_weekday ?? 0),
    weekDays,
    recentSessions: recentSessionsResult.rows,
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

export type AdminDashboardSnapshot = {
  totalPeople: number;
  peopleWithGoals: number;
  activePeopleThisWeek: number;
  activePeopleThisMonth: number;
  minutesThisWeek: number;
  minutesLastWeek: number;
  sessionsThisWeek: number;
  averageSessionMinutesThisWeek: number;
  openRequests: number;
  pendingReviewRequests: number;
  delayedRequests: number;
  activePrompts: number;
};

export async function getAdminDashboardSnapshot(options?: { includePrivateRequests?: boolean }): Promise<AdminDashboardSnapshot> {
  const campaign = await getCurrentCampaign();
  const [people, activity, requests, prompts] = await Promise.all([
    query<{ total_people: string; people_with_goals: string }>(
      `select
         count(*)::text as total_people,
         count(*) filter (where p.user_id is not null)::text as people_with_goals
       from app_users u
        left join (
          select distinct on (user_id) user_id
          from pledges
          where campaign_id = $1 and withdrawn_at is null
          order by user_id, created_at desc
        ) p on p.user_id = u.id`,
      [campaign?.id ?? null]
    ),
    query<{
      active_people_this_week: string;
      active_people_this_month: string;
      minutes_this_week: string;
      minutes_last_week: string;
      sessions_this_week: string;
      average_session_minutes_this_week: string | null;
    }>(
      `with bounds as (
         select (date_trunc('week', now() at time zone 'America/Indiana/Indianapolis' + interval '1 day') - interval '1 day') at time zone 'America/Indiana/Indianapolis' as week_start
       )
       select
         count(distinct user_id) filter (where campaign_id = $1 and started_at >= week_start and started_at < week_start + interval '7 days')::text as active_people_this_week,
         count(distinct user_id) filter (where campaign_id = $1 and started_at >= now() - interval '30 days')::text as active_people_this_month,
         coalesce(sum(minutes) filter (where campaign_id = $1 and started_at >= week_start and started_at < week_start + interval '7 days'), 0)::text as minutes_this_week,
         coalesce(sum(minutes) filter (where campaign_id = $1 and started_at >= week_start - interval '7 days' and started_at < week_start), 0)::text as minutes_last_week,
         count(*) filter (where campaign_id = $1 and started_at >= week_start and started_at < week_start + interval '7 days')::text as sessions_this_week,
         coalesce(avg(minutes) filter (where campaign_id = $1 and started_at >= week_start and started_at < week_start + interval '7 days'), 0)::text as average_session_minutes_this_week
       from prayer_sessions, bounds`,
      [campaign?.id ?? null]
    ),
    query<{ open_requests: string; pending_review_requests: string; delayed_requests: string }>(
      `select
         count(*) filter (where status in ('open', 'praying'))::text as open_requests,
         count(*) filter (where visibility = 'church_anonymous' and board_moderation = 'pending_review')::text as pending_review_requests,
         count(*) filter (where visibility = 'church_anonymous' and board_moderation = 'published' and publish_at > now())::text as delayed_requests
       from prayer_requests
       where ($1::boolean = true or visibility = 'church_anonymous')`,
      [options?.includePrivateRequests === true]
    ),
    query<{ active_prompts: string }>(
      `select count(*)::text as active_prompts
       from prayer_prompts
       where is_active = true and publish_date <= current_date`
    )
  ]);

  const activityRow = activity.rows[0];
  const requestRow = requests.rows[0];
  return {
    totalPeople: Number(people.rows[0]?.total_people ?? 0),
    peopleWithGoals: Number(people.rows[0]?.people_with_goals ?? 0),
    activePeopleThisWeek: Number(activityRow?.active_people_this_week ?? 0),
    activePeopleThisMonth: Number(activityRow?.active_people_this_month ?? 0),
    minutesThisWeek: Number(activityRow?.minutes_this_week ?? 0),
    minutesLastWeek: Number(activityRow?.minutes_last_week ?? 0),
    sessionsThisWeek: Number(activityRow?.sessions_this_week ?? 0),
    averageSessionMinutesThisWeek: Math.round(Number(activityRow?.average_session_minutes_this_week ?? 0)),
    openRequests: Number(requestRow?.open_requests ?? 0),
    pendingReviewRequests: Number(requestRow?.pending_review_requests ?? 0),
    delayedRequests: Number(requestRow?.delayed_requests ?? 0),
    activePrompts: Number(prompts.rows[0]?.active_prompts ?? 0)
  };
}
