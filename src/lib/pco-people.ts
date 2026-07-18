import { query } from "@/lib/postgres";
import type { PcoRelatedPerson } from "@/lib/pco-client";

export type PrayerPerson = {
  id: string;
  name: string;
  focusArea: "family" | "friends";
  sourceType: string;
  sourceGroupName: string | null;
  syncedAt: string;
};

type PrayerPersonRow = {
  id: string;
  name: string;
  focus_area: "family" | "friends";
  source_type: string;
  source_group_name: string | null;
  synced_at: string | Date;
};

function mapPerson(row: PrayerPersonRow): PrayerPerson {
  return {
    id: row.id,
    name: row.name,
    focusArea: row.focus_area,
    sourceType: row.source_type,
    sourceGroupName: row.source_group_name,
    syncedAt: row.synced_at instanceof Date ? row.synced_at.toISOString() : row.synced_at
  };
}

export async function replacePrayerPeopleForUser(userId: string, people: PcoRelatedPerson[]) {
  await query(`delete from pco_prayer_people where user_id = $1`, [userId]);

  for (const person of people) {
    await query(
      `insert into pco_prayer_people (
         user_id,
         planning_center_person_id,
         name,
         email,
         focus_area,
         source_type,
         source_group_pc_id,
         source_group_name,
         synced_at
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, now())
       on conflict (user_id, planning_center_person_id, source_type, source_group_pc_id)
       do update set
         name = excluded.name,
         email = excluded.email,
         focus_area = excluded.focus_area,
         source_group_name = excluded.source_group_name,
         synced_at = now()`,
      [
        userId,
        person.planningCenterPersonId,
        person.name,
        person.email,
        person.focusArea,
        person.sourceType,
        person.sourceGroupPcId || "",
        person.sourceGroupName
      ]
    );
  }
}

export async function getPrayerPeopleForUser(userId: string, focusArea?: "family" | "friends") {
  const values: unknown[] = [userId];
  let focusClause = "";
  if (focusArea) {
    values.push(focusArea);
    focusClause = `and focus_area = $2`;
  }

  const result = await query<PrayerPersonRow>(
    `select id, name, focus_area, source_type, source_group_name, synced_at
     from pco_prayer_people
     where user_id = $1
       ${focusClause}
     order by name`,
    values
  );

  return result.rows.map(mapPerson);
}

export async function countPrayerPeopleForUser(userId: string) {
  const result = await query<{ family: string; friends: string }>(
    `select
       count(*) filter (where focus_area = 'family')::text as family,
       count(*) filter (where focus_area = 'friends')::text as friends
     from pco_prayer_people
     where user_id = $1`,
    [userId]
  );

  return {
    family: Number(result.rows[0]?.family ?? 0),
    friends: Number(result.rows[0]?.friends ?? 0)
  };
}
