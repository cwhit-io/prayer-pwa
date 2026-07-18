import { query } from "@/lib/postgres";
import {
  fetchPrayerPeopleForPerson,
  getPlanningCenterPerson,
  searchPlanningCenterPerson
} from "@/lib/pco-client";
import { replacePrayerPeopleForUser } from "@/lib/pco-people";

export type PlanningCenterProfile = {
  personId: string | null;
  displayName: string | null;
  campusName: string | null;
  linkedAt: string | null;
  syncStatus: string;
  lastSyncedAt: string | null;
};

export type LinkedUserSummary = {
  id: string;
  name: string;
  email: string;
  role: string;
  planningCenterPersonId: string | null;
  planningCenterDisplayName: string | null;
  planningCenterCampusName: string | null;
  planningCenterSyncStatus: string;
  planningCenterLinkedAt: string | null;
  planningCenterLastSyncedAt: string | null;
  familyCount: number;
  friendsCount: number;
};

type ProfileRow = {
  planning_center_person_id: string | null;
  planning_center_display_name: string | null;
  planning_center_campus_name: string | null;
  planning_center_linked_at: string | Date | null;
  planning_center_sync_status: string;
  planning_center_last_synced_at: string | Date | null;
};

type LinkedUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  planning_center_person_id: string | null;
  planning_center_display_name: string | null;
  planning_center_campus_name: string | null;
  planning_center_sync_status: string;
  planning_center_linked_at: string | Date | null;
  planning_center_last_synced_at: string | Date | null;
  family_count: string | number | null;
  friends_count: string | number | null;
};

function formatDateValue(value: string | Date | null) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function mapProfile(row: ProfileRow): PlanningCenterProfile {
  return {
    personId: row.planning_center_person_id,
    displayName: row.planning_center_display_name,
    campusName: row.planning_center_campus_name,
    linkedAt: formatDateValue(row.planning_center_linked_at),
    syncStatus: row.planning_center_sync_status,
    lastSyncedAt: formatDateValue(row.planning_center_last_synced_at)
  };
}

export async function getPlanningCenterProfile(userId: string) {
  const result = await query<ProfileRow>(
    `select
       planning_center_person_id,
       planning_center_display_name,
       planning_center_campus_name,
       planning_center_linked_at,
       planning_center_sync_status,
       planning_center_last_synced_at
     from app_users
     where id = $1
     limit 1`,
    [userId]
  );

  return result.rows[0] ? mapProfile(result.rows[0]) : null;
}

export async function listUsersForAdminLinking(limit = 100) {
  const result = await query<LinkedUserRow>(
    `select
       u.id,
       u.name,
       u.email,
       u.role,
       u.planning_center_person_id,
       u.planning_center_display_name,
       u.planning_center_campus_name,
       u.planning_center_sync_status,
       u.planning_center_linked_at,
       u.planning_center_last_synced_at,
       count(p.id) filter (where p.focus_area = 'family') as family_count,
       count(p.id) filter (where p.focus_area = 'friends') as friends_count
     from app_users u
     left join pco_prayer_people p on p.user_id = u.id
     group by u.id
     order by
       case when u.planning_center_person_id is null then 0 else 1 end,
       u.created_at desc
     limit $1`,
    [limit]
  );

  return result.rows.map(
    (row): LinkedUserSummary => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      planningCenterPersonId: row.planning_center_person_id,
      planningCenterDisplayName: row.planning_center_display_name,
      planningCenterCampusName: row.planning_center_campus_name,
      planningCenterSyncStatus: row.planning_center_sync_status,
      planningCenterLinkedAt: formatDateValue(row.planning_center_linked_at),
      planningCenterLastSyncedAt: formatDateValue(row.planning_center_last_synced_at),
      familyCount: Number(row.family_count ?? 0),
      friendsCount: Number(row.friends_count ?? 0)
    })
  );
}

export async function adminSetPersonLink(input: {
  userId: string;
  personId: string;
  displayName?: string | null;
  campusName?: string | null;
}) {
  const personId = input.personId.trim();
  if (!personId) {
    throw new Error("Planning Center person ID is required.");
  }

  const result = await query<ProfileRow>(
    `update app_users
     set planning_center_person_id = $2,
         planning_center_display_name = coalesce(nullif($3, ''), planning_center_display_name, name),
         planning_center_campus_name = nullif($4, ''),
         planning_center_linked_at = now(),
         planning_center_sync_status = 'linked',
         planning_center_last_synced_at = now()
     where id = $1
     returning
       planning_center_person_id,
       planning_center_display_name,
       planning_center_campus_name,
       planning_center_linked_at,
       planning_center_sync_status,
       planning_center_last_synced_at`,
    [input.userId, personId, input.displayName ?? null, input.campusName ?? null]
  );

  return result.rows[0] ? mapProfile(result.rows[0]) : null;
}

export async function adminUnlinkPerson(userId: string) {
  await query(
    `update app_users
     set planning_center_person_id = null,
         planning_center_display_name = null,
         planning_center_campus_name = null,
         planning_center_linked_at = null,
         planning_center_sync_status = 'unlinked',
         planning_center_last_synced_at = null
     where id = $1`,
    [userId]
  );
  await query(`delete from pco_prayer_people where user_id = $1`, [userId]);
}

/**
 * Lookup the app user in Planning Center by email (or optional search text),
 * link their person ID, then pull household + group members into local lists.
 */
export async function syncUserFromPlanningCenter(input: {
  userId: string;
  searchOverride?: string | null;
}) {
  const userResult = await query<{ id: string; name: string; email: string }>(
    `select id, name, email from app_users where id = $1 limit 1`,
    [input.userId]
  );
  const user = userResult.rows[0];
  if (!user) {
    throw new Error("User not found.");
  }

  const searchText = (input.searchOverride || user.email || user.name).trim();
  if (!searchText || searchText.endsWith("@guest.local")) {
    throw new Error("This account needs a real email before Planning Center sync.");
  }

  await query(
    `update app_users set planning_center_sync_status = 'sync_pending' where id = $1`,
    [input.userId]
  );

  try {
    const matches = await searchPlanningCenterPerson(searchText);
    const match =
      matches.find((item) => item.email?.toLowerCase() === user.email.toLowerCase()) ||
      matches[0];

    if (!match) {
      throw new Error(`No Planning Center person found for “${searchText}”.`);
    }

    await adminSetPersonLink({
      userId: input.userId,
      personId: match.id,
      displayName: match.name
    });

    const related = await fetchPrayerPeopleForPerson(match.id);
    await replacePrayerPeopleForUser(input.userId, related);

    await query(
      `update app_users
       set planning_center_sync_status = 'linked',
           planning_center_last_synced_at = now()
       where id = $1`,
      [input.userId]
    );

    return {
      person: match,
      familyCount: related.filter((p) => p.focusArea === "family").length,
      friendsCount: related.filter((p) => p.focusArea === "friends").length
    };
  } catch (error) {
    await query(
      `update app_users set planning_center_sync_status = 'sync_error' where id = $1`,
      [input.userId]
    );
    throw error;
  }
}

/** Refresh household/friends lists for an already-linked person ID. */
export async function refreshLinkedUserPrayerPeople(userId: string) {
  const profile = await getPlanningCenterProfile(userId);
  if (!profile?.personId) {
    throw new Error("User is not linked to a Planning Center person.");
  }

  // Validate the ID still resolves when API is available.
  const person = await getPlanningCenterPerson(profile.personId);
  if (person) {
    await adminSetPersonLink({
      userId,
      personId: person.id,
      displayName: person.name
    });
  }

  const related = await fetchPrayerPeopleForPerson(profile.personId);
  await replacePrayerPeopleForUser(userId, related);

  await query(
    `update app_users
     set planning_center_sync_status = 'linked',
         planning_center_last_synced_at = now()
     where id = $1`,
    [userId]
  );

  return {
    familyCount: related.filter((p) => p.focusArea === "family").length,
    friendsCount: related.filter((p) => p.focusArea === "friends").length
  };
}

/**
 * Bulk sync: refresh lists for every linked user; attempt email lookup for unlinked users
 * with a real email (skips guest.local / pco synthetic emails).
 */
export async function bulkSyncPlanningCenterUsers() {
  const linked = await query<{ id: string }>(
    `select id from app_users
     where planning_center_person_id is not null
       and planning_center_person_id not like 'local-%'
     order by planning_center_last_synced_at nulls first, created_at`
  );

  const unlinked = await query<{ id: string }>(
    `select id from app_users
     where planning_center_person_id is null
       and email is not null
       and email not like '%@guest.local'
       and email not like 'pco-%@planningcenter.local'
     order by created_at desc
     limit 100`
  );

  const results = {
    linkedRefreshed: 0,
    linkedErrors: 0,
    unlinkedSynced: 0,
    unlinkedSkipped: 0,
    unlinkedErrors: 0
  };

  for (const row of linked.rows) {
    try {
      await refreshLinkedUserPrayerPeople(row.id);
      results.linkedRefreshed += 1;
    } catch {
      results.linkedErrors += 1;
    }
  }

  for (const row of unlinked.rows) {
    try {
      await syncUserFromPlanningCenter({ userId: row.id });
      results.unlinkedSynced += 1;
    } catch {
      results.unlinkedErrors += 1;
      results.unlinkedSkipped += 1;
    }
  }

  return results;
}

