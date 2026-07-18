/**
 * Planning Center custom-field writeback.
 * Jobs enqueue even when fields are disabled; process marks them skipped until admins
 * set a Planning Center field definition ID and enable the map row.
 */

import { getPcoCredentialsOrThrow } from "@/lib/pco-client";
import { query } from "@/lib/postgres";

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

export async function listPlanningCenterFieldMap() {
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

/** Enqueue last-prayed + progress after a session is saved (no-op side effects if writeback disabled). */
export async function enqueuePrayerSessionWriteback(input: {
  userId: string;
  minutes: number;
  startedAt: Date;
  endedAt: Date;
  sessionId?: string | null;
}) {
  await Promise.all([
    enqueuePlanningCenterWriteback({
      userId: input.userId,
      fieldKey: "last_prayed_for",
      payload: {
        value: input.endedAt.toISOString(),
        startedAt: input.startedAt.toISOString(),
        sessionId: input.sessionId ?? null
      }
    }),
    enqueuePlanningCenterWriteback({
      userId: input.userId,
      fieldKey: "prayer_progress",
      payload: {
        sessionMinutes: input.minutes,
        endedAt: input.endedAt.toISOString(),
        sessionId: input.sessionId ?? null
      }
    })
  ]);
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

async function writePersonFieldDatum(input: {
  personId: string;
  fieldDefinitionId: string;
  value: string;
}) {
  const credentials = await getPcoCredentialsOrThrow();
  const response = await fetch(
    `https://api.planningcenteronline.com/people/v2/people/${input.personId}/field_data`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.appId}:${credentials.secret}`).toString("base64")}`,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
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

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      errors?: Array<{ detail?: string; title?: string }>;
    };
    throw new Error(
      payload.errors?.[0]?.detail ||
        payload.errors?.[0]?.title ||
        `Planning Center field write failed (${response.status})`
    );
  }
}

/**
 * Process pending writeback jobs. Returns counts.
 * Skips jobs whose field map is disabled or missing a field definition ID.
 */
export async function processPlanningCenterSyncQueue(limit = 25) {
  const pending = await query<{
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

      const rawValue = job.payload?.value ?? job.payload?.sessionMinutes ?? job.payload;
      const value =
        typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean"
          ? String(rawValue)
          : JSON.stringify(rawValue);

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
