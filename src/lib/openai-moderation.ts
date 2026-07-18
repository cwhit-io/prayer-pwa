import { getSetting, setSetting } from "@/lib/settings";

/**
 * OpenAI Moderation API (omni-moderation-latest).
 * Free endpoint; per-category review + block score routing.
 * @see https://platform.openai.com/docs/guides/moderation
 */

export type OpenAIModerationAction = "pass" | "review" | "block";

export type OpenAIModerationCategoryScore = {
  category: string;
  score: number;
  flagged: boolean;
  action: OpenAIModerationAction;
  urgent: boolean;
  recommendedAction: string | null;
  /** Configured review threshold for this category (null = none). */
  reviewThreshold: number | null;
  /** Configured block threshold for this category (null = never block). */
  blockThreshold: number | null;
};

export type OpenAIModerationResult = {
  configured: boolean;
  /** true when API was called successfully */
  ran: boolean;
  /** API error message when call failed (fail-open continues pipeline) */
  error: string | null;
  flagged: boolean;
  overallAction: OpenAIModerationAction;
  /** True when any matched category is marked urgent. */
  urgent: boolean;
  categories: OpenAIModerationCategoryScore[];
  /** Short labels for admin display, e.g. "openai:self-harm:0.82" */
  matchLabels: string[];
  summary: string | null;
};

/**
 * Per OpenAI category: review score, optional block score, pastoral guidance.
 * Block = null means never auto-block/discard for that category.
 */
export type CategoryThreshold = {
  category: string;
  /** Score at or above this → private review (null = no review from score). */
  review: number | null;
  /** Score at or above this → hard block (null = never auto-block). */
  block: number | null;
  recommendedAction: string;
  /** Prefer elevated “urgent” labeling in the review queue. */
  urgent: boolean;
};

export const DEFAULT_CATEGORY_THRESHOLDS: CategoryThreshold[] = [
  {
    category: "sexual/minors",
    review: 0.05,
    block: null,
    recommendedAction: "Urgent restricted review. Never auto-block/discard.",
    urgent: true
  },
  {
    category: "self-harm/intent",
    review: 0.15,
    block: null,
    recommendedAction: "Urgent review + show crisis message.",
    urgent: true
  },
  {
    category: "self-harm/instructions",
    review: 0.1,
    block: null,
    recommendedAction: "Urgent review.",
    urgent: true
  },
  {
    category: "self-harm",
    review: 0.25,
    block: null,
    recommendedAction: "Pastoral review; urgent if phrase override also matches.",
    urgent: false
  },
  {
    category: "harassment/threatening",
    review: 0.25,
    block: null,
    recommendedAction: "Urgent or moderator review, depending on context.",
    urgent: true
  },
  {
    category: "hate/threatening",
    review: 0.2,
    block: null,
    recommendedAction: "Urgent/moderator review.",
    urgent: true
  },
  {
    category: "violence",
    review: 0.45,
    block: 0.9,
    recommendedAction: "Review unless clearly graphic/threatening.",
    urgent: false
  },
  {
    category: "violence/graphic",
    review: 0.35,
    block: 0.8,
    recommendedAction: "Review; block/reword if gratuitous.",
    urgent: false
  },
  {
    category: "sexual",
    review: 0.35,
    block: 0.85,
    recommendedAction: "Sensitive review; block/reword if vulgar or explicit.",
    urgent: false
  },
  {
    category: "harassment",
    review: 0.55,
    block: 0.85,
    recommendedAction: "Ask to reword if insulting/hostile.",
    urgent: false
  },
  {
    category: "hate",
    review: 0.4,
    block: 0.8,
    recommendedAction: "Moderator review; block/reword for slurs or attacks.",
    urgent: false
  },
  {
    category: "illicit",
    review: 0.55,
    block: 0.9,
    recommendedAction: "Review; block if requesting wrongdoing instructions.",
    urgent: false
  },
  {
    category: "illicit/violent",
    review: 0.2,
    block: 0.7,
    recommendedAction: "Urgent/moderator review.",
    urgent: true
  }
];

export type OpenAIModerationThresholds = {
  categories: CategoryThreshold[];
  /**
   * When OpenAI sets overall `flagged` but no category crosses our thresholds,
   * still hold for private review.
   */
  flaggedMeansReview: boolean;
};

export const DEFAULT_OPENAI_THRESHOLDS: OpenAIModerationThresholds = {
  categories: DEFAULT_CATEGORY_THRESHOLDS.map((row) => ({ ...row })),
  flaggedMeansReview: true
};

const THRESHOLDS_SETTING_KEY = "openai_moderation_thresholds";

function clamp01(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, n));
}

/** Parse a score field; empty / "n/a" / null → null (disabled). */
export function parseOptionalScore(value: unknown, fallback: number | null): number | null {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed || trimmed === "n/a" || trimmed === "na" || trimmed === "none") {
      return null;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      return fallback;
    }
    return Math.min(1, Math.max(0, n));
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return Math.min(1, Math.max(0, value));
  }
  return fallback;
}

function defaultRow(category: string): CategoryThreshold {
  return (
    DEFAULT_CATEGORY_THRESHOLDS.find((row) => row.category === category) ?? {
      category,
      review: 0.5,
      block: null,
      recommendedAction: "Moderator review.",
      urgent: false
    }
  );
}

/**
 * Normalize stored or form thresholds into the current category table.
 * Migrates legacy `{ block, review, sexualHardBlock }` shapes when present.
 */
export function mergeOpenAIThresholds(partial: unknown): OpenAIModerationThresholds {
  if (!partial || typeof partial !== "object") {
    return {
      categories: DEFAULT_CATEGORY_THRESHOLDS.map((row) => ({ ...row })),
      flaggedMeansReview: true
    };
  }

  const obj = partial as Record<string, unknown>;
  const flaggedMeansReview =
    typeof obj.flaggedMeansReview === "boolean" ? obj.flaggedMeansReview : true;

  // New shape: { categories: [...] }
  if (Array.isArray(obj.categories)) {
    const byCat = new Map<string, Partial<CategoryThreshold>>();
    for (const entry of obj.categories) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const row = entry as Record<string, unknown>;
      const category = typeof row.category === "string" ? row.category : null;
      if (!category) {
        continue;
      }
      byCat.set(category, {
        category,
        review: parseOptionalScore(row.review, defaultRow(category).review),
        block: parseOptionalScore(row.block, defaultRow(category).block),
        recommendedAction:
          typeof row.recommendedAction === "string" && row.recommendedAction.trim()
            ? row.recommendedAction.trim()
            : defaultRow(category).recommendedAction,
        urgent: typeof row.urgent === "boolean" ? row.urgent : defaultRow(category).urgent
      });
    }

    return {
      flaggedMeansReview,
      categories: DEFAULT_CATEGORY_THRESHOLDS.map((def) => {
        const saved = byCat.get(def.category);
        if (!saved) {
          return { ...def };
        }
        return {
          category: def.category,
          review: saved.review ?? def.review,
          block: saved.block === undefined ? def.block : saved.block,
          recommendedAction: saved.recommendedAction ?? def.recommendedAction,
          urgent: saved.urgent ?? def.urgent
        };
      })
    };
  }

  // Legacy shape: { block: {}, review: {}, sexualHardBlock }
  const legacyBlock =
    obj.block && typeof obj.block === "object" ? (obj.block as Record<string, unknown>) : {};
  const legacyReview =
    obj.review && typeof obj.review === "object" ? (obj.review as Record<string, unknown>) : {};
  const sexualHardBlock =
    obj.sexualHardBlock !== undefined ? clamp01(obj.sexualHardBlock, 0.85) : null;

  return {
    flaggedMeansReview,
    categories: DEFAULT_CATEGORY_THRESHOLDS.map((def) => {
      let block = parseOptionalScore(legacyBlock[def.category], def.block);
      const review = parseOptionalScore(legacyReview[def.category], def.review);
      if (def.category === "sexual" && sexualHardBlock !== null && block === def.block) {
        block = sexualHardBlock;
      }
      // sexual/minors and self-harm* must never hard-block even if legacy data had a block score.
      if (
        def.category === "sexual/minors" ||
        def.category.startsWith("self-harm") ||
        def.block === null
      ) {
        if (def.block === null) {
          block = null;
        }
      }
      return {
        ...def,
        review,
        block: def.block === null ? null : block
      };
    })
  };
}

export async function getOpenAIModerationThresholds(): Promise<OpenAIModerationThresholds> {
  const raw = await getSetting(THRESHOLDS_SETTING_KEY);
  if (!raw) {
    return mergeOpenAIThresholds(null);
  }
  try {
    return mergeOpenAIThresholds(JSON.parse(raw));
  } catch {
    return mergeOpenAIThresholds(null);
  }
}

export async function saveOpenAIModerationThresholds(
  thresholds: OpenAIModerationThresholds
): Promise<OpenAIModerationThresholds> {
  const cleaned = mergeOpenAIThresholds(thresholds);
  await setSetting(THRESHOLDS_SETTING_KEY, JSON.stringify(cleaned));
  return cleaned;
}

export async function getOpenAIApiKey(): Promise<{
  apiKey: string | null;
  configured: boolean;
  source: "database" | "environment" | "none";
}> {
  const fromDb = await getSetting("openai_api_key");
  const fromEnv = process.env.OPENAI_API_KEY || null;
  const apiKey = fromDb || fromEnv;
  return {
    apiKey,
    configured: Boolean(apiKey),
    source: fromDb ? "database" : fromEnv ? "environment" : "none"
  };
}

function scoreAction(
  category: string,
  score: number,
  flagged: boolean,
  thresholds: OpenAIModerationThresholds
): { action: OpenAIModerationAction; urgent: boolean; recommendedAction: string | null } {
  const row = thresholds.categories.find((c) => c.category === category);
  if (!row) {
    // Unknown category from API: if OpenAI flagged it, hold for review.
    return {
      action: flagged ? "review" : "pass",
      urgent: false,
      recommendedAction: flagged ? "OpenAI flagged an unlisted category — moderator review." : null
    };
  }

  // Hard block only when block threshold is set and score crosses it.
  // OpenAI category flags alone never hard-block when block is null (e.g. sexual/minors, self-harm).
  if (row.block !== null && score >= row.block) {
    return {
      action: "block",
      urgent: row.urgent,
      recommendedAction: row.recommendedAction
    };
  }

  if (row.review !== null && (score >= row.review || flagged)) {
    return {
      action: "review",
      urgent: row.urgent,
      recommendedAction: row.recommendedAction
    };
  }

  // Flagged by OpenAI for this category but below review threshold — still review if threshold set.
  if (flagged && row.review !== null) {
    return {
      action: "review",
      urgent: row.urgent,
      recommendedAction: row.recommendedAction
    };
  }

  return { action: "pass", urgent: false, recommendedAction: null };
}

function pickOverallAction(actions: OpenAIModerationAction[]): OpenAIModerationAction {
  if (actions.includes("block")) {
    return "block";
  }
  if (actions.includes("review")) {
    return "review";
  }
  return "pass";
}

type OpenAIModerationApiResponse = {
  results?: Array<{
    flagged?: boolean;
    categories?: Record<string, boolean>;
    category_scores?: Record<string, number>;
  }>;
  error?: { message?: string };
};

/**
 * Call OpenAI Moderations. Fail-open: if not configured or API errors,
 * returns overallAction "pass" so keyword lists still protect the board.
 */
export async function runOpenAIModeration(text: string): Promise<OpenAIModerationResult> {
  const empty: OpenAIModerationResult = {
    configured: false,
    ran: false,
    error: null,
    flagged: false,
    overallAction: "pass",
    urgent: false,
    categories: [],
    matchLabels: [],
    summary: null
  };

  const [{ apiKey, configured }, thresholds] = await Promise.all([
    getOpenAIApiKey(),
    getOpenAIModerationThresholds()
  ]);

  if (!configured || !apiKey) {
    return { ...empty, configured: false };
  }

  const input = text.trim().slice(0, 30_000);
  if (!input) {
    return { ...empty, configured: true, ran: true };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input
      }),
      signal: AbortSignal.timeout(12_000)
    });

    const data = (await response.json()) as OpenAIModerationApiResponse;

    if (!response.ok) {
      const message = data.error?.message || `OpenAI moderation HTTP ${response.status}`;
      console.error("[openai-moderation]", message);
      return {
        ...empty,
        configured: true,
        ran: false,
        error: message,
        summary: `OpenAI moderation unavailable: ${message}`
      };
    }

    const result = data.results?.[0];
    if (!result) {
      return {
        ...empty,
        configured: true,
        ran: true,
        error: "Empty moderation result",
        summary: "OpenAI returned no moderation result."
      };
    }

    const scores = result.category_scores ?? {};
    const categoryFlags = result.categories ?? {};

    const known = new Set([
      ...thresholds.categories.map((c) => c.category),
      ...Object.keys(scores),
      ...Object.keys(categoryFlags)
    ]);

    // Always keep every known category with its score (including clean passes)
    // so the admin tester can show full OpenAI values.
    const categories: OpenAIModerationCategoryScore[] = Array.from(known)
      .map((category) => {
        const score = Number(scores[category] ?? 0);
        const flagged = Boolean(categoryFlags[category]);
        const decided = scoreAction(category, score, flagged, thresholds);
        const row = thresholds.categories.find((c) => c.category === category);
        return {
          category,
          score,
          flagged,
          action: decided.action,
          urgent: decided.urgent && decided.action !== "pass",
          recommendedAction: decided.action !== "pass" ? decided.recommendedAction : null,
          reviewThreshold: row?.review ?? null,
          blockThreshold: row?.block ?? null
        };
      })
      .sort((a, b) => b.score - a.score);

    const overallAction = pickOverallAction(categories.map((c) => c.action));
    const actionable = categories.filter((c) => c.action !== "pass");
    const urgent = actionable.some((c) => c.urgent);
    const matchLabels = actionable.map((c) => {
      const tag = c.urgent ? "urgent" : c.action;
      return `openai:${c.category}:${c.score.toFixed(2)}:${tag}`;
    });

    const summaryParts = actionable.map((c) => {
      const tip = c.recommendedAction ? ` (${c.recommendedAction})` : "";
      return `${c.category}=${c.score.toFixed(2)}→${c.action}${c.urgent ? "/urgent" : ""}${tip}`;
    });

    const topScores = categories
      .slice(0, 4)
      .map((c) => `${c.category}=${c.score.toFixed(3)}`)
      .join(", ");

    const summary =
      summaryParts.length > 0
        ? `OpenAI moderation → ${overallAction}${urgent ? " (urgent)" : ""}: ${summaryParts.join("; ")}`
        : result.flagged
          ? "OpenAI flagged content (no category above our thresholds)."
          : topScores
            ? `OpenAI pass — top scores: ${topScores}`
            : "OpenAI pass — all category scores near zero.";

    const finalAction =
      overallAction === "pass" && result.flagged && thresholds.flaggedMeansReview
        ? "review"
        : overallAction;

    return {
      configured: true,
      ran: true,
      error: null,
      flagged: Boolean(result.flagged) || finalAction !== "pass",
      overallAction: finalAction,
      urgent: finalAction !== "pass" && urgent,
      categories,
      matchLabels:
        finalAction !== "pass" && matchLabels.length === 0
          ? ["openai:flagged"]
          : matchLabels,
      summary:
        finalAction !== "pass" && !summary
          ? "OpenAI flagged content for review."
          : summary
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI moderation failed";
    console.error("[openai-moderation]", message);
    return {
      ...empty,
      configured: true,
      ran: false,
      error: message,
      summary: `OpenAI moderation unavailable: ${message}`
    };
  }
}
