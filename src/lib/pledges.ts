import type { PoolClient } from "pg";
import { getCampaignInstallmentPosition, getCampaignPrayerBreakdown, getCurrentCampaign } from "@/lib/campaign-model";
import { enqueuePledgeWriteback } from "@/lib/planning-center-writeback";
import { query, withTransaction } from "@/lib/postgres";

async function scheduledMinutes(client: PoolClient, pledgeId: string, installmentLimit: number) {
  if (installmentLimit <= 0) return 0;
  const result = await client.query<{ minutes: string }>(
    `select coalesce(sum(rate.minutes_per_week), 0)::text as minutes
     from generate_series(0, $2 - 1) as installments(installment)
     cross join lateral (
       select history.minutes_per_week
       from pledge_rate_history history
       where history.pledge_id = $1
         and history.effective_installment <= installments.installment
       order by history.effective_installment desc
       limit 1
     ) rate`,
    [pledgeId, installmentLimit]
  );
  return Number(result.rows[0]?.minutes ?? 0);
}

export async function getLatestPledge(userId: string) {
  const campaign = await getCurrentCampaign();
  if (!campaign) return null;
  const [result, position] = await Promise.all([
    query<{
      id: string;
      minutes_per_week: number;
      committed_minutes: number;
      joined_at: string | Date;
      prayer_focus: string | null;
      is_public: boolean;
    }>(
      `select id, minutes_per_week, committed_minutes, joined_at, prayer_focus, is_public
       from pledges
       where campaign_id = $1
         and user_id = $2
         and withdrawn_at is null
       limit 1`,
      [campaign.id, userId]
    ),
    getCampaignInstallmentPosition(campaign)
  ]);
  const row = result.rows[0];
  if (!row) return null;

  const [expectedResult, committedBeforeNextResult, prayer] = await Promise.all([
    query<{ minutes: string }>(
      `select coalesce(sum(rate.minutes_per_week), 0)::text as minutes
       from generate_series(0, $2 - 1) as installments(installment)
       cross join lateral (
         select history.minutes_per_week
         from pledge_rate_history history
         where history.pledge_id = $1
           and history.effective_installment <= installments.installment
         order by history.effective_installment desc
         limit 1
       ) rate`,
      [row.id, position.completedInstallments]
    ),
    query<{ minutes: string }>(
      `select coalesce(sum(rate.minutes_per_week), 0)::text as minutes
       from generate_series(0, $2 - 1) as installments(installment)
       cross join lateral (
         select history.minutes_per_week
         from pledge_rate_history history
         where history.pledge_id = $1
           and history.effective_installment <= installments.installment
         order by history.effective_installment desc
         limit 1
       ) rate`,
      [row.id, position.nextEffectiveInstallment]
    ),
    getCampaignPrayerBreakdown(campaign.id, userId)
  ]);

  return {
    id: row.id,
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignStartsOn: campaign.startsOn,
    campaignEndsOn: campaign.endsOn,
    campaignInstallments: campaign.installmentCount,
    completedInstallments: position.completedInstallments,
    campaignStarted: position.campaignStarted,
    campaignEnded: position.campaignEnded,
    nextEffectiveInstallment: position.nextEffectiveInstallment,
    minutesPerWeek: Number(row.minutes_per_week),
    committedMinutes: Number(row.committed_minutes),
    totalPledgedMinutes: Number(row.committed_minutes),
    expectedMinutes: Number(expectedResult.rows[0]?.minutes ?? 0),
    committedBeforeNextRate: Number(committedBeforeNextResult.rows[0]?.minutes ?? 0),
    futureInstallments: Math.max(0, campaign.installmentCount - position.nextEffectiveInstallment),
    campaignPrayedMinutes: prayer.totalMinutes,
    preCampaignCreditMinutes: prayer.preCampaignCreditMinutes,
    joinedAt: row.joined_at instanceof Date ? row.joined_at.toISOString() : String(row.joined_at),
    prayerFocus: row.prayer_focus,
    isPublic: row.is_public
  };
}

export async function userHasPledge(userId: string) {
  return Boolean(await getLatestPledge(userId));
}

export async function getPostLoginRedirectPath(userId: string) {
  void userId;
  return "/auth";
}

export async function savePrayerPledge(input: {
  userId: string;
  minutesPerWeek: number;
  prayerFocus?: string | null;
  isPublic: boolean;
}) {
  const saved = await withTransaction(async (client) => {
    const campaign = await getCurrentCampaign(client);
    if (!campaign) throw new Error("A current campaign has not been configured.");
    const position = await getCampaignInstallmentPosition(campaign, new Date(), client);
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [`${campaign.id}:${input.userId}`]);

    const existing = await client.query<{
      id: string;
      prayer_focus: string | null;
    }>(
      `select id, prayer_focus
       from pledges
       where campaign_id = $1 and user_id = $2
       for update`,
      [campaign.id, input.userId]
    );

    let pledgeId = existing.rows[0]?.id;
    if (!pledgeId) {
      const inserted = await client.query<{ id: string }>(
        `insert into pledges (
           campaign_id, user_id, minutes_per_week, total_pledged_minutes, committed_minutes,
           start_date, end_date, prayer_focus, is_public, joined_at
         ) values ($1, $2, $3, 0, 0, $4, $5, $6, $7, now())
         returning id`,
         [campaign.id, input.userId, input.minutesPerWeek, campaign.startsOn, campaign.endsOn, input.prayerFocus ?? null, true]
      );
      pledgeId = inserted.rows[0].id;
    }

    await client.query(
      `insert into pledge_rate_history (pledge_id, effective_installment, minutes_per_week)
       values ($1, $2, $3)
       on conflict (pledge_id, effective_installment) do update
       set minutes_per_week = excluded.minutes_per_week,
           created_at = now()`,
      [pledgeId, position.nextEffectiveInstallment, input.minutesPerWeek]
    );

    const committedMinutes = await scheduledMinutes(client, pledgeId, campaign.installmentCount);
    await client.query(
      `update pledges
       set minutes_per_week = $2,
           total_pledged_minutes = $3,
           committed_minutes = $3,
           prayer_focus = $4,
           is_public = $5,
           withdrawn_at = null
       where id = $1`,
      [pledgeId, input.minutesPerWeek, committedMinutes, input.prayerFocus ?? existing.rows[0]?.prayer_focus ?? null, true]
    );

    return { id: pledgeId, committedMinutes };
  });

  try {
    await enqueuePledgeWriteback({ userId: input.userId, totalPledgedMinutes: saved.committedMinutes });
  } catch {
    // Never block pledge save on writeback queue failures.
  }
  return { id: saved.id };
}

export async function createPrayerPledge(input: {
  userId: string;
  minutesPerWeek: number;
  prayerFocus: string | null;
  isPublic: boolean;
}) {
  return savePrayerPledge(input);
}

export async function removePrayerPledge(userId: string) {
  const removed = await withTransaction(async (client) => {
    const campaign = await getCurrentCampaign(client);
    if (!campaign) return false;
    const position = await getCampaignInstallmentPosition(campaign, new Date(), client);
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [`${campaign.id}:${userId}`]);
    const existing = await client.query<{ id: string }>(
      `select id from pledges
       where campaign_id = $1 and user_id = $2 and withdrawn_at is null
       for update`,
      [campaign.id, userId]
    );
    const pledgeId = existing.rows[0]?.id;
    if (!pledgeId) return false;

    await client.query(
      `insert into pledge_rate_history (pledge_id, effective_installment, minutes_per_week)
       values ($1, $2, 0)
       on conflict (pledge_id, effective_installment) do update
       set minutes_per_week = 0,
           created_at = now()`,
      [pledgeId, position.nextEffectiveInstallment]
    );
    const committedMinutes = await scheduledMinutes(client, pledgeId, campaign.installmentCount);
    await client.query(
      `update pledges
       set committed_minutes = $2,
           total_pledged_minutes = $2,
           withdrawn_at = now()
       where id = $1`,
      [pledgeId, committedMinutes]
    );
    return true;
  });

  if (removed) {
    try {
      await enqueuePledgeWriteback({ userId, totalPledgedMinutes: 0 });
    } catch {
      // Never block withdrawal on writeback queue failures.
    }
  }
}
