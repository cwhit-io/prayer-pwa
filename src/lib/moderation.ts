import { query } from "@/lib/postgres";
import { runOpenAIModeration, type OpenAIModerationResult } from "@/lib/openai-moderation";

export type ModerationKeyword = {
  id: string;
  keyword: string;
  isActive: boolean;
  notes: string | null;
};

/** Random delay for community board posts that pass all checks (minutes). */
export const BOARD_DELAY_MIN_MINUTES = 15;
export const BOARD_DELAY_MAX_MINUTES = 6 * 60; // 6 hours

/**
 * User-facing message when hard-blocked (profanity / spam / vulgar).
 * Do not reveal which terms matched.
 */
export const BLOCKLIST_REJECT_MESSAGE = "Please reword this before submitting.";

/**
 * User-facing message when OpenAI hard-blocks (e.g. sexual/minors).
 * Same tone — do not reveal category details.
 */
export const OPENAI_BLOCK_MESSAGE = "Please reword this before submitting.";

export function randomBoardPublishAt(from = new Date()) {
  const span = BOARD_DELAY_MAX_MINUTES - BOARD_DELAY_MIN_MINUTES;
  const minutes = BOARD_DELAY_MIN_MINUTES + Math.floor(Math.random() * (span + 1));
  return new Date(from.getTime() + minutes * 60_000);
}

export async function listModerationKeywords(options?: { activeOnly?: boolean }) {
  const activeOnly = options?.activeOnly ?? false;
  const result = await query<{
    id: string;
    keyword: string;
    is_active: boolean;
    notes: string | null;
  }>(
    `select id, keyword, is_active, notes
     from moderation_keywords
     ${activeOnly ? "where is_active = true" : ""}
     order by keyword asc`
  );

  return result.rows.map(
    (row): ModerationKeyword => ({
      id: row.id,
      keyword: row.keyword,
      isActive: row.is_active,
      notes: row.notes
    })
  );
}

export async function listModerationBlocklist(options?: { activeOnly?: boolean }) {
  const activeOnly = options?.activeOnly ?? false;
  const result = await query<{
    id: string;
    keyword: string;
    is_active: boolean;
    notes: string | null;
  }>(
    `select id, keyword, is_active, notes
     from moderation_blocklist
     ${activeOnly ? "where is_active = true" : ""}
     order by keyword asc`
  );

  return result.rows.map(
    (row): ModerationKeyword => ({
      id: row.id,
      keyword: row.keyword,
      isActive: row.is_active,
      notes: row.notes
    })
  );
}

export async function addModerationKeyword(input: { keyword: string; notes?: string | null }) {
  const keyword = input.keyword.trim().toLowerCase();
  if (!keyword) {
    throw new Error("Keyword is required.");
  }

  await query(
    `insert into moderation_keywords (keyword, notes, is_active)
     values ($1, $2, true)
     on conflict (keyword) do update
     set is_active = true,
         notes = coalesce(excluded.notes, moderation_keywords.notes)`,
    [keyword, input.notes?.trim() || null]
  );
}

export async function setModerationKeywordActive(input: { id: string; isActive: boolean }) {
  await query(`update moderation_keywords set is_active = $2 where id = $1`, [
    input.id,
    input.isActive
  ]);
}

export async function deleteModerationKeyword(id: string) {
  await query(`delete from moderation_keywords where id = $1`, [id]);
}

/** Parse a simple comma- or semicolon-separated keyword list. */
export function parseModerationKeywordList(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[,;]+/)
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
}

/**
 * Replace the full church-leadership / supplemental review list.
 * All keywords are stored active; notes are cleared on full replace.
 */
export async function replaceModerationKeywordsFromList(keywords: string[]) {
  const cleaned = Array.from(
    new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  await query(`delete from moderation_keywords`);

  for (const keyword of cleaned) {
    await query(
      `insert into moderation_keywords (keyword, is_active, notes)
       values ($1, true, null)`,
      [keyword]
    );
  }

  return { count: cleaned.length };
}

/** Replace the full hard-block list from a plain text list. */
export async function replaceModerationBlocklistFromList(keywords: string[]) {
  const cleaned = Array.from(
    new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  await query(`delete from moderation_blocklist`);

  for (const keyword of cleaned) {
    await query(
      `insert into moderation_blocklist (keyword, is_active, notes)
       values ($1, true, null)`,
      [keyword]
    );
  }

  return { count: cleaned.length };
}

/** Replace entire keyword list from CSV rows (full replace). */
export async function replaceModerationKeywordsFromRows(
  rows: Array<{ keyword: string; isActive: boolean; notes: string | null }>
) {
  if (rows.length === 0) {
    throw new Error("CSV has no data rows. Keep the header and at least one keyword.");
  }

  const byKeyword = new Map<string, { keyword: string; isActive: boolean; notes: string | null }>();
  for (const row of rows) {
    const keyword = row.keyword.trim().toLowerCase();
    if (!keyword) {
      continue;
    }
    byKeyword.set(keyword, {
      keyword,
      isActive: row.isActive,
      notes: row.notes?.trim() || null
    });
  }

  if (byKeyword.size === 0) {
    throw new Error("CSV has no valid keywords.");
  }

  await query(`delete from moderation_keywords`);

  for (const row of byKeyword.values()) {
    await query(
      `insert into moderation_keywords (keyword, is_active, notes)
       values ($1, $2, $3)`,
      [row.keyword, row.isActive, row.notes]
    );
  }

  return { count: byKeyword.size };
}

function normalizeForKeywordMatch(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchTermsInText(text: string, terms: Array<{ keyword: string }>) {
  const haystack = ` ${normalizeForKeywordMatch(text)} `;
  const matched: string[] = [];

  for (const entry of terms) {
    const needle = normalizeForKeywordMatch(entry.keyword);
    if (!needle) {
      continue;
    }

    if (
      haystack.includes(` ${needle} `) ||
      haystack.includes(` ${needle}-`) ||
      haystack.includes(`-${needle} `)
    ) {
      matched.push(entry.keyword);
      continue;
    }

    if (needle.includes(" ") && haystack.includes(needle)) {
      matched.push(entry.keyword);
    }
  }

  return matched;
}

/** Church leadership / supplemental review terms. */
export async function findMatchedKeywords(text: string) {
  const keywords = await listModerationKeywords({ activeOnly: true });
  return matchTermsInText(text, keywords);
}

/** Hard-block terms (profanity / spam). */
export async function findMatchedBlocklist(text: string) {
  const terms = await listModerationBlocklist({ activeOnly: true });
  return matchTermsInText(text, terms);
}

/**
 * Tier 1: hard-reject when blocklist matches.
 * Throws BLOCKLIST_REJECT_MESSAGE (does not name the matched terms).
 */
export async function assertRequestNotBlocked(input: { title: string; body: string }) {
  const matched = await findMatchedBlocklist(`${input.title}\n${input.body}`);
  if (matched.length > 0) {
    throw new Error(BLOCKLIST_REJECT_MESSAGE);
  }
  return matched;
}

export type BoardModerationDecision = {
  boardModeration: "pending_review" | "published";
  publishAt: Date | null;
  matchedKeywords: string[];
  moderationNotes: string | null;
  notice: "review" | "delayed" | "private" | "private_review";
  openai: OpenAIModerationResult | null;
  sources: Array<"openai" | "leadership">;
};

/** Dry-run outcome for the admin moderation tester (never throws). */
export type ModerationPreview = {
  outcome: "block" | "pending_review" | "delayed_publish" | "private_ok" | "private_review";
  /** What the submitter would see (blocks only). */
  userMessage: string | null;
  /** Plain-language what would happen. */
  whatWouldHappen: string;
  boardModeration: "pending_review" | "published" | "not_saved";
  publishAt: string | null;
  matchedKeywords: string[];
  moderationNotes: string | null;
  notice: "review" | "delayed" | "private" | "private_review" | "blocked" | null;
  visibility: "church_anonymous" | "prayer_team";
  tiers: {
    blocklist: {
      action: "block" | "pass";
      matched: string[];
    };
    openai: {
      action: "block" | "review" | "pass" | "skipped";
      configured: boolean;
      ran: boolean;
      error: string | null;
      summary: string | null;
      matchLabels: string[];
      urgent: boolean;
      categories: Array<{
        category: string;
        score: number;
        flagged: boolean;
        action: "block" | "review" | "pass";
        urgent: boolean;
        recommendedAction: string | null;
        reviewThreshold: number | null;
        blockThreshold: number | null;
      }>;
    };
    leadership: {
      action: "review" | "pass";
      matched: string[];
    };
  };
};

/**
 * Dry-run the full moderation pipeline for admin testing.
 * Does not throw, does not write to the database.
 */
export async function previewModeration(input: {
  title: string;
  body: string;
  visibility?: "church_anonymous" | "prayer_team";
}): Promise<ModerationPreview> {
  const title = input.title.trim();
  const body = input.body.trim();
  const visibility = input.visibility ?? "church_anonymous";
  const isCommunity = visibility === "church_anonymous";
  const text = `${title}\n${body}`;

  const blockMatches = await findMatchedBlocklist(text);
  if (blockMatches.length > 0) {
    return {
      outcome: "block",
      userMessage: BLOCKLIST_REJECT_MESSAGE,
      whatWouldHappen:
        "Hard block list matched. Request would NOT be saved. User sees “Please reword this before submitting.”",
      boardModeration: "not_saved",
      publishAt: null,
      matchedKeywords: blockMatches.map((k) => `blocklist:${k}`),
      moderationNotes: null,
      notice: "blocked",
      visibility,
      tiers: {
        blocklist: { action: "block", matched: blockMatches },
        openai: {
          action: "skipped",
          configured: false,
          ran: false,
          error: null,
          summary: "Not run — blocked at tier 1.",
          matchLabels: [],
          urgent: false,
          categories: []
        },
        leadership: { action: "pass", matched: [] }
      }
    };
  }

  const openai = await runOpenAIModeration(text);

  if (openai.overallAction === "block") {
    return {
      outcome: "block",
      userMessage: OPENAI_BLOCK_MESSAGE,
      whatWouldHappen:
        "OpenAI Moderation would hard-block this text. Request would NOT be saved. User sees “Please reword this before submitting.”",
      boardModeration: "not_saved",
      publishAt: null,
      matchedKeywords: openai.matchLabels,
      moderationNotes: openai.summary,
      notice: "blocked",
      visibility,
      tiers: {
        blocklist: { action: "pass", matched: [] },
        openai: {
          action: "block",
          configured: openai.configured,
          ran: openai.ran,
          error: openai.error,
          summary: openai.summary,
          matchLabels: openai.matchLabels,
          urgent: openai.urgent,
          categories: openai.categories
        },
        leadership: { action: "pass", matched: [] }
      }
    };
  }

  const leadershipMatches = await findMatchedKeywords(text);
  const matchLabels: string[] = [];
  const noteParts: string[] = [];
  const sources: Array<"openai" | "leadership"> = [];

  if (openai.overallAction === "review") {
    sources.push("openai");
    matchLabels.push(...openai.matchLabels);
    if (openai.summary) {
      noteParts.push(openai.summary);
    }
  }

  if (leadershipMatches.length > 0) {
    sources.push("leadership");
    matchLabels.push(...leadershipMatches.map((k) => `leadership:${k}`));
    noteParts.push(
      `Leadership supplemental list: ${leadershipMatches.slice(0, 12).join(", ")}${
        leadershipMatches.length > 12 ? "…" : ""
      }`
    );
  }

  const needsReview = sources.length > 0;
  const openaiTierAction: ModerationPreview["tiers"]["openai"]["action"] = !openai.configured
    ? "skipped"
    : openai.error
      ? "skipped"
      : openai.overallAction;

  const openaiTier = {
    action: openaiTierAction,
    configured: openai.configured,
    ran: openai.ran,
    error: openai.error,
    summary: openai.summary,
    matchLabels: openai.matchLabels,
    urgent: openai.urgent,
    categories: openai.categories
  };

  if (needsReview) {
    const boardModeration = isCommunity ? ("pending_review" as const) : ("published" as const);
    const urgentNote = openai.urgent ? " Marked URGENT for care/restricted review." : "";
    return {
      outcome: isCommunity ? "pending_review" : "private_review",
      userMessage: null,
      whatWouldHappen: isCommunity
        ? `Request would be saved and held in the private review queue (not on the community board). Triggered by: ${sources.join(" + ")}.${urgentNote}`
        : `Request would be saved for private prayer team care, flagged for leadership attention. Triggered by: ${sources.join(" + ")}.${urgentNote}`,
      boardModeration,
      publishAt: null,
      matchedKeywords: matchLabels,
      moderationNotes: noteParts.join(" | ") || "Held for private review.",
      notice: isCommunity ? "review" : "private_review",
      visibility,
      tiers: {
        blocklist: { action: "pass", matched: [] },
        openai: openaiTier,
        leadership: {
          action: leadershipMatches.length > 0 ? "review" : "pass",
          matched: leadershipMatches
        }
      }
    };
  }

  if (!isCommunity) {
    return {
      outcome: "private_ok",
      userMessage: null,
      whatWouldHappen: "Request would be saved and shared privately with the prayer team. No review hold.",
      boardModeration: "published",
      publishAt: null,
      matchedKeywords: [],
      moderationNotes: null,
      notice: "private",
      visibility,
      tiers: {
        blocklist: { action: "pass", matched: [] },
        openai: openaiTier,
        leadership: { action: "pass", matched: [] }
      }
    };
  }

  const publishAt = randomBoardPublishAt();
  return {
    outcome: "delayed_publish",
    userMessage: null,
    whatWouldHappen: `Clean community post — would be scheduled for delayed board publish around ${publishAt.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    })} (random ${BOARD_DELAY_MIN_MINUTES}–${Math.round(BOARD_DELAY_MAX_MINUTES / 60)}h delay).`,
    boardModeration: "published",
    publishAt: publishAt.toISOString(),
    matchedKeywords: [],
    moderationNotes: "Scheduled for delayed community board publish.",
    notice: "delayed",
    visibility,
    tiers: {
      blocklist: { action: "pass", matched: [] },
      openai: openaiTier,
      leadership: { action: "pass", matched: [] }
    }
  };
}

/**
 * Full moderation pipeline after hard blocklist:
 *   2) OpenAI Moderation API — score-based block / private review / pass
 *   3) Church leadership supplemental list — private review queue
 *   4) Clean community posts get a random delayed publish
 *
 * OpenAI hard-block throws OPENAI_BLOCK_MESSAGE (nothing stored).
 * Review holds always save the request for pastoral care / leadership.
 */
export async function decideBoardModeration(input: {
  visibility: string;
  title: string;
  body: string;
}): Promise<BoardModerationDecision> {
  const preview = await previewModeration({
    title: input.title,
    body: input.body,
    visibility:
      input.visibility === "prayer_team" ? "prayer_team" : "church_anonymous"
  });

  if (preview.outcome === "block") {
    throw new Error(preview.userMessage ?? BLOCKLIST_REJECT_MESSAGE);
  }

  return {
    boardModeration: preview.boardModeration === "not_saved" ? "pending_review" : preview.boardModeration,
    publishAt: preview.publishAt ? new Date(preview.publishAt) : null,
    matchedKeywords: preview.matchedKeywords,
    moderationNotes: preview.moderationNotes,
    notice:
      preview.notice === "blocked" || preview.notice === null
        ? "private"
        : preview.notice,
    openai: null,
    sources: [
      ...(preview.tiers.openai.action === "review" ? (["openai"] as const) : []),
      ...(preview.tiers.leadership.action === "review" ? (["leadership"] as const) : [])
    ]
  };
}
