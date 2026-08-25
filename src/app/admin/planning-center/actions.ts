"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, hasCapability, isAppUserRole, setAppUserRole } from "@/lib/auth";
import { redirectWithError, redirectWithQuery, rethrowIfNextNavigation } from "@/lib/form-action";
import {
  adminCreateUserFromPlanningCenter,
  adminSetPersonLink,
  adminUnlinkPerson,
  bulkSyncPlanningCenterUsers,
  refreshLinkedUserPrayerPeople,
  searchPlanningCenterPeopleForAdmin,
  syncUserFromPlanningCenter
} from "@/lib/planning-center";
import {
  enqueueUserCampaignTotalsWriteback,
  processPlanningCenterSyncQueue,
  updatePlanningCenterFieldMap
} from "@/lib/planning-center-writeback";
import { savePrayerPledge } from "@/lib/pledges";
import { createPrayerSession } from "@/lib/prayer-sessions";
import { testPlanningCenterConnection } from "@/lib/pco-client";
import { query } from "@/lib/postgres";
import { setSetting } from "@/lib/settings";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }
  if (!hasCapability(user.role, "directory:manage")) {
    redirectWithError("/admin", "Superadmin access is required.");
  }
  return user;
}

async function requireMemberEntryAccess() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }
  if (!hasCapability(user.role, "member-entries:manage")) {
    redirectWithError("/admin", "Staff entry access is required.");
  }
  return user;
}

async function requirePeopleAddAccess() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }
  if (!hasCapability(user.role, "people:add")) {
    redirectWithError("/admin", "Staff access is required to add people.");
  }
  return user;
}

export async function savePcoCredentialsAction(formData: FormData) {
  try {
    await requireSuperadmin();
    const appId = readText(formData, "app_id");
    const secret = readText(formData, "secret");

    if (!appId || !secret) {
      redirectWithError("/admin/planning-center", "Both Application ID and Secret are required.");
    }

    await setSetting("planning_center_app_id", appId);
    await setSetting("planning_center_secret", secret);
    await testPlanningCenterConnection();

    revalidatePath("/admin");
    revalidatePath("/admin/planning-center");
    redirectWithQuery("/admin/planning-center", { saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/planning-center", error, "Could not save Planning Center credentials.");
  }
}

export async function syncUserAction(formData: FormData) {
  try {
    await requireSuperadmin();
    const userId = readText(formData, "user_id");
    const searchOverride = readText(formData, "search_override") || null;

    if (!userId) {
      redirectWithError("/admin/planning-center", "User is required.");
    }

    await syncUserFromPlanningCenter({ userId, searchOverride });
    revalidatePath("/admin/planning-center");
    revalidatePath("/auth");
    redirectWithQuery("/admin/planning-center", { synced: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/planning-center", error, "Could not sync user.");
  }
}

export async function refreshUserAction(formData: FormData) {
  try {
    await requireSuperadmin();
    const userId = readText(formData, "user_id");
    if (!userId) {
      redirectWithError("/admin/planning-center", "User is required.");
    }

    await refreshLinkedUserPrayerPeople(userId);
    revalidatePath("/admin/planning-center");
    revalidatePath("/auth");
    redirectWithQuery("/admin/planning-center", { synced: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/planning-center", error, "Could not refresh prayer lists.");
  }
}

export async function manualPersonOverrideAction(formData: FormData) {
  try {
    await requireSuperadmin();
    const userId = readText(formData, "user_id");
    const personId = readText(formData, "person_id");
    const displayName = readText(formData, "display_name") || null;
    const pullLists = formData.get("pull_lists") === "on";

    if (!userId || !personId) {
      redirectWithError(
        "/admin/planning-center",
        "User and Planning Center person ID are required."
      );
    }

    await adminSetPersonLink({ userId, personId, displayName });

    if (pullLists) {
      try {
        await refreshLinkedUserPrayerPeople(userId);
      } catch {
        // Manual override can still save the ID even if list pull fails.
      }
    }

    revalidatePath("/admin/planning-center");
    revalidatePath("/auth");
    redirectWithQuery("/admin/planning-center", { override: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/planning-center", error, "Could not save person override.");
  }
}

export async function unlinkUserAction(formData: FormData) {
  try {
    await requireSuperadmin();
    const userId = readText(formData, "user_id");
    if (!userId) {
      redirectWithError("/admin/planning-center", "User is required.");
    }
    await adminUnlinkPerson(userId);
    revalidatePath("/admin/planning-center");
    revalidatePath("/auth");
    redirectWithQuery("/admin/planning-center", { unlinked: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/planning-center", error, "Could not unlink user.");
  }
}

export async function setUserRoleAction(formData: FormData) {
  try {
    const actor = await requireSuperadmin();
    const userId = readText(formData, "user_id");
    const role = readText(formData, "role");

    if (!userId || !role) {
      redirectWithError("/admin/planning-center", "User and role are required.");
    }
    if (!isAppUserRole(role)) {
      redirectWithError("/admin/planning-center", "Invalid role.");
      return;
    }

    await setAppUserRole({ userId, role, actorUserId: actor.id });
    revalidatePath("/admin");
    revalidatePath("/admin/planning-center");
    revalidatePath("/auth");
    redirectWithQuery("/admin/planning-center", { role: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/planning-center", error, "Could not update user role.");
  }
}

export async function bulkSyncPlanningCenterAction() {
  try {
    await requireSuperadmin();
    const results = await bulkSyncPlanningCenterUsers();
    revalidatePath("/admin/planning-center");
    revalidatePath("/auth");
    redirectWithQuery("/admin/planning-center", {
      bulk: "1",
      linked: String(results.linkedRefreshed),
      linked_err: String(results.linkedErrors),
      unlinked: String(results.unlinkedSynced),
      unlinked_err: String(results.unlinkedErrors)
    });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/planning-center", error, "Bulk sync failed.");
  }
}

export async function saveFieldMapAction(formData: FormData) {
  try {
    await requireSuperadmin();
    const fieldKey = readText(formData, "field_key");
    const planningCenterFieldId = readText(formData, "planning_center_field_id") || null;
    const enabled = formData.get("enabled") === "on";
    const notes = readText(formData, "notes") || null;

    if (!fieldKey) {
      redirectWithError("/admin/planning-center", "Field key is required.");
    }

    await updatePlanningCenterFieldMap({
      fieldKey,
      planningCenterFieldId,
      enabled,
      notes
    });

    revalidatePath("/admin/planning-center");
    redirectWithQuery("/admin/planning-center", { field_map: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/planning-center", error, "Could not save field map.");
  }
}

export async function processSyncQueueAction() {
  try {
    await requireSuperadmin();
    const result = await processPlanningCenterSyncQueue(50);
    revalidatePath("/admin/planning-center");
    redirectWithQuery("/admin/planning-center", {
      queue: "1",
      done: String(result.done),
      skipped: String(result.skipped),
      errored: String(result.errored)
    });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/planning-center", error, "Could not process sync queue.");
  }
}

/** Create/link an app user from a Planning Center person ID (from search results). */
export async function addUserFromPlanningCenterAction(formData: FormData) {
  try {
    await requirePeopleAddAccess();
    const personId = readText(formData, "person_id");
    if (!personId) {
      redirectWithError("/admin/planning-center", "Planning Center person is required.");
    }

    const result = await adminCreateUserFromPlanningCenter({
      personId,
      pullLists: true
    });

    revalidatePath("/admin/planning-center");
    revalidatePath("/admin");
    revalidatePath("/");
    redirectWithQuery("/admin/planning-center", {
      user_added: "1",
      created: result.created ? "1" : "0",
      name: result.user.name
    });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/planning-center", error, "Could not add user from Planning Center.");
  }
}

export async function searchPlanningCenterPeopleAction(search: string) {
  try {
    await requirePeopleAddAccess();
    const results = await searchPlanningCenterPeopleForAdmin(search);
    return { ok: true as const, results };
  } catch (error) {
    rethrowIfNextNavigation(error);
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Could not search Planning Center.",
      results: []
    };
  }
}

/** Admin records a prayer session for any member (counts toward campaign + PCO writeback). */
export async function adminRecordPrayerSessionAction(formData: FormData) {
  try {
    await requireMemberEntryAccess();
    const userId = readText(formData, "user_id");
    const minutes = Number(readText(formData, "minutes"));
    const notes = readText(formData, "notes") || null;
    const whenRaw = readText(formData, "session_at");

    if (!userId) {
      redirectWithError("/admin/planning-center", "Choose a user.");
    }
    if (!Number.isFinite(minutes) || minutes <= 0) {
      redirectWithError("/admin/planning-center", "Enter minutes greater than zero.");
    }

    const exists = await query<{ id: string }>(`select id from app_users where id = $1 limit 1`, [
      userId
    ]);
    if (!exists.rows[0]) {
      redirectWithError("/admin/planning-center", "User not found.");
    }

    const endedAt = whenRaw ? new Date(whenRaw) : new Date();
    if (Number.isNaN(endedAt.getTime())) {
      redirectWithError("/admin/planning-center", "Invalid session date/time.");
    }
    const startedAt = new Date(endedAt.getTime() - Math.round(minutes) * 60_000);

    await createPrayerSession({
      userId,
      promptId: null,
      minutes: Math.round(minutes),
      startedAt,
      endedAt,
      entryType: "manual",
      notes: notes ? `Staff entry: ${notes}` : "Staff-recorded prayer session"
    });

    revalidatePath("/admin/planning-center");
    revalidatePath("/");
    revalidatePath("/auth");
    redirectWithQuery("/admin/planning-center", { session_saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/planning-center", error, "Could not record prayer session.");
  }
}

/** Admin creates or updates a campaign pledge for any member. */
export async function adminSavePledgeAction(formData: FormData) {
  try {
    const actor = await requireMemberEntryAccess();
    const userId = readText(formData, "user_id");
    const minutesPerWeek = Number(readText(formData, "minutes_per_week"));

    if (!userId) {
      redirectWithError("/admin/planning-center", "Choose a user.");
    }
    if (!Number.isInteger(minutesPerWeek) || minutesPerWeek <= 0 || minutesPerWeek > 10080) {
      redirectWithError("/admin/planning-center", "Enter whole weekly minutes between 1 and 10,080.");
    }

    const exists = await query<{ id: string }>(`select id from app_users where id = $1 limit 1`, [
      userId
    ]);
    if (!exists.rows[0]) {
      redirectWithError("/admin/planning-center", "User not found.");
    }

    if (actor.role === "prayer_team") {
      const existing = await query<{ id: string }>(
        `select pl.id
         from pledges pl
         join campaigns c on c.id = pl.campaign_id and c.is_current = true
         where pl.user_id = $1 and pl.withdrawn_at is null
         limit 1`,
        [userId]
      );
      if (existing.rows[0]) {
        redirectWithError("/admin/planning-center", "An active pledge already exists. An admin must update it.");
      }
    }

    await savePrayerPledge({
      userId,
      minutesPerWeek: Math.round(minutesPerWeek),
      isPublic: true
    });

    revalidatePath("/admin/planning-center");
    revalidatePath("/");
    revalidatePath("/auth");
    revalidatePath("/pledge");
    redirectWithQuery("/admin/planning-center", { pledge_saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/planning-center", error, "Could not save pledge.");
  }
}

/** Enqueue Total Minutes Pledged + Prayed for every PCO-linked user, then process the queue. */
export async function pushCampaignTotalsWritebackAction() {
  try {
    await requireSuperadmin();
    const users = await query<{ id: string }>(
      `select id from app_users
       where planning_center_person_id is not null
         and planning_center_person_id not like 'local-%'`
    );

    for (const row of users.rows) {
      await enqueueUserCampaignTotalsWriteback(row.id);
    }

    // enqueueUserCampaignTotalsWriteback already flushes each user; drain any leftovers.
    let done = 0;
    let skipped = 0;
    let errored = 0;
    for (let i = 0; i < 20; i += 1) {
      const batch = await processPlanningCenterSyncQueue({ limit: 50 });
      done += batch.done;
      skipped += batch.skipped;
      errored += batch.errored;
      if (batch.processed === 0) {
        break;
      }
    }

    revalidatePath("/admin/planning-center");
    redirectWithQuery("/admin/planning-center", {
      queue: "1",
      done: String(done),
      skipped: String(skipped),
      errored: String(errored)
    });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/planning-center", error, "Could not push campaign totals to Planning Center.");
  }
}
