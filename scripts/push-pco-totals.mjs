/**
 * One-off / ops: seed field map, enqueue campaign totals for linked users, process queue.
 * Usage: node --env-file=.env.local scripts/push-pco-totals.mjs
 * (or ensure DATABASE_URL is set)
 */
import pg from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://prayer_pwa:prayer_pwa@localhost:5432/prayer_pwa";

const FIELD_PLEDGED = "total_minutes_pledged";
const FIELD_PRAYED = "total_minutes_prayed";
const DEF_PLEDGED = "1091023";
const DEF_PRAYED = "1091024";

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function query(text, values = []) {
  return pool.query(text, values);
}

async function ensureMap() {
  await query(
    `insert into planning_center_field_map (
       field_key, planning_center_field_id, label, direction, enabled, notes
     )
     values
       ($1, $2, 'Total Minutes Pledged', 'write', true, 'PCO 1091023 tab 263994'),
       ($3, $4, 'Total Minutes Prayed', 'write', true, 'PCO 1091024 tab 263994')
     on conflict (field_key) do update
     set planning_center_field_id = coalesce(
           nullif(planning_center_field_map.planning_center_field_id, ''),
           excluded.planning_center_field_id
         ),
         enabled = true,
         label = excluded.label`,
    [FIELD_PLEDGED, DEF_PLEDGED, FIELD_PRAYED, DEF_PRAYED]
  );
}

async function getCreds() {
  const result = await query(
    `select key, value from app_settings where key in ('planning_center_app_id','planning_center_secret')`
  );
  const appId = result.rows.find((r) => r.key === "planning_center_app_id")?.value;
  const secret = result.rows.find((r) => r.key === "planning_center_secret")?.value;
  if (!appId || !secret) throw new Error("PCO credentials missing");
  return { appId, secret };
}

function authHeaders(creds) {
  return {
    Authorization: `Basic ${Buffer.from(`${creds.appId}:${creds.secret}`).toString("base64")}`,
    Accept: "application/json",
    "Content-Type": "application/json"
  };
}

async function findFieldDatumId(personId, fieldDefinitionId, headers) {
  let url = `https://api.planningcenteronline.com/people/v2/people/${personId}/field_data?per_page=100`;
  while (url) {
    const res = await fetch(url, { headers, cache: "no-store" });
    const payload = await res.json();
    if (!res.ok) {
      throw new Error(payload.errors?.[0]?.detail || `list field_data ${res.status}`);
    }
    for (const row of payload.data || []) {
      if (row.relationships?.field_definition?.data?.id === fieldDefinitionId) {
        return row.id;
      }
    }
    url = payload.links?.next || null;
  }
  return null;
}

async function writeField(personId, fieldDefinitionId, value, headers) {
  const existingId = await findFieldDatumId(personId, fieldDefinitionId, headers);
  if (existingId) {
    const res = await fetch(`https://api.planningcenteronline.com/people/v2/field_data/${existingId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        data: { type: "FieldDatum", id: existingId, attributes: { value: String(value) } }
      })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.errors?.[0]?.detail || `PATCH ${res.status}`);
    return { action: "patch", id: existingId };
  }

  const res = await fetch(
    `https://api.planningcenteronline.com/people/v2/people/${personId}/field_data`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          type: "FieldDatum",
          attributes: { value: String(value) },
          relationships: {
            field_definition: { data: { type: "FieldDefinition", id: fieldDefinitionId } }
          }
        }
      })
    }
  );
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.errors?.[0]?.detail || `POST ${res.status}`);
  return { action: "post", id: payload.data?.id };
}

async function main() {
  await ensureMap();
  const map = await query(
    `select field_key, planning_center_field_id, enabled from planning_center_field_map
     where field_key in ($1,$2) order by field_key`,
    [FIELD_PLEDGED, FIELD_PRAYED]
  );
  console.log("map", map.rows);

  const creds = await getCreds();
  const headers = authHeaders(creds);

  const users = await query(
    `with current_campaign as (select id from campaigns where is_current limit 1)
     select u.id, u.name, u.planning_center_person_id,
             coalesce((select sum(s.minutes) from prayer_sessions s where s.user_id = u.id and s.campaign_id = c.id), 0)::int as prayed,
             coalesce((
               select p.committed_minutes from pledges p
               where p.user_id = u.id and p.campaign_id = c.id and p.withdrawn_at is null limit 1
             ), 0)::int as pledged
     from app_users u
     cross join current_campaign c
     where u.planning_center_person_id is not null
       and u.planning_center_person_id not like 'local-%'`
  );

  console.log(`linked users: ${users.rows.length}`);
  for (const u of users.rows) {
    try {
      const prayed = await writeField(u.planning_center_person_id, DEF_PRAYED, u.prayed, headers);
      const pledged = await writeField(u.planning_center_person_id, DEF_PLEDGED, u.pledged, headers);
      console.log("ok", u.name, {
        person: u.planning_center_person_id,
        prayed: u.prayed,
        pledged: u.pledged,
        prayedWrite: prayed,
        pledgedWrite: pledged
      });
      await query(
        `insert into planning_center_sync_queue (user_id, field_key, payload, status, processed_at)
         values
           ($1, $2, $3::jsonb, 'done', now()),
           ($1, $4, $5::jsonb, 'done', now())`,
        [
          u.id,
          FIELD_PRAYED,
          JSON.stringify({ value: u.prayed, source: "push-pco-totals" }),
          FIELD_PLEDGED,
          JSON.stringify({ value: u.pledged, source: "push-pco-totals" })
        ]
      );
    } catch (err) {
      console.error("fail", u.name, err instanceof Error ? err.message : err);
      await query(
        `insert into planning_center_sync_queue (user_id, field_key, payload, status, error_message, processed_at)
         values ($1, $2, '{}'::jsonb, 'error', $3, now())`,
        [u.id, "campaign_totals", err instanceof Error ? err.message.slice(0, 500) : "failed"]
      );
    }
  }

  // Drop legacy field-map rows + skip any leftover queue jobs for them
  await query(
    `delete from planning_center_field_map
     where field_key in (
       'prayer_progress', 'last_prayed_for', 'follow_up_needed',
       'care_visit_scheduled', 'pastoral_care_notes'
     )`
  );
  const skip = await query(
    `update planning_center_sync_queue
     set status = 'skipped',
         error_message = coalesce(error_message, 'Legacy field key removed'),
         processed_at = now()
     where status in ('pending', 'processing')
       and field_key not in ('total_minutes_prayed', 'total_minutes_pledged')
     returning id`
  );
  console.log("skipped non-campaign pending", skip.rowCount);

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
