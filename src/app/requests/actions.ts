"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { redirectWithError, redirectWithQuery, rethrowIfNextNavigation } from "@/lib/form-action";
import { assertRequestNotBlocked, decideBoardModeration } from "@/lib/moderation";
import {
  createPrayerRequest,
  markOwnRequestAnswered,
  unpublishOwnRequest
} from "@/lib/prayer-requests";
import { requestCategories } from "@/lib/request-options";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createPrayerRequestAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth");
  }

  try {
    const title = readText(formData, "title");
    const body = readText(formData, "body");
    const category = readText(formData, "category");
    const visibility = readText(formData, "visibility");
    const allowedVisibilities = ["church_anonymous", "prayer_team"] as const;
    const isAnonymous =
      visibility === "church_anonymous" &&
      (formData.get("is_anonymous") === "on" || formData.get("is_anonymous") === "true");

    if (!title || !body || !requestCategories.includes(category as (typeof requestCategories)[number])) {
      redirectWithError("/requests/mine", "Title, details, and category are required.");
    }

    if (!allowedVisibilities.includes(visibility as (typeof allowedVisibilities)[number])) {
      redirectWithError("/requests/mine", "Choose community board or private prayer.");
    }

    // Tier 1: hard block list — request is not stored.
    await assertRequestNotBlocked({ title, body });

    // Tiers 2–3: OpenAI scores + leadership list (may hard-block or hold for review).
    const decision = await decideBoardModeration({ visibility, title, body });

    await createPrayerRequest({
      userId: user.id,
      title,
      body,
      category,
      visibility,
      isAnonymous,
      boardModeration: decision.boardModeration,
      publishAt: decision.publishAt,
      matchedKeywords: decision.matchedKeywords,
      moderationNotes: decision.moderationNotes
    });

    revalidatePath("/requests");
    revalidatePath("/requests/mine");
    revalidatePath("/admin/requests");
    revalidatePath("/admin/moderation");

    redirectWithQuery("/requests/mine", { posted: "1", notice: decision.notice });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/requests/mine", error, "Could not submit your prayer request.");
  }
}

export async function markMyRequestAnsweredAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }

  try {
    const id = readText(formData, "id");
    if (!id) {
      redirectWithError("/requests/mine", "Request is required.");
    }

    await markOwnRequestAnswered({ id, userId: user.id });
    revalidatePath("/requests");
    revalidatePath("/requests/mine");
    revalidatePath("/log");
    revalidatePath("/admin/requests");
    redirectWithQuery("/requests/mine", { updated: "answered" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/requests/mine", error, "Could not mark this request as answered.");
  }
}

export async function unpublishMyRequestAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }

  try {
    const id = readText(formData, "id");
    if (!id) {
      redirectWithError("/requests/mine", "Request is required.");
    }

    const result = await unpublishOwnRequest({ id, userId: user.id });
    revalidatePath("/requests");
    revalidatePath("/requests/mine");
    revalidatePath("/log");
    revalidatePath("/admin/requests");
    revalidatePath("/admin/moderation");
    redirectWithQuery("/requests/mine", {
      updated: result.action === "archived" ? "closed" : "unpublished"
    });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/requests/mine", error, "Could not remove this request.");
  }
}
