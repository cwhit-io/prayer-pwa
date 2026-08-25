import { query } from "@/lib/postgres";
import { getCurrentCampaign } from "@/lib/campaign-model";
import {
  fetchPrayerPeopleForPerson,
  getPlanningCenterPerson,
  searchPlanningCenterPerson,
  testPlanningCenterConnection
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
  totalMinutesPrayed: number;
  totalMinutesPledged: number;
  minutesPerWeek: number | null;
  pledgeIsPublic: boolean;
};

export type StaffEntryUser = {
  id: string;
  name: string;
  email: string;
  hasPledge: boolean;
  minutesPerWeek?: number | null;
  pledgeIsPublic?: boolean;
};

export type PlanningCenterAdminSearchResult = {
  personId: string;
  name: string;
  email: string | null;
  existingUserId: string | null;
};

function syntheticEmailForPerson(personId: string) {
  return `pco-${personId}@planningcenter.local`;
}

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

export async function listUsersForAdminLinking(limit = 200, offset = 0, search = "") {
  const campaign = await getCurrentCampaign();
  const result = await query<
    LinkedUserRow & {
      total_minutes_prayed: string | number | null;
      total_minutes_pledged: string | number | null;
      minutes_per_week: number | null;
      pledge_is_public: boolean | null;
    }
  >(
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
       count(p.id) filter (where p.focus_area = 'friends') as friends_count,
       coalesce((
          select sum(s.minutes) from prayer_sessions s where s.user_id = u.id and s.campaign_id = $4
       ), 0) as total_minutes_prayed,
       coalesce((
          select pl.committed_minutes from pledges pl
          where pl.user_id = u.id and pl.campaign_id = $4 and pl.withdrawn_at is null
          limit 1
       ), 0) as total_minutes_pledged,
        (
          select pl.minutes_per_week from pledges pl
          where pl.user_id = u.id and pl.campaign_id = $4 and pl.withdrawn_at is null
          limit 1
        ) as minutes_per_week,
        (
          select pl.is_public from pledges pl
          where pl.user_id = u.id and pl.campaign_id = $4 and pl.withdrawn_at is null
          limit 1
        ) as pledge_is_public
       from app_users u
       left join pco_prayer_people p on p.user_id = u.id
       where ($3 = '' or u.name ilike '%' || $3 || '%' or u.email ilike '%' || $3 || '%')
     group by u.id
     order by
       case when u.planning_center_person_id is null then 0 else 1 end,
       u.name asc
       limit $1 offset $2`,
      [limit, offset, search, campaign?.id ?? null]
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
      friendsCount: Number(row.friends_count ?? 0),
      totalMinutesPrayed: Number(row.total_minutes_prayed ?? 0),
      totalMinutesPledged: Number(row.total_minutes_pledged ?? 0),
      minutesPerWeek: row.minutes_per_week == null ? null : Number(row.minutes_per_week),
      pledgeIsPublic: row.pledge_is_public ?? true
    })
  );
}

export async function countUsersForAdminLinking(search = "") {
  const result = await query<{ count: string }>(
    `select count(*)::text as count
     from app_users
     where ($1 = '' or name ilike '%' || $1 || '%' or email ilike '%' || $1 || '%')`,
    [search]
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function listUsersForStaffEntry(limit = 200, offset = 0, search = "", includePledgeDetails = false) {
  const campaign = await getCurrentCampaign();
  const result = await query<{
    id: string;
    name: string;
    email: string;
    minutes_per_week: number | null;
    pledge_is_public: boolean | null;
    has_pledge: boolean;
  }>(
    `select
       u.id,
       u.name,
       u.email,
       (
         select pl.minutes_per_week from pledges pl
         where pl.user_id = u.id and pl.campaign_id = $4 and pl.withdrawn_at is null
         limit 1
       ) as minutes_per_week,
       (
         select pl.is_public from pledges pl
         where pl.user_id = u.id and pl.campaign_id = $4 and pl.withdrawn_at is null
         limit 1
       ) as pledge_is_public,
       exists (
         select 1 from pledges pl
         where pl.user_id = u.id and pl.campaign_id = $4 and pl.withdrawn_at is null
       ) as has_pledge
     from app_users u
     where ($3 = '' or u.name ilike '%' || $3 || '%' or u.email ilike '%' || $3 || '%')
     order by u.name asc
     limit $1 offset $2`,
    [limit, offset, search, campaign?.id ?? null]
  );

  return result.rows.map((row): StaffEntryUser => ({
    id: row.id,
    name: row.name,
    email: row.email,
    hasPledge: row.has_pledge,
    ...(includePledgeDetails
      ? {
          minutesPerWeek: row.minutes_per_week == null ? null : Number(row.minutes_per_week),
          pledgeIsPublic: row.pledge_is_public ?? true
        }
      : {})
  }));
}

export async function searchPlanningCenterPeopleForAdmin(search: string) {
  const value = search.trim();
  if (value.length < 2) {
    throw new Error("Enter at least two characters of a name or email.");
  }

  await testPlanningCenterConnection();
  const matches = await searchPlanningCenterPerson(value);
  if (matches.length === 0) {
    return [];
  }

  const personIds = matches.map((person) => person.id);
  const existing = await query<{ id: string; planning_center_person_id: string | null; email: string }>(
    `select id, planning_center_person_id, email
     from app_users
     where planning_center_person_id = any($1::text[])
        or lower(email) = any($2::text[])`,
    [
      personIds,
      matches.flatMap((person) => (person.email ? [person.email.trim().toLowerCase()] : []))
    ]
  );

  return matches.map(
    (person): PlanningCenterAdminSearchResult => ({
      personId: person.id,
      name: person.name,
      email: person.email,
      existingUserId:
        existing.rows.find(
          (user) =>
            user.planning_center_person_id === person.id ||
            Boolean(person.email && user.email.toLowerCase() === person.email.toLowerCase())
        )?.id ?? null
    })
  );
}

/**
 * Create or reuse an app user for a Planning Center person (admin-only entry path).
 * Links PCO ID, prefers real email when available, pulls Family/Friends when possible.
 */
export async function adminCreateUserFromPlanningCenter(input: {
  personId: string;
  pullLists?: boolean;
}) {
  const personId = input.personId.trim();
  if (!personId) {
    throw new Error("Planning Center person ID is required.");
  }

  const existingByPerson = await query<{ id: string; name: string; email: string }>(
    `select id, name, email from app_users where planning_center_person_id = $1 limit 1`,
    [personId]
  );
  if (existingByPerson.rows[0]) {
    if (input.pullLists !== false) {
      try {
        await refreshLinkedUserPrayerPeople(existingByPerson.rows[0].id);
      } catch {
        // Keep existing account even if list pull fails.
      }
    }
    return {
      user: existingByPerson.rows[0],
      created: false,
      personId
    };
  }

  const person = await getPlanningCenterPerson(personId);
  if (!person) {
    throw new Error(`No Planning Center person found for ID ${personId}.`);
  }

  const preferredEmail = person.email?.trim().toLowerCase() || null;
  const fallbackEmail = syntheticEmailForPerson(person.id);

  if (preferredEmail) {
    const byEmail = await query<{
      id: string;
      name: string;
      email: string;
      planning_center_person_id: string | null;
    }>(`select id, name, email, planning_center_person_id from app_users where email = $1 limit 1`, [
      preferredEmail
    ]);

    if (byEmail.rows[0]) {
      const row = byEmail.rows[0];
      if (row.planning_center_person_id && row.planning_center_person_id !== person.id) {
        throw new Error(
          `Email ${preferredEmail} is already linked to a different Planning Center person.`
        );
      }
      await adminSetPersonLink({
        userId: row.id,
        personId: person.id,
        displayName: person.name
      });
      await query(`update app_users set name = coalesce(nullif($2, ''), name) where id = $1`, [
        row.id,
        person.name
      ]);
      if (input.pullLists !== false) {
        try {
          await refreshLinkedUserPrayerPeople(row.id);
        } catch {
          // Link still saved.
        }
      }
      return {
        user: { id: row.id, name: person.name || row.name, email: row.email },
        created: false,
        personId: person.id
      };
    }
  }

  const email = preferredEmail || fallbackEmail;
  const insert = await query<{ id: string; name: string; email: string }>(
    `insert into app_users (
       name,
       email,
       role,
       planning_center_person_id,
       planning_center_display_name,
       planning_center_linked_at,
       planning_center_sync_status,
       planning_center_last_synced_at
     )
     values ($1, $2, 'member', $3, $1, now(), 'linked', now())
     on conflict (planning_center_person_id) where planning_center_person_id is not null do update
     set name = excluded.name,
         planning_center_display_name = excluded.planning_center_display_name,
         planning_center_sync_status = 'linked',
         planning_center_last_synced_at = now()
     returning id, name, email`,
    [person.name, email, person.id]
  );

  const user = insert.rows[0];
  if (!user) {
    throw new Error("Could not create app user.");
  }

  if (input.pullLists !== false && !person.id.startsWith("local-")) {
    try {
      const related = await fetchPrayerPeopleForPerson(person.id);
      await replacePrayerPeopleForUser(user.id, related);
    } catch {
      // Account is usable without lists.
    }
  }

  return {
    user,
    created: true,
    personId: person.id
  };
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
