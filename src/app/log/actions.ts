"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getRandomActsPrompt, type ActsStepLetter } from "@/lib/acts-prompts";
import { getCurrentUser } from "@/lib/auth";
import { redirectWithError, redirectWithQuery, rethrowIfNextNavigation } from "@/lib/form-action";
import { createPrayerSession } from "@/lib/prayer-sessions";
import { markPromptPrayed } from "@/lib/prompts";
import { markRequestPrayed } from "@/lib/prayer-requests";
import { getWeightedSupplication, type SupplicationItem } from "@/lib/supplication";
import { buildYouVersionEsvUrl } from "@/lib/youversion";
import { query } from "@/lib/postgres";
import { readDate, readPrayerDate, resolveSessionTimes } from "@/lib/prayer-session-times";

const MAX_SESSION_MINUTES = 24 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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
    const user = await getCurrentUser();
    const canUseCommunityRequests = Boolean(user?.planningCenterPersonId);
    if (step === "S") {
      return toRefreshableSupplication(
        await getWeightedSupplication(excludeId, {
          includeRequests: canUseCommunityRequests && options?.includeRequests !== false
        })
      );
    }

    if (step === "A" || step === "C" || step === "T") {
      const { resolvePreferredTagIds } = await import("@/lib/tags");
      const preferredTagIds = await resolvePreferredTagIds({
        kind: options?.focusKind === "request" && !canUseCommunityRequests ? null : options?.focusKind,
        id: options?.focusKind === "request" && !canUseCommunityRequests ? null : options?.focusId,
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
      if (!user.planningCenterPersonId) {
        throw new Error("Connect your church profile before praying from the community board.");
      }
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

async function savePrayerSession(formData: FormData) {
  const user = await getCurrentUser();
    const now = new Date();
    const entryType = readText(formData, "entry_type") === "timer" ? "timer" : "manual";
    const minutes = Number(readText(formData, "minutes"));
    const roundedMinutes = Math.round(minutes);
    const elapsedSeconds = Number(readText(formData, "elapsed_seconds"));
    const clientSessionId = readText(formData, "client_session_id") || null;
    const promptIds = formData
      .getAll("prompt_id")
      .map((value) => (typeof value === "string" ? value.trim() : ""));
    const promptId = promptIds.filter(Boolean).at(-1) || null;
    const requestId = readText(formData, "request_id") || null;
    const focusLabel = readText(formData, "focus_label") || null;
    let endedAt = readDate(readText(formData, "ended_at"), now);
    let startedAt = readPrayerDate(
      readText(formData, "started_at"),
      new Date(endedAt.getTime() - Math.max(1, Number.isFinite(minutes) ? minutes : 1) * 60_000)
    );
    const notes = user ? readText(formData, "notes") || null : null;

    if (!Number.isFinite(minutes) || roundedMinutes <= 0) {
      throw new Error("Prayer minutes must be greater than zero.");
    }
    if (roundedMinutes > MAX_SESSION_MINUTES) {
      throw new Error("Prayer sessions cannot exceed 24 hours.");
    }
    if (entryType === "timer") {
      if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0 || elapsedSeconds > MAX_SESSION_MINUTES * 60) {
        throw new Error("This timer duration is invalid.");
      }
      if (roundedMinutes !== Math.ceil(elapsedSeconds / 60)) {
        throw new Error("This timer duration does not match its prayer minutes.");
      }
      endedAt = now;
      startedAt = new Date(now.getTime() - Math.floor(elapsedSeconds) * 1000);
    }
    if (clientSessionId && !UUID_PATTERN.test(clientSessionId)) {
      throw new Error("This prayer session could not be identified.");
    }
    if (promptId && requestId) {
      throw new Error("A prayer session cannot use both a prompt and a request.");
    }
    if (promptId) {
      const allowedPrompt = await query<{ id: string }>(
        `select id from prayer_prompts where id = $1 and is_active = true and publish_date <= current_date limit 1`,
        [promptId]
      );
      if (!allowedPrompt.rows[0]) {
        throw new Error("That prayer prompt is not currently available.");
      }
    }
    if (requestId) {
      if (!user?.planningCenterPersonId) {
        throw new Error("Connect your church profile before praying from the community board.");
      }
      const allowedRequest = await query<{ id: string }>(
        `select id from prayer_requests
         where id = $1
           and visibility = 'church_anonymous'
           and status in ('open', 'praying', 'answered')
           and board_moderation = 'published'
           and (publish_at is null or publish_at <= now())
         limit 1`,
        [requestId]
      );
      if (!allowedRequest.rows[0]) {
        throw new Error("That prayer request is not available on the community board.");
      }
    }
    ({ startedAt, endedAt } = resolveSessionTimes({
      startedAt,
      endedAt,
      minutes: roundedMinutes,
      now
    }));
    if (startedAt.getTime() > endedAt.getTime()) {
      throw new Error("Prayer session start time must be before its end time.");
    }

    const session = await createPrayerSession({
      clientSessionId,
      userId: user?.id ?? null,
      promptId,
      requestId,
      focusLabel,
      minutes: roundedMinutes,
      startedAt,
      endedAt,
      entryType,
      notes
    });

    // Count a focus only after prayer time has been saved successfully. An
    // idempotent timer retry returns no row and therefore cannot count twice.
    if (session?.id && user) {
      try {
        if (requestId) {
          await markRequestPrayed({ requestId, userId: user.id });
        } else if (promptId) {
          await markPromptPrayed({ promptId, userId: user.id });
        }
      } catch {
        // The prayer session is authoritative; a secondary count must not make a successful save look failed.
      }
    }

    revalidatePath("/");
    revalidatePath("/auth");
    revalidatePath("/log");
    revalidatePath("/add-time");

    return { signedIn: Boolean(user), minutes: roundedMinutes };
}

export async function savePrayerSessionAction(formData: FormData): Promise<
  { ok: true; signedIn: boolean; minutes: number } | { ok: false; error: string }
> {
  try {
    const result = await savePrayerSession(formData);
    return { ok: true, ...result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not save prayer session."
    };
  }
}

export async function logPrayerSessionAction(formData: FormData) {
  try {
    const result = await savePrayerSession(formData);

    if (result.signedIn) {
      redirectWithQuery("/auth", { session_saved: "1" });
    }

    redirectWithQuery("/log", { saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/log", error, "Could not save prayer session.");
  }
}
