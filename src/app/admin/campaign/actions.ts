"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createApiToken, revokeApiToken } from "@/lib/api-tokens";
import { getCurrentUser } from "@/lib/auth";
import { redirectWithError, redirectWithQuery, rethrowIfNextNavigation } from "@/lib/form-action";
import { recalculateAllPledgeTotals } from "@/lib/pledges";
import { saveCampaignSettings } from "@/lib/settings";

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

export async function saveCampaignSettingsAction(formData: FormData) {
  try {
    await requireAdmin();

    const startDate = readText(formData, "start_date") || null;
    const endDate = readText(formData, "end_date") || null;
    const goalMinutes = Number(readText(formData, "goal_minutes"));
    const maxSessionMinutes = Number(readText(formData, "max_session_minutes"));
    const showActsTags = formData.get("show_acts_tags") === "on";

    if (startDate && endDate && startDate > endDate) {
      redirectWithError("/admin/campaign", "Campaign end date must be on or after the start date.");
    }

    if (!Number.isFinite(goalMinutes) || goalMinutes <= 0) {
      redirectWithError("/admin/campaign", "Goal minutes must be a positive number.");
    }

    if (!Number.isFinite(maxSessionMinutes) || maxSessionMinutes < 5) {
      redirectWithError("/admin/campaign", "Max session minutes must be at least 5.");
    }

    await saveCampaignSettings({
      startDate,
      endDate,
      goalMinutes: Math.round(goalMinutes),
      maxSessionMinutes: Math.round(maxSessionMinutes),
      showActsTags
    });

    await recalculateAllPledgeTotals();

    revalidatePath("/");
    revalidatePath("/auth");
    revalidatePath("/log");
    revalidatePath("/admin");
    revalidatePath("/admin/campaign");
    redirectWithQuery("/admin/campaign", { saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/campaign", error, "Could not save campaign settings.");
  }
}

export async function createApiTokenAction(formData: FormData) {
  try {
    await requireAdmin();
    const name = readText(formData, "token_name") || "External service";
    const created = await createApiToken({ name });
    revalidatePath("/admin/campaign");
    redirectWithQuery("/admin/campaign", {
      token_created: "1",
      token_value: created.token,
      token_name: created.name
    });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/campaign", error, "Could not create API token.");
  }
}

export async function revokeApiTokenAction(formData: FormData) {
  try {
    await requireAdmin();
    const id = readText(formData, "token_id");
    if (!id) {
      redirectWithError("/admin/campaign", "Token id is required.");
    }
    await revokeApiToken(id);
    revalidatePath("/admin/campaign");
    redirectWithQuery("/admin/campaign", { token_revoked: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/campaign", error, "Could not revoke API token.");
  }
}
