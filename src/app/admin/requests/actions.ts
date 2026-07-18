"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { redirectWithError, redirectWithQuery, rethrowIfNextNavigation } from "@/lib/form-action";
import {
  publishBoardRequestNow,
  requestStatuses,
  updatePrayerRequestStatus
} from "@/lib/prayer-requests";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function requireAdminOrPrayerTeam() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth");
  }

  if (user.role !== "admin" && user.role !== "prayer_team") {
    redirectWithError("/admin", "Prayer team access is required.");
  }

  return user;
}

export async function updateRequestStatusAction(formData: FormData) {
  try {
    await requireAdminOrPrayerTeam();
    const id = readText(formData, "id");
    const status = readText(formData, "status");

    if (!id || !requestStatuses.includes(status as (typeof requestStatuses)[number])) {
      redirectWithError("/admin/requests", "A valid request and status are required.");
    }

    await updatePrayerRequestStatus({ id, status });
    revalidatePath("/requests");
    revalidatePath("/admin/requests");
    revalidatePath("/admin/moderation");
    redirectWithQuery("/admin/requests", { status_saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/requests", error, "Could not update request status.");
  }
}

export async function publishRequestNowAction(formData: FormData) {
  try {
    const user = await requireAdminOrPrayerTeam();
    if (user.role !== "admin") {
      redirectWithError("/admin/requests", "Admin access is required.");
    }

    const id = readText(formData, "id");
    if (!id) {
      redirectWithError("/admin/requests", "Request id is required.");
    }

    await publishBoardRequestNow({ id });
    revalidatePath("/requests");
    revalidatePath("/requests/mine");
    revalidatePath("/admin/requests");
    revalidatePath("/admin/moderation");
    redirectWithQuery("/admin/requests", { published: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/requests", error, "Could not publish request.");
  }
}
