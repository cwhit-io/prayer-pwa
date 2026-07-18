"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { redirectWithError, redirectWithQuery, rethrowIfNextNavigation } from "@/lib/form-action";
import {
  parseModerationKeywordList,
  previewModeration,
  replaceModerationBlocklistFromList,
  replaceModerationKeywordsFromList,
  type ModerationPreview
} from "@/lib/moderation";
import {
  DEFAULT_CATEGORY_THRESHOLDS,
  DEFAULT_OPENAI_THRESHOLDS,
  mergeOpenAIThresholds,
  parseOptionalScore,
  saveOpenAIModerationThresholds,
  type CategoryThreshold,
  type OpenAIModerationThresholds
} from "@/lib/openai-moderation";
import { approveBoardRequest, rejectBoardRequest } from "@/lib/prayer-requests";
import { setSetting } from "@/lib/settings";

export type TestModerationState = {
  preview: ModerationPreview | null;
  error: string | null;
} | null;

/** Dry-run moderation for the admin tester (returns data; does not redirect). */
export async function testModerationAction(
  _prev: TestModerationState,
  formData: FormData
): Promise<TestModerationState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { preview: null, error: "Admin access is required." };
  }

  const title = typeof formData.get("title") === "string" ? String(formData.get("title")).trim() : "";
  const body = typeof formData.get("body") === "string" ? String(formData.get("body")).trim() : "";
  const visibilityRaw =
    typeof formData.get("visibility") === "string" ? String(formData.get("visibility")) : "";
  const visibility =
    visibilityRaw === "prayer_team" ? ("prayer_team" as const) : ("church_anonymous" as const);

  if (!body && !title) {
    return { preview: null, error: "Enter title and/or details to test." };
  }

  try {
    const preview = await previewModeration({
      title: title || "(no title)",
      body: body || title,
      visibility
    });
    return { preview, error: null };
  } catch (error) {
    return {
      preview: null,
      error: error instanceof Error ? error.message : "Could not run moderation test."
    };
  }
}

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

function revalidate() {
  revalidatePath("/admin/moderation");
  revalidatePath("/admin/requests");
  revalidatePath("/requests");
  revalidatePath("/requests/mine");
}

export async function approveBoardRequestAction(formData: FormData) {
  try {
    await requireAdmin();
    const id = readText(formData, "id");
    if (!id) {
      redirectWithError("/admin/moderation", "Request id is required.");
    }

    await approveBoardRequest({
      id,
      publishImmediately: true,
      notes: "Approved for community board by admin."
    });
    revalidate();
    redirectWithQuery("/admin/moderation", { approved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/moderation", error, "Could not approve request.");
  }
}

export async function rejectBoardRequestAction(formData: FormData) {
  try {
    await requireAdmin();
    const id = readText(formData, "id");
    if (!id) {
      redirectWithError("/admin/moderation", "Request id is required.");
    }

    await rejectBoardRequest({
      id,
      notes: "Kept private / not posted to community board by admin."
    });
    revalidate();
    redirectWithQuery("/admin/moderation", { rejected: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/moderation", error, "Could not reject request.");
  }
}

/** Save the church leadership supplemental list. */
export async function saveKeywordListAction(formData: FormData) {
  try {
    await requireAdmin();
    const raw = typeof formData.get("keywords") === "string" ? String(formData.get("keywords")) : "";
    const keywords = parseModerationKeywordList(raw);
    const result = await replaceModerationKeywordsFromList(keywords);
    revalidate();
    redirectWithQuery("/admin/moderation", {
      keyword_saved: "1",
      count: String(result.count)
    });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/moderation", error, "Could not save leadership list.");
  }
}

/** Save the hard-block list (profanity / spam). */
export async function saveBlocklistAction(formData: FormData) {
  try {
    await requireAdmin();
    const raw =
      typeof formData.get("blocklist") === "string" ? String(formData.get("blocklist")) : "";
    const terms = parseModerationKeywordList(raw);
    const result = await replaceModerationBlocklistFromList(terms);
    revalidate();
    redirectWithQuery("/admin/moderation", {
      blocklist_saved: "1",
      count: String(result.count)
    });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/moderation", error, "Could not save block list.");
  }
}

/** Save OpenAI API key used for Moderation API score routing. */
export async function saveOpenAIKeyAction(formData: FormData) {
  try {
    await requireAdmin();
    const apiKey = readText(formData, "openai_api_key");
    const clear = formData.get("clear_openai_key") === "on" || formData.get("clear_openai_key") === "true";

    if (clear) {
      await setSetting("openai_api_key", "");
    } else if (apiKey) {
      await setSetting("openai_api_key", apiKey);
    } else {
      redirectWithError(
        "/admin/moderation",
        "Enter an API key, or check “Clear stored key” to remove the database key."
      );
    }

    revalidate();
    redirectWithQuery("/admin/moderation", { openai_saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/moderation", error, "Could not save OpenAI key.");
  }
}

/** Save OpenAI score thresholds used for block / review routing. */
export async function saveOpenAIThresholdsAction(formData: FormData) {
  try {
    await requireAdmin();

    if (formData.get("reset_defaults") === "1") {
      await saveOpenAIModerationThresholds(DEFAULT_OPENAI_THRESHOLDS);
      revalidate();
      redirectWithQuery("/admin/moderation", { thresholds_saved: "1", reset: "1" });
    }

    const categories: CategoryThreshold[] = DEFAULT_CATEGORY_THRESHOLDS.map((def) => {
      const reviewRaw = readText(formData, `review__${def.category}`);
      const blockRaw = readText(formData, `block__${def.category}`);
      const recommendedAction =
        readText(formData, `action__${def.category}`) || def.recommendedAction;
      const urgent =
        formData.get(`urgent__${def.category}`) === "on" ||
        formData.get(`urgent__${def.category}`) === "true";

      // Categories that must never auto-block keep block = null regardless of form input.
      const neverBlock = def.block === null;

      return {
        category: def.category,
        review: parseOptionalScore(reviewRaw === "" ? def.review : reviewRaw, def.review),
        // Empty block field = no hard-block for this category.
        block: neverBlock ? null : blockRaw === "" ? null : parseOptionalScore(blockRaw, def.block),
        recommendedAction,
        urgent
      };
    });

    const next: OpenAIModerationThresholds = mergeOpenAIThresholds({
      categories,
      flaggedMeansReview:
        formData.get("flagged_means_review") === "on" ||
        formData.get("flagged_means_review") === "true"
    });

    await saveOpenAIModerationThresholds(next);
    revalidate();
    redirectWithQuery("/admin/moderation", { thresholds_saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/moderation", error, "Could not save score thresholds.");
  }
}
