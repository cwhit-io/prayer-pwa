import { query } from "@/lib/postgres";
import { getTagsForActsPrompts, replaceActsPromptTags } from "@/lib/tags";

export const actsSteps = [
  { step: "A" as const, name: "Adoration", focus: "Worship God for who He is" },
  { step: "C" as const, name: "Confession", focus: "Be honest before Him" },
  { step: "T" as const, name: "Thanksgiving", focus: "Name His gifts" }
];

export type ActsStepLetter = "A" | "C" | "T";

export type ActsPrompt = {
  id: string;
  step: ActsStepLetter;
  title: string;
  body: string;
  scriptureReference: string | null;
  scriptureText: string | null;
  isActive: boolean;
  tags: string[];
};

type ActsPromptRow = {
  id: string;
  step: ActsStepLetter;
  title: string;
  body: string;
  scripture_reference: string | null;
  scripture_text: string | null;
  is_active: boolean;
};

function mapPrompt(row: ActsPromptRow, tags: string[] = []): ActsPrompt {
  return {
    id: row.id,
    step: row.step,
    title: row.title,
    body: row.body,
    scriptureReference: row.scripture_reference,
    scriptureText: row.scripture_text,
    isActive: row.is_active,
    tags
  };
}

async function attachTags(prompts: ActsPrompt[]): Promise<ActsPrompt[]> {
  if (prompts.length === 0) {
    return prompts;
  }
  const tagMap = await getTagsForActsPrompts(prompts.map((p) => p.id));
  return prompts.map((prompt) => ({
    ...prompt,
    tags: tagMap.get(prompt.id) ?? []
  }));
}

/**
 * Random ACTS prompt for a step.
 * When preferredTagIds are provided, prefer prompts that share tags (fuzzy: higher
 * overlap ranks first; zero overlap still eligible so steps always fill).
 */
export async function getRandomActsPrompt(
  step: ActsStepLetter,
  excludeId?: string | null,
  preferredTagIds?: string[] | null
) {
  const tagIds = preferredTagIds?.filter(Boolean) ?? [];

  const result = await query<ActsPromptRow>(
    `select a.id, a.step, a.title, a.body, a.scripture_reference, a.scripture_text, a.is_active
     from acts_prompts a
     where a.step = $1
       and a.is_active = true
       and ($2::uuid is null or a.id <> $2)
     order by
       case
         when cardinality($3::uuid[]) = 0 then 0
         else (
           select count(*)::int
           from acts_prompt_tags t
           where t.acts_prompt_id = a.id
             and t.tag_id = any($3::uuid[])
         )
       end desc,
       random()
     limit 1`,
    [step, excludeId ?? null, tagIds]
  );

  if (result.rows[0]) {
    const [withTags] = await attachTags([mapPrompt(result.rows[0])]);
    return withTags;
  }

  if (excludeId) {
    return getRandomActsPrompt(step, null, preferredTagIds);
  }

  return null;
}

export async function getRandomActsPromptSet(preferredTagIds?: string[] | null) {
  const [adoration, confession, thanksgiving] = await Promise.all([
    getRandomActsPrompt("A", null, preferredTagIds),
    getRandomActsPrompt("C", null, preferredTagIds),
    getRandomActsPrompt("T", null, preferredTagIds)
  ]);

  return {
    A: adoration,
    C: confession,
    T: thanksgiving
  };
}

export async function listActsPrompts() {
  const result = await query<ActsPromptRow>(
    `select id, step, title, body, scripture_reference, scripture_text, is_active
     from acts_prompts
     order by step, created_at desc
     limit 500`
  );

  return attachTags(result.rows.map((row) => mapPrompt(row)));
}

export async function listAllActsPromptsForExport() {
  const result = await query<ActsPromptRow>(
    `select id, step, title, body, scripture_reference, scripture_text, is_active
     from acts_prompts
     order by step, created_at desc`
  );
  return attachTags(result.rows.map((row) => mapPrompt(row)));
}

export type ActsImportRow = {
  step: ActsStepLetter;
  title: string;
  body: string;
  scriptureReference: string | null;
  scriptureText: string | null;
  isActive: boolean;
  tags?: string[];
};

async function insertActsPromptRows(rows: ActsImportRow[]) {
  for (const row of rows) {
    const inserted = await query<{ id: string }>(
      `insert into acts_prompts (step, title, body, scripture_reference, scripture_text, is_active)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [
        row.step,
        row.title,
        row.body,
        row.scriptureReference,
        row.scriptureText,
        row.isActive
      ]
    );
    await replaceActsPromptTags(inserted.rows[0].id, row.tags ?? []);
  }
  return { count: rows.length };
}

/** Replace all ACTS prompts with CSV rows. */
export async function replaceActsPromptsFromRows(rows: ActsImportRow[]) {
  if (rows.length === 0) {
    throw new Error("CSV has no data rows. Keep the header and at least one prompt.");
  }

  await query(`delete from acts_prompts`);
  return insertActsPromptRows(rows);
}

/** Append CSV rows without deleting existing ACTS prompts. */
export async function appendActsPromptsFromRows(rows: ActsImportRow[]) {
  if (rows.length === 0) {
    throw new Error("CSV has no data rows. Keep the header and at least one prompt.");
  }

  return insertActsPromptRows(rows);
}

/** Parse A/C/T or full names (Adoration / Confession / Thanksgiving). */
export function parseActsStepLetter(value: string): ActsStepLetter | null {
  const raw = value.replace(/^\uFEFF/, "").trim().toLowerCase();
  if (!raw) {
    return null;
  }

  if (raw === "a" || raw === "adoration" || raw.startsWith("adoration")) {
    return "A";
  }
  if (raw === "c" || raw === "confession" || raw.startsWith("confession")) {
    return "C";
  }
  if (raw === "t" || raw === "thanksgiving" || raw.startsWith("thanksgiving")) {
    return "T";
  }

  const letter = raw.match(/\b([act])\b/i)?.[1]?.toUpperCase();
  if (letter === "A" || letter === "C" || letter === "T") {
    return letter;
  }

  return null;
}

export async function createActsPrompt(input: {
  step: ActsStepLetter;
  title: string;
  body: string;
  scriptureReference: string | null;
  scriptureText: string | null;
  isActive: boolean;
  tags?: string[];
}) {
  const result = await query<{ id: string }>(
    `insert into acts_prompts (step, title, body, scripture_reference, scripture_text, is_active)
     values ($1, $2, $3, $4, $5, $6)
     returning id`,
    [
      input.step,
      input.title,
      input.body,
      input.scriptureReference,
      input.scriptureText,
      input.isActive
    ]
  );

  await replaceActsPromptTags(result.rows[0].id, input.tags ?? []);
  return result.rows[0];
}

export async function updateActsPrompt(input: {
  id: string;
  step: ActsStepLetter;
  title: string;
  body: string;
  scriptureReference: string | null;
  scriptureText: string | null;
  isActive: boolean;
  tags?: string[];
}) {
  await query(
    `update acts_prompts
     set step = $2,
         title = $3,
         body = $4,
         scripture_reference = $5,
         scripture_text = $6,
         is_active = $7
     where id = $1`,
    [
      input.id,
      input.step,
      input.title,
      input.body,
      input.scriptureReference,
      input.scriptureText,
      input.isActive
    ]
  );

  // `tags` may be [] to clear; only skip when omitted.
  if (input.tags !== undefined) {
    await replaceActsPromptTags(input.id, input.tags);
  }
}

export async function setActsPromptActive(input: { id: string; isActive: boolean }) {
  await query(`update acts_prompts set is_active = $2 where id = $1`, [input.id, input.isActive]);
}
