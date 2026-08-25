import type { PoolClient } from "pg";
import { query } from "@/lib/postgres";

export const CAMPAIGN_TIME_ZONE = "America/Indiana/Indianapolis";
export const ANNUAL_PLEDGE_INSTALLMENTS = 52;

export type CurrentCampaign = {
  id: string;
  slug: string;
  name: string;
  timeZone: string;
  prayerCreditStartsOn: string;
  startsOn: string;
  endsOn: string;
  goalMinutes: number;
  installmentCount: number;
};

type Queryable = Pick<PoolClient, "query">;

function mapCampaign(row: {
  id: string;
  slug: string;
  name: string;
  time_zone: string;
  prayer_credit_starts_on: string | Date;
  starts_on: string | Date;
  ends_on: string | Date;
  goal_minutes: number;
  installment_count: number;
}): CurrentCampaign {
  const dateValue = (value: string | Date) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    timeZone: row.time_zone,
    prayerCreditStartsOn: dateValue(row.prayer_credit_starts_on),
    startsOn: dateValue(row.starts_on),
    endsOn: dateValue(row.ends_on),
    goalMinutes: Number(row.goal_minutes),
    installmentCount: Number(row.installment_count)
  };
}

export async function getCurrentCampaign(client?: Queryable): Promise<CurrentCampaign | null> {
  const runQuery = client?.query.bind(client) ?? query;
  const result = await runQuery<{
    id: string;
    slug: string;
    name: string;
    time_zone: string;
    prayer_credit_starts_on: string | Date;
    starts_on: string | Date;
    ends_on: string | Date;
    goal_minutes: number;
    installment_count: number;
  }>(
    `select id, slug, name, time_zone, prayer_credit_starts_on, starts_on, ends_on, goal_minutes, installment_count
     from campaigns
     where is_current
     limit 1`
  );
  return result.rows[0] ? mapCampaign(result.rows[0]) : null;
}

export async function syncCurrentCampaign(input: {
  startDate: string;
  endDate: string;
  goalMinutes: number;
}) {
  const result = await query<{
    id: string;
    slug: string;
    name: string;
    time_zone: string;
    prayer_credit_starts_on: string | Date;
    starts_on: string | Date;
    ends_on: string | Date;
    goal_minutes: number;
    installment_count: number;
  }>(
    `insert into campaigns (
       slug, name, time_zone, prayer_credit_starts_on, starts_on, ends_on, goal_minutes, installment_count, is_current
     ) values (
       'pray-like-crazy-2026', 'Pray Like Crazy 2026-2027', $1, $2, $2, $3, $4, $5, true
     )
     on conflict (slug) do update
     set starts_on = excluded.starts_on,
         ends_on = excluded.ends_on,
         goal_minutes = excluded.goal_minutes,
         updated_at = now()
     returning id, slug, name, time_zone, prayer_credit_starts_on, starts_on, ends_on, goal_minutes, installment_count`,
    [CAMPAIGN_TIME_ZONE, input.startDate, input.endDate, input.goalMinutes, ANNUAL_PLEDGE_INSTALLMENTS]
  );
  return mapCampaign(result.rows[0]);
}

export async function getCampaignInstallmentPosition(campaign: CurrentCampaign, now = new Date(), client?: Queryable) {
  const runQuery = client?.query.bind(client) ?? query;
  const result = await runQuery<{ completed: number; next_effective: number; campaign_started: boolean; campaign_ended: boolean }>(
    `select
       count(*) filter (
         where ($1::date + ((installment + 1) * 7))::timestamp at time zone $2 <= $4
       )::int as completed,
       coalesce(
         min(installment) filter (
           where ($1::date + (installment * 7))::timestamp at time zone $2 >= $4
         ),
         $3
       )::int as next_effective,
       ($4 >= $1::date::timestamp at time zone $2) as campaign_started,
       ($4 >= ($5::date + 1)::timestamp at time zone $2) as campaign_ended
     from generate_series(0, $3 - 1) as installments(installment)`,
    [campaign.startsOn, campaign.timeZone, campaign.installmentCount, now, campaign.endsOn]
  );
  return {
    completedInstallments: Math.min(campaign.installmentCount, Number(result.rows[0]?.completed ?? 0)),
    nextEffectiveInstallment: Math.min(campaign.installmentCount, Number(result.rows[0]?.next_effective ?? campaign.installmentCount)),
    campaignStarted: Boolean(result.rows[0]?.campaign_started),
    campaignEnded: Boolean(result.rows[0]?.campaign_ended)
  };
}

export async function getCampaignActualMinutes(campaignId: string, userId?: string | null) {
  const result = await query<{ minutes: string }>(
    `select coalesce(sum(minutes), 0)::text as minutes
     from prayer_sessions
     where campaign_id = $1
       and ($2::uuid is null or user_id = $2)`,
    [campaignId, userId ?? null]
  );
  return Number(result.rows[0]?.minutes ?? 0);
}

export async function getCampaignPrayerBreakdown(campaignId: string, userId?: string | null) {
  const result = await query<{ total: string; pre_campaign: string }>(
    `select
       coalesce(sum(minutes), 0)::text as total,
       coalesce(sum(minutes) filter (where campaign_attribution = 'pre_campaign_credit'), 0)::text as pre_campaign
     from prayer_sessions
     where campaign_id = $1
       and ($2::uuid is null or user_id = $2)`,
    [campaignId, userId ?? null]
  );
  return {
    totalMinutes: Number(result.rows[0]?.total ?? 0),
    preCampaignCreditMinutes: Number(result.rows[0]?.pre_campaign ?? 0)
  };
}

export async function getUserCampaignOverview(userId: string) {
  const campaign = await getCurrentCampaign();
  if (!campaign) return null;
  const [position, prayer] = await Promise.all([
    getCampaignInstallmentPosition(campaign),
    getCampaignPrayerBreakdown(campaign.id, userId)
  ]);
  return { ...campaign, ...position, ...prayer };
}
