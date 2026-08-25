import { query } from "@/lib/postgres";
import { getPrayerFriendSlots } from "@/lib/prayer-friends";
import { getPrayerPeopleForUser } from "@/lib/pco-people";
import type { SessionFocus } from "@/lib/pray-links";
import { getPromptById } from "@/lib/prompts";
import { buildYouVersionEsvUrl } from "@/lib/youversion";
import type { StepPrompt } from "./acts-guide";

export type PrayerPageSearchParams = {
  request?: string;
  prompt?: string;
  focus_type?: string;
  focus_label?: string;
  saved?: string;
  error?: string;
  autostart?: string;
};

export type PersonalPrayerFocus = {
  kind: "person" | "group";
  label: string;
  members?: string[];
};

export function readPersonalFocus(params?: PrayerPageSearchParams) {
  return params?.focus_label?.trim() && (params.focus_type === "person" || params.focus_type === "group")
    ? { kind: params.focus_type, label: params.focus_label.trim() } as const
    : null;
}

export async function loadPersonalFocus(
  params: PrayerPageSearchParams | undefined,
  userId?: string | null
): Promise<PersonalPrayerFocus | null> {
  const focus = readPersonalFocus(params);
  if (!focus || focus.kind === "person" || !userId) return focus;

  let names: string[] = [];
  if (focus.label === "My Four Friends" || focus.label === "My Friends") {
    names = (await getPrayerFriendSlots(userId)).map((slot) => slot.name).filter(Boolean);
  } else if (focus.label === "My Household") {
    names = (await getPrayerPeopleForUser(userId, "family")).map((person) => person.name);
  } else if (focus.label === "My Church Family") {
    names = (await getPrayerPeopleForUser(userId, "friends")).map((person) => person.name);
  }

  return { ...focus, members: [...new Set(names)] };
}

export function toStepPrompt(
  prompt: {
    id: string;
    title: string;
    body: string;
    scriptureReference: string | null;
    scriptureText: string | null;
    tags?: string[] | null;
    category?: string | null;
  } | null
): StepPrompt | null {
  if (!prompt) return null;
  return {
    id: prompt.id,
    title: prompt.title,
    body: prompt.body,
    scriptureReference: prompt.scriptureReference,
    scriptureText: prompt.scriptureText,
    scriptureHref: prompt.scriptureReference ? buildYouVersionEsvUrl(prompt.scriptureReference) : null,
    tags: prompt.tags ?? (prompt.category ? [prompt.category] : [])
  };
}

export async function loadRequestFocus(requestId: string): Promise<SessionFocus | null> {
  const result = await query<{ id: string; title: string; body: string; category: string }>(
    `select id, title, body, category
     from prayer_requests
     where id = $1
       and visibility = 'church_anonymous'
       and status in ('open', 'praying', 'answered')
       and board_moderation = 'published'
       and (publish_at is null or publish_at <= now())
     limit 1`,
    [requestId]
  );
  const row = result.rows[0];
  return row ? { kind: "request", id: row.id, title: row.title, body: row.body, category: row.category } : null;
}

export async function loadPromptFocus(promptId: string): Promise<SessionFocus | null> {
  const prompt = await getPromptById(promptId);
  if (!prompt || !prompt.isActive) return null;
  return {
    kind: "prompt",
    id: prompt.id,
    title: prompt.title,
    body: prompt.body,
    category: prompt.category,
    tags: prompt.tags,
    scriptureReference: prompt.scriptureReference,
    scriptureText: prompt.scriptureText,
    scriptureHref: prompt.scriptureReference ? buildYouVersionEsvUrl(prompt.scriptureReference) : null
  };
}

export function guidedPrayerHref(params?: PrayerPageSearchParams) {
  const query = new URLSearchParams({ autostart: "1" });
  for (const key of ["request", "prompt", "focus_type", "focus_label"] as const) {
    const value = params?.[key]?.trim();
    if (value) query.set(key, value);
  }
  return `/guided-prayer?${query.toString()}`;
}
