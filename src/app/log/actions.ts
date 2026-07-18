"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRandomActsPrompt, type ActsStepLetter } from "@/lib/acts-prompts";
import { getCurrentUser } from "@/lib/auth";
import { redirectWithError, redirectWithQuery, rethrowIfNextNavigation } from "@/lib/form-action";
import { createPrayerSession } from "@/lib/prayer-sessions";
import { getWeightedSupplication, type SupplicationItem } from "@/lib/supplication";
import { buildYouVersionEsvUrl } from "@/lib/youversion";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readDate(value: string, fallback: Date) {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback : date;
}

export type RefreshableStepPrompt = {
  kind?: "request" | "prompt";
  id: string;
  title: string;
  body: string;
  category?: string | null;
  tags?: string[];
  scriptureReference: string | null;
  scriptureText: string | null;
  scriptureHref: string | null;
  prayerCount?: number;
};

function toRefreshablePrompt(
  prompt: {
    id: string;
    title: string;
    body: string;
    scriptureReference: string | null;
    scriptureText: string | null;
    tags?: string[];
  } | null
): RefreshableStepPrompt | null {
  if (!prompt) {
    return null;
  }

  return {
    kind: "prompt",
    id: prompt.id,
    title: prompt.title,
    body: prompt.body,
    tags: prompt.tags ?? [],
    scriptureReference: prompt.scriptureReference,
    scriptureText: prompt.scriptureText,
    scriptureHref: prompt.scriptureReference ? buildYouVersionEsvUrl(prompt.scriptureReference) : null
  };
}

function toRefreshableSupplication(item: SupplicationItem | null): RefreshableStepPrompt | null {
  if (!item) {
    return null;
  }

  return {
    kind: item.kind,
    id: item.id,
    title: item.title,
    body: item.body,
    category: item.category,
    tags: item.category ? [item.category] : [],
    scriptureReference: item.scriptureReference,
    scriptureText: item.scriptureText,
    scriptureHref: item.scriptureHref,
    prayerCount: item.prayerCount
  };
}

/** Fetch a different random prompt for one ACTS step (client refresh). */
export async function refreshStepPromptAction(
  step: "A" | "C" | "T" | "S",
  excludeId?: string | null,
  options?: {
    includeRequests?: boolean;
    /** Prefer ACTS that share these tag names with the S focus. */
    preferredTagNames?: string[] | null;
    preferredCategory?: string | null;
    focusKind?: "request" | "prompt" | null;
    focusId?: string | null;
  }
): Promise<RefreshableStepPrompt | null> {
  try {
    if (step === "S") {
      return toRefreshableSupplication(
        await getWeightedSupplication(excludeId, {
          includeRequests: options?.includeRequests !== false
        })
      );
    }

    if (step === "A" || step === "C" || step === "T") {
      const { resolvePreferredTagIds } = await import("@/lib/tags");
      const preferredTagIds = await resolvePreferredTagIds({
        kind: options?.focusKind,
        id: options?.focusId,
        tagNames: options?.preferredTagNames,
        category: options?.preferredCategory
      });
      return toRefreshablePrompt(
        await getRandomActsPrompt(step as ActsStepLetter, excludeId, preferredTagIds)
      );
    }

    return null;
  } catch {
    return null;
  }
}

export async function markFocusPrayedAction(input: {
  kind: "request" | "prompt";
  id: string;
}): Promise<{ prayerCount: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }

  try {
    if (input.kind === "request") {
      const { markRequestPrayed } = await import("@/lib/prayer-requests");
      const result = await markRequestPrayed({ requestId: input.id, userId: user.id });
      revalidatePath("/requests");
      revalidatePath("/admin/requests");
      return result;
    }

    const { markPromptPrayed } = await import("@/lib/prompts");
    const result = await markPromptPrayed({ promptId: input.id, userId: user.id });
    revalidatePath("/prompts");
    revalidatePath("/log");
    return result;
  } catch (error) {
    rethrowIfNextNavigation(error);
    return {
      prayerCount: 0,
      error: error instanceof Error ? error.message : "Could not record that prayer."
    };
  }
}

export async function logPrayerSessionAction(formData: FormData) {
  const user = await getCurrentUser();

  try {
    const now = new Date();
    const entryType = readText(formData, "entry_type") === "timer" ? "timer" : "manual";
    const minutes = Number(readText(formData, "minutes"));
    const promptIds = formData
      .getAll("prompt_id")
      .map((value) => (typeof value === "string" ? value.trim() : ""));
    const promptId = promptIds.filter(Boolean).at(-1) || null;
    const endedAt = readDate(readText(formData, "ended_at"), now);
    const startedAt = readDate(
      readText(formData, "started_at"),
      new Date(endedAt.getTime() - Math.max(1, minutes) * 60_000)
    );
    const notes = user ? readText(formData, "notes") || null : null;

    if (!Number.isFinite(minutes) || minutes <= 0) {
      redirectWithError("/log", "Prayer minutes must be greater than zero.");
    }

    await createPrayerSession({
      userId: user?.id ?? null,
      promptId,
      minutes: Math.round(minutes),
      startedAt,
      endedAt,
      entryType,
      notes
    });

    revalidatePath("/");
    revalidatePath("/auth");
    revalidatePath("/log");

    if (user) {
      redirectWithQuery("/auth", { session_saved: "1" });
    }

    redirectWithQuery("/log", { saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/log", error, "Could not save prayer session.");
  }
}
