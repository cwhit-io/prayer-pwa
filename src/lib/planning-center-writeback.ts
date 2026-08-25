/**
 * Planning Center custom-field writeback.
 *
 * Church Center tab "Pray Like Crazy" (tab 263994) has only:
 *   - Total Minutes Pledged  → FieldDefinition 1091023
 *   - Total Minutes Prayed    → FieldDefinition 1091024
 *
 * On pledge save and prayer log we enqueue + process immediately so PCO stays current.
 */

import { getPcoCredentialsOrThrow } from "@/lib/pco-client";
import { query } from "@/lib/postgres";
import { getCurrentCampaign } from "@/lib/campaign-model";

/** Known Fort Wayne Prays custom fields on the person profile. */
export const PCO_FIELD_TOTAL_MINUTES_PLEDGED = "total_minutes_pledged";
export const PCO_FIELD_TOTAL_MINUTES_PRAYED = "total_minutes_prayed";

/** Removed from product — cleaned on ensure. */
const LEGACY_FIELD_KEYS = [
  "prayer_progress",
  "last_prayed_for",
  "follow_up_needed",
  "care_visit_scheduled",
  "pastoral_care_notes"
] as const;

/** Planning Center People FieldDefinition IDs (tab 263994). */
export const PCO_FIELD_DEFINITION_IDS = {
  [PCO_FIELD_TOTAL_MINUTES_PLEDGED]: "1091023",
  [PCO_FIELD_TOTAL_MINUTES_PRAYED]: "1091024"
} as const;

export type FieldMapRow = {
  id: string;
  fieldKey: string;
  planningCenterFieldId: string | null;
  label: string;
  direction: string;
  enabled: boolean;
  notes: string | null;
};

type FieldMapDb = {
  id: string;
  field_key: string;
  planning_center_field_id: string | null;
  label: string;
  direction: string;
  enabled: boolean;
  notes: string | null;
};

function mapField(row: FieldMapDb): FieldMapRow {
  return {
    id: row.id,
    fieldKey: row.field_key,
    planningCenterFieldId: row.planning_center_field_id,
    label: row.label,
    direction: row.direction,
    enabled: row.enabled,
    notes: row.notes
  };
}

/**
 * Ensure the two campaign writeback fields exist and point at the church's
 * FieldDefinition IDs. Safe to call repeatedly (upsert).
 */
export async function ensureCampaignWritebackFieldMap() {
  await query(
    `insert into planning_center_field_map (
       field_key, planning_center_field_id, label, direction, enabled, notes
     )
     values
       (
         $1, $2, 'Total Minutes Pledged', 'write', true,
          'Current campaign commitment from the member''s active pledge. PCO FieldDefinition 1091023 (tab 263994).'
       ),
       (
         $3, $4, 'Total Minutes Prayed', 'write', true,
          'Prayer minutes attributed to the current campaign for this member. PCO FieldDefinition 1091024 (tab 263994).'
       )
     on conflict (field_key) do update
     set planning_center_field_id = coalesce(
           nullif(planning_center_field_map.planning_center_field_id, ''),
           excluded.planning_center_field_id
         ),
         label = excluded.label,
         notes = excluded.notes,
         -- Keep admin disable: only auto-enable when previously never configured
         enabled = case
           when planning_center_field_map.planning_center_field_id is null
             or planning_center_field_map.planning_center_field_id = ''
           then true
           else planning_center_field_map.enabled
         end`,
    [
      PCO_FIELD_TOTAL_MINUTES_PLEDGED,
      PCO_FIELD_DEFINITION_IDS[PCO_FIELD_TOTAL_MINUTES_PLEDGED],
      PCO_FIELD_TOTAL_MINUTES_PRAYED,
      PCO_FIELD_DEFINITION_IDS[PCO_FIELD_TOTAL_MINUTES_PRAYED]
    ]
  );

  await query(`delete from planning_center_field_map where field_key = any($1::text[])`, [
    [...LEGACY_FIELD_KEYS]
  ]);
}

export async function listPlanningCenterFieldMap() {
  await ensureCampaignWritebackFieldMap();
  const result = await query<FieldMapDb>(
    `select id, field_key, planning_center_field_id, label, direction, enabled, notes
     from planning_center_field_map
     order by field_key`
  );
  return result.rows.map(mapField);
}

export async function updatePlanningCenterFieldMap(input: {
  fieldKey: string;
  planningCenterFieldId: string | null;
  enabled: boolean;
  notes?: string | null;
}) {
  const result = await query<FieldMapDb>(
    `update planning_center_field_map
     set planning_center_field_id = nullif($2, ''),
         enabled = $3,
         notes = coalesce($4, notes)
     where field_key = $1
     returning id, field_key, planning_center_field_id, label, direction, enabled, notes`,
    [input.fieldKey, input.planningCenterFieldId ?? "", input.enabled, input.notes ?? null]
  );

  if (!result.rows[0]) {
    throw new Error(`Unknown field map key: ${input.fieldKey}`);
  }

  return mapField(result.rows[0]);
}

export async function enqueuePlanningCenterWriteback(input: {
  userId: string | null;
  fieldKey: string;
  payload: Record<string, unknown>;
}) {
  await query(
    `insert into planning_center_sync_queue (user_id, field_key, payload, status)
     values ($1, $2, $3::jsonb, 'pending')`,
    [input.userId, input.fieldKey, JSON.stringify(input.payload)]
  );
}

export async function getUserTotalMinutesPrayed(userId: string) {
  const campaign = await getCurrentCampaign();
  if (!campaign) return 0;
  const result = await query<{ total: string }>(
    `select coalesce(sum(minutes), 0)::text as total
     from prayer_sessions
     where user_id = $1 and campaign_id = $2`,
    [userId, campaign.id]
  );
  return Number(result.rows[0]?.total ?? 0);
}

export async function getUserTotalMinutesPledged(userId: string) {
  const campaign = await getCurrentCampaign();
  if (!campaign) return 0;
  const result = await query<{ total: string | null }>(
    `select committed_minutes::text as total
     from pledges
     where user_id = $1 and campaign_id = $2 and withdrawn_at is null
     limit 1`,
    [userId, campaign.id]
  );
  return Number(result.rows[0]?.total ?? 0);
}

/**
 * After a prayer session is saved — enqueue + flush Total Minutes Prayed so PCO stays current.
 * Never throws (caller should still wrap if desired).
 */
export async function enqueuePrayerSessionWriteback(input: {
  userId: string;
  minutes: number;
  startedAt: Date;
  endedAt: Date;
  sessionId?: string | null;
}) {
  await ensureCampaignWritebackFieldMap();
  const totalMinutesPrayed = await getUserTotalMinutesPrayed(input.userId);

  await enqueuePlanningCenterWriteback({
    userId: input.userId,
    fieldKey: PCO_FIELD_TOTAL_MINUTES_PRAYED,
    payload: {
      value: totalMinutesPrayed,
      sessionMinutes: input.minutes,
      endedAt: input.endedAt.toISOString(),
      sessionId: input.sessionId ?? null
    }
  });

  await processPlanningCenterSyncQueue({ limit: 5, userId: input.userId });
}

/**
 * After a pledge is created/updated — enqueue + flush Total Minutes Pledged so PCO stays current.
 */
export async function enqueuePledgeWriteback(input: {
  userId: string;
  totalPledgedMinutes?: number;
}) {
  await ensureCampaignWritebackFieldMap();
  const totalMinutesPledged =
    input.totalPledgedMinutes ?? (await getUserTotalMinutesPledged(input.userId));

  await enqueuePlanningCenterWriteback({
    userId: input.userId,
    fieldKey: PCO_FIELD_TOTAL_MINUTES_PLEDGED,
    payload: {
      value: totalMinutesPledged
    }
  });

  await processPlanningCenterSyncQueue({ limit: 5, userId: input.userId });
}

/**
 * Enqueue both totals for a linked user and process immediately (admin backfill).
 */
export async function enqueueUserCampaignTotalsWriteback(userId: string) {
  await ensureCampaignWritebackFieldMap();
  const [prayed, pledged] = await Promise.all([
    getUserTotalMinutesPrayed(userId),
    getUserTotalMinutesPledged(userId)
  ]);

  await Promise.all([
    enqueuePlanningCenterWriteback({
      userId,
      fieldKey: PCO_FIELD_TOTAL_MINUTES_PRAYED,
      payload: { value: prayed }
    }),
    enqueuePlanningCenterWriteback({
      userId,
      fieldKey: PCO_FIELD_TOTAL_MINUTES_PLEDGED,
      payload: { value: pledged }
    })
  ]);

  await processPlanningCenterSyncQueue({ limit: 10, userId });
}

export async function getSyncQueueStats() {
  const result = await query<{ status: string; count: string }>(
    `select status, count(*)::text as count
     from planning_center_sync_queue
     group by status
     order by status`
  );

  const stats: Record<string, number> = {
    pending: 0,
    processing: 0,
    done: 0,
    skipped: 0,
    error: 0
  };

  for (const row of result.rows) {
    stats[row.status] = Number(row.count);
  }

  return stats;
}

type JsonApiErrorBody = {
  errors?: Array<{ detail?: string; title?: string }>;
};

async function pcoAuthHeaders() {
  const credentials = await getPcoCredentialsOrThrow();
  return {
    Authorization: `Basic ${Buffer.from(`${credentials.appId}:${credentials.secret}`).toString("base64")}`,
    Accept: "application/json",
    "Content-Type": "application/json"
  };
}

function pcoErrorMessage(payload: JsonApiErrorBody, status: number, fallback: string) {
  return (
    payload.errors?.[0]?.detail ||
    payload.errors?.[0]?.title ||
    `${fallback} (${status})`
  );
}

/** Find existing FieldDatum id for a person + field definition, if any. */
async function findExistingFieldDatumId(input: {
  personId: string;
  fieldDefinitionId: string;
  headers: Record<string, string>;
}) {
  let url: string | null =
    `https://api.planningcenteronline.com/people/v2/people/${input.personId}/field_data?per_page=100`;

  while (url) {
    const response = await fetch(url, {
      headers: input.headers,
      cache: "no-store"
    });
    const payload = (await response.json().catch(() => ({}))) as {
      data?: Array<{
        id: string;
        relationships?: { field_definition?: { data?: { id?: string } | null } };
      }>;
      links?: { next?: string | null };
      errors?: Array<{ detail?: string; title?: string }>;
    };

    if (!response.ok) {
      throw new Error(pcoErrorMessage(payload, response.status, "Failed to list person field data"));
    }

    for (const row of payload.data ?? []) {
      const defId = row.relationships?.field_definition?.data?.id;
      if (defId === input.fieldDefinitionId) {
        return row.id;
      }
    }

    url = payload.links?.next ?? null;
  }

  return null;
}

/**
 * Create or update a person custom field value (number/string).
 * POST when missing; PATCH when a FieldDatum already exists for that definition.
 */
async function writePersonFieldDatum(input: {
  personId: string;
  fieldDefinitionId: string;
  value: string;
}) {
  const headers = await pcoAuthHeaders();
  const existingId = await findExistingFieldDatumId({
    personId: input.personId,
    fieldDefinitionId: input.fieldDefinitionId,
    headers
  });

  if (existingId) {
    const response = await fetch(
      `https://api.planningcenteronline.com/people/v2/field_data/${existingId}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          data: {
            type: "FieldDatum",
            id: existingId,
            attributes: {
              value: input.value
            }
          }
        }),
        cache: "no-store"
      }
    );
    const payload = (await response.json().catch(() => ({}))) as JsonApiErrorBody;
    if (!response.ok) {
      throw new Error(pcoErrorMessage(payload, response.status, "Planning Center field update failed"));
    }
    return;
  }

  const response = await fetch(
    `https://api.planningcenteronline.com/people/v2/people/${input.personId}/field_data`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          type: "FieldDatum",
          attributes: {
            value: input.value
          },
          relationships: {
            field_definition: {
              data: {
                type: "FieldDefinition",
                id: input.fieldDefinitionId
              }
            }
          }
        }
      }),
      cache: "no-store"
    }
  );

  const payload = (await response.json().catch(() => ({}))) as JsonApiErrorBody;
  if (!response.ok) {
    throw new Error(pcoErrorMessage(payload, response.status, "Planning Center field write failed"));
  }
}

function resolveWriteValue(payload: Record<string, unknown>): string {
  const rawValue = payload?.value ?? payload?.sessionMinutes ?? payload;
  if (typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean") {
    return String(rawValue);
  }
  return JSON.stringify(rawValue);
}

/**
 * Process pending writeback jobs. Returns counts.
 * Optionally restrict to one user (used right after log/pledge so PCO stays current).
 * Skips jobs whose field map is disabled or missing a field definition ID.
 */
export async function processPlanningCenterSyncQueue(
  limitOrOptions: number | { limit?: number; userId?: string } = 25
) {
  const limit =
    typeof limitOrOptions === "number" ? limitOrOptions : (limitOrOptions.limit ?? 25);
  const userId = typeof limitOrOptions === "number" ? undefined : limitOrOptions.userId;

  await ensureCampaignWritebackFieldMap();

  const pending = userId
    ? await query<{
        id: string;
        user_id: string | null;
        field_key: string;
        payload: Record<string, unknown>;
      }>(
        `select id, user_id, field_key, payload
         from planning_center_sync_queue
         where status = 'pending'
           and user_id = $1
         order by created_at
         limit $2`,
        [userId, limit]
      )
    : await query<{
        id: string;
        user_id: string | null;
        field_key: string;
        payload: Record<string, unknown>;
      }>(
        `select id, user_id, field_key, payload
         from planning_center_sync_queue
         where status = 'pending'
         order by created_at
         limit $1`,
        [limit]
      );

  let done = 0;
  let skipped = 0;
  let errored = 0;

  for (const job of pending.rows) {
    await query(
      `update planning_center_sync_queue set status = 'processing' where id = $1`,
      [job.id]
    );

    try {
      const fieldResult = await query<FieldMapDb>(
        `select id, field_key, planning_center_field_id, label, direction, enabled, notes
         from planning_center_field_map
         where field_key = $1
         limit 1`,
        [job.field_key]
      );
      const field = fieldResult.rows[0] ? mapField(fieldResult.rows[0]) : null;

      if (!field?.enabled || !field.planningCenterFieldId) {
        await query(
          `update planning_center_sync_queue
           set status = 'skipped',
               error_message = $2,
               processed_at = now()
           where id = $1`,
          [
            job.id,
            !field
              ? "Unknown field map key"
              : !field.enabled
                ? "Field map disabled"
                : "Planning Center field definition ID not configured"
          ]
        );
        skipped += 1;
        continue;
      }

      if (!job.user_id) {
        await query(
          `update planning_center_sync_queue
           set status = 'skipped',
               error_message = 'No user on job (guest sessions are not written back)',
               processed_at = now()
           where id = $1`,
          [job.id]
        );
        skipped += 1;
        continue;
      }

      const userResult = await query<{ planning_center_person_id: string | null }>(
        `select planning_center_person_id from app_users where id = $1 limit 1`,
        [job.user_id]
      );
      const personId = userResult.rows[0]?.planning_center_person_id;
      if (!personId || personId.startsWith("local-")) {
        await query(
          `update planning_center_sync_queue
           set status = 'skipped',
               error_message = 'User is not linked to a Planning Center person',
               processed_at = now()
           where id = $1`,
          [job.id]
        );
        skipped += 1;
        continue;
      }

      // Prefer live totals for campaign fields so stale queue payloads still write correct numbers.
      let value = resolveWriteValue(job.payload ?? {});
      if (job.field_key === PCO_FIELD_TOTAL_MINUTES_PRAYED) {
        value = String(await getUserTotalMinutesPrayed(job.user_id));
      } else if (job.field_key === PCO_FIELD_TOTAL_MINUTES_PLEDGED) {
        value = String(await getUserTotalMinutesPledged(job.user_id));
      }

      await writePersonFieldDatum({
        personId,
        fieldDefinitionId: field.planningCenterFieldId,
        value
      });

      await query(
        `update planning_center_sync_queue
         set status = 'done',
             error_message = null,
             processed_at = now()
         where id = $1`,
        [job.id]
      );
      done += 1;
    } catch (error) {
      await query(
        `update planning_center_sync_queue
         set status = 'error',
             error_message = $2,
             processed_at = now()
         where id = $1`,
        [job.id, error instanceof Error ? error.message.slice(0, 500) : "Writeback failed"]
      );
      errored += 1;
    }
  }

  return {
    processed: pending.rows.length,
    done,
    skipped,
    errored
  };
}
