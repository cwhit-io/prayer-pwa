import { query } from "@/lib/postgres";
import { getCampaignSettings } from "@/lib/settings";

const FALLBACK_CAMPAIGN_WEEKS = 52;

function todayIso(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function formatDate(value: string | Date | null) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function weeksBetween(startDate: string, endDate: string | null) {
  if (!endDate) {
    return FALLBACK_CAMPAIGN_WEEKS;
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (end.getTime() < start.getTime()) {
    return 1;
  }

  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
  return Math.max(1, Math.ceil(days / 7));
}

export function calculateTotalPledgedMinutes(input: {
  minutesPerWeek: number;
  startDate: string;
  endDate: string | null;
}) {
  return input.minutesPerWeek * weeksBetween(input.startDate, input.endDate);
}

/**
 * Pledge commitment window for totals:
 * - Before campaign starts → campaign start → campaign end (full campaign)
 * - During campaign → today → campaign end (weeks remaining)
 * - No campaign dates → today + 52-week fallback
 *
 * Mid-campaign rate changes also use this window, so totals track remaining weeks
 * at the new weekly pace (not the original full-season total).
 */
export async function resolvePledgeWindow(now = new Date()) {
  const campaign = await getCampaignSettings();
  const today = todayIso(now);

  // Do not count pre-campaign weeks; do not count weeks already past.
  let startDate = today;
  if (campaign.startDate && campaign.startDate > today) {
    startDate = campaign.startDate;
  }

  const endDate = campaign.endDate;
  const weeks = weeksBetween(startDate, endDate);
  const totalForWeekly = (minutesPerWeek: number) =>
    calculateTotalPledgedMinutes({ minutesPerWeek, startDate, endDate });

  return {
    startDate,
    endDate,
    weeks,
    totalForWeekly,
    campaignStart: campaign.startDate,
    campaignEnd: campaign.endDate
  };
}

export async function createPrayerPledge(input: {
  userId: string;
  minutesPerWeek: number;
  prayerFocus: string | null;
  isPublic: boolean;
}) {
  const window = await resolvePledgeWindow();
  const totalPledgedMinutes = window.totalForWeekly(input.minutesPerWeek);

  const result = await query<{ id: string }>(
    `insert into pledges (
       user_id,
       minutes_per_week,
       total_pledged_minutes,
       start_date,
       end_date,
       prayer_focus,
       is_public
     )
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id`,
    [
      input.userId,
      input.minutesPerWeek,
      totalPledgedMinutes,
      window.startDate,
      window.endDate,
      input.prayerFocus,
      input.isPublic
    ]
  );

  return result.rows[0];
}

export async function getLatestPledge(userId: string) {
  const result = await query<{
    id: string;
    minutes_per_week: number;
    total_pledged_minutes: number;
    start_date: string | Date;
    end_date: string | Date | null;
    prayer_focus: string | null;
    is_public: boolean;
  }>(
    `select id, minutes_per_week, total_pledged_minutes, start_date, end_date, prayer_focus, is_public
     from pledges
     where user_id = $1
     order by created_at desc
     limit 1`,
    [userId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    minutesPerWeek: row.minutes_per_week,
    totalPledgedMinutes: row.total_pledged_minutes,
    startDate: formatDate(row.start_date) ?? "",
    endDate: formatDate(row.end_date),
    prayerFocus: row.prayer_focus,
    isPublic: row.is_public
  };
}

/** Create or update latest pledge using the current campaign window. */
export async function savePrayerPledge(input: {
  userId: string;
  minutesPerWeek: number;
  prayerFocus?: string | null;
  isPublic: boolean;
}) {
  const window = await resolvePledgeWindow();
  const totalPledgedMinutes = window.totalForWeekly(input.minutesPerWeek);
  const latest = await getLatestPledge(input.userId);

  if (latest) {
    await query(
      `update pledges
       set minutes_per_week = $2,
           total_pledged_minutes = $3,
           start_date = $4,
           end_date = $5,
           prayer_focus = $6,
           is_public = $7
       where id = $1`,
      [
        latest.id,
        input.minutesPerWeek,
        totalPledgedMinutes,
        window.startDate,
        window.endDate,
        input.prayerFocus ?? latest.prayerFocus,
        input.isPublic
      ]
    );
    return { id: latest.id };
  }

  return createPrayerPledge({
    userId: input.userId,
    minutesPerWeek: input.minutesPerWeek,
    prayerFocus: input.prayerFocus ?? null,
    isPublic: input.isPublic
  });
}

/**
 * Recalc all pledge totals from current weekly rates and the live campaign window
 * (remaining weeks if mid-campaign; full campaign if not started yet).
 */
export async function recalculateAllPledgeTotals() {
  const window = await resolvePledgeWindow();
  const result = await query<{ id: string; minutes_per_week: number }>(
    `select id, minutes_per_week from pledges`
  );

  let updated = 0;
  for (const row of result.rows) {
    const totalPledgedMinutes = window.totalForWeekly(row.minutes_per_week);
    await query(
      `update pledges
       set total_pledged_minutes = $2,
           start_date = $3,
           end_date = $4
       where id = $1`,
      [row.id, totalPledgedMinutes, window.startDate, window.endDate]
    );
    updated += 1;
  }

  return updated;
}
