"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, isAppUserRole, setAppUserRole } from "@/lib/auth";
import { redirectWithError, redirectWithQuery, rethrowIfNextNavigation } from "@/lib/form-action";
import {
  adminSetPersonLink,
  adminUnlinkPerson,
  bulkSyncPlanningCenterUsers,
  refreshLinkedUserPrayerPeople,
  syncUserFromPlanningCenter
} from "@/lib/planning-center";
import {
  processPlanningCenterSyncQueue,
  updatePlanningCenterFieldMap
} from "@/lib/planning-center-writeback";
import { testPlanningCenterConnection } from "@/lib/pco-client";
import { setSetting } from "@/lib/settings";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }
  if (user.role !== "admin") {
    redirectWithError("/admin", "Admin access is required.");
  }
  return user;
}

export async function savePcoCredentialsAction(formData: FormData) {
  try {
    await requireAdmin();
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
    await requireAdmin();
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
    await requireAdmin();
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
    await requireAdmin();
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
    await requireAdmin();
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
    const actor = await requireAdmin();
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
    await requireAdmin();
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
    await requireAdmin();
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
    await requireAdmin();
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
