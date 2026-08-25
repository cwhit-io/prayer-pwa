"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createApiToken, revokeApiToken } from "@/lib/api-tokens";
import { getCurrentUser, hasCapability } from "@/lib/auth";
import { redirectWithError, redirectWithQuery, rethrowIfNextNavigation } from "@/lib/form-action";
import { saveCampaignSettings } from "@/lib/settings";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }
  if (!hasCapability(user.role, "campaign-settings:manage")) {
    redirectWithError("/admin", "Superadmin access is required.");
  }
  return user;
}

export async function saveCampaignSettingsAction(formData: FormData) {
  try {
    await requireSuperadmin();

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
    await requireSuperadmin();
    const name = readText(formData, "token_name") || "External service";
    const created = await createApiToken({ name });
    const cookieStore = await cookies();
    cookieStore.set("api_token_flash", JSON.stringify({ token: created.token, name: created.name }), {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 120,
      path: "/admin/campaign"
    });
    revalidatePath("/admin/campaign");
    redirectWithQuery("/admin/campaign", {
      token_created: "1"
    });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/campaign", error, "Could not create API token.");
  }
}

export async function revokeApiTokenAction(formData: FormData) {
  try {
    await requireSuperadmin();
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
