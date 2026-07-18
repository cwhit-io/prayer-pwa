import { query } from "@/lib/postgres";
import { getActivePromptTagNames, getTagsForPrayerPrompts, replacePrayerPromptTags } from "@/lib/tags";

/** @deprecated Prefer getActivePromptTagNames() — kept for static fallbacks. */
export const promptCategories = [
  "Personal renewal",
  "Family",
  "Church",
  "Fort Wayne",
  "Schools",
  "Missions",
  "Leaders",
  "Lost people",
  "Healing"
] as const;

/** @deprecated Use getActivePromptTagNames */
export { getActivePromptTagNames as getActivePromptCategoryNames };
export { getActivePromptTagNames };

export type PrayerPrompt = {
  id: string;
  title: string;
  scriptureReference: string | null;
  scriptureText: string | null;
  body: string;
  /** Denormalized primary tag (first tag) for legacy display. */
  category: string;
  /** Shared multi-tags (campaign + ACTS vocabulary). */
  tags: string[];
  publishDate: string;
  isActive: boolean;
  /** Total times this prompt has been prayed (not unique people). */
  prayerCount?: number;
};

type PrayerPromptRow = {
  id: string;
  title: string;
  scripture_reference: string | null;
  scripture_text: string | null;
  body: string;
  category: string;
  publish_date: string | Date;
  is_active: boolean;
};

function formatDateValue(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value;
}

function mapPrompt(row: PrayerPromptRow, tags: string[] = []): PrayerPrompt {
  const resolvedTags =
    tags.length > 0 ? tags : row.category ? [row.category] : [];
  return {
    id: row.id,
    title: row.title,
    scriptureReference: row.scripture_reference,
    scriptureText: row.scripture_text,
    body: row.body,
    category: resolvedTags[0] ?? row.category ?? "General",
    tags: resolvedTags,
    publishDate: formatDateValue(row.publish_date),
    isActive: row.is_active
  };
}

async function attachTags(prompts: PrayerPrompt[]): Promise<PrayerPrompt[]> {
  if (prompts.length === 0) {
    return prompts;
  }
  const tagMap = await getTagsForPrayerPrompts(prompts.map((p) => p.id));
  return prompts.map((prompt) => {
    const tags = tagMap.get(prompt.id) ?? prompt.tags;
    return {
      ...prompt,
      tags,
      category: tags[0] ?? prompt.category
    };
  });
}

const promptSelect =
  "id, title, scripture_reference, scripture_text, body, category, publish_date, is_active";

export async function getSuggestedPrompt() {
  const result = await query<PrayerPromptRow>(
    `select ${promptSelect}
     from prayer_prompts
     where is_active = true
       and publish_date <= current_date
     order by publish_date desc, created_at desc
     limit 1`
  );

  if (!result.rows[0]) {
    return null;
  }
  const [prompt] = await attachTags([mapPrompt(result.rows[0])]);
  return prompt;
}

/** Random active prompt for the log screen. */
export async function getRandomPrompt(excludeId?: string | null) {
  const result = await query<PrayerPromptRow>(
    `select ${promptSelect}
     from prayer_prompts
     where is_active = true
       and publish_date <= current_date
       and ($1::uuid is null or id <> $1)
     order by random()
     limit 1`,
    [excludeId ?? null]
  );

  if (result.rows[0]) {
    const [prompt] = await attachTags([mapPrompt(result.rows[0])]);
    return prompt;
  }

  if (excludeId) {
    return getRandomPrompt(null);
  }

  return null;
}

export async function getPromptById(id: string) {
  const result = await query<PrayerPromptRow>(
    `select ${promptSelect}
     from prayer_prompts
     where id = $1
     limit 1`,
    [id]
  );

  if (!result.rows[0]) {
    return null;
  }
  const [prompt] = await attachTags([mapPrompt(result.rows[0])]);
  return prompt;
}

export async function getActivePromptsForSelection(limit = 40) {
  const result = await query<PrayerPromptRow>(
    `select ${promptSelect}
     from prayer_prompts
     where is_active = true
       and publish_date <= current_date
     order by publish_date desc, created_at desc
     limit $1`,
    [limit]
  );

  return attachTags(result.rows.map((row) => mapPrompt(row)));
}

export async function getPromptArchive(tag?: string) {
  const values: string[] = [];
  const tagClause = tag
    ? `and exists (
         select 1
         from prayer_prompt_tags ppt
         join prompt_tags t on t.id = ppt.tag_id
         where ppt.prayer_prompt_id = p.id
           and lower(t.name) = lower($1)
       )`
    : "";

  if (tag) {
    values.push(tag);
  }

  const result = await query<PrayerPromptRow & { prayer_count: string | number }>(
    `select
       p.id,
       p.title,
       p.scripture_reference,
       p.scripture_text,
       p.body,
       p.category,
       p.publish_date,
       p.is_active,
       coalesce(pc.prayer_count, 0) as prayer_count
     from prayer_prompts p
     left join (
       select prayer_prompt_id, count(*)::int as prayer_count
       from prompt_prayers
       group by prayer_prompt_id
     ) pc on pc.prayer_prompt_id = p.id
     where p.is_active = true
       ${tagClause}
     order by p.publish_date desc, p.created_at desc
     limit 40`,
    values
  );

  const mapped = result.rows.map((row) => ({
    ...mapPrompt(row),
    prayerCount: Number(row.prayer_count ?? 0)
  }));
  return attachTags(mapped);
}

/** Record that a user started praying a campaign prompt (counts total times). */
export async function markPromptPrayed(input: { promptId: string; userId: string }) {
  const allowed = await query<{ id: string }>(
    `select id
     from prayer_prompts
     where id = $1
       and is_active = true
       and publish_date <= current_date
     limit 1`,
    [input.promptId]
  );

  if (!allowed.rows[0]) {
    throw new Error("That prayer prompt is not available.");
  }

  await query(
    `insert into prompt_prayers (prayer_prompt_id, user_id)
     values ($1, $2)`,
    [input.promptId, input.userId]
  );

  const countResult = await query<{ count: string }>(
    `select count(*)::text as count from prompt_prayers where prayer_prompt_id = $1`,
    [input.promptId]
  );

  return {
    prayerCount: Number(countResult.rows[0]?.count ?? 0)
  };
}

export async function getAdminPrompts(limit = 200) {
  const result = await query<PrayerPromptRow>(
    `select ${promptSelect}
     from prayer_prompts
     order by publish_date desc, created_at desc
     limit $1`,
    [limit]
  );

  return attachTags(result.rows.map((row) => mapPrompt(row)));
}

/** All campaign prompts for CSV export (no artificial limit). */
export async function listAllPrayerPromptsForExport() {
  const result = await query<PrayerPromptRow>(
    `select ${promptSelect}
     from prayer_prompts
     order by publish_date desc, created_at desc`
  );
  return attachTags(result.rows.map((row) => mapPrompt(row)));
}

export type CampaignPromptImportRow = {
  title: string;
  body: string;
  /** One or more tags; category column still accepted as a single tag. */
  tags: string[];
  scriptureReference: string | null;
  scriptureText: string | null;
  publishDate: string;
  isActive: boolean;
};

async function insertCampaignPromptRows(
  rows: CampaignPromptImportRow[],
  createdBy: string | null
) {
  const { ensurePromptTagsForImport } = await import("@/lib/tags");
  const allTagNames = rows.flatMap((row) => row.tags);
  const { created: tagsCreated, reactivated: tagsReactivated } =
    await ensurePromptTagsForImport(allTagNames);

  for (const row of rows) {
    const tags = row.tags.length > 0 ? row.tags : ["General"];
    const primary = tags[0];

    const inserted = await query<{ id: string }>(
      `insert into prayer_prompts (
         title,
         scripture_reference,
         scripture_text,
         body,
         category,
         publish_date,
         is_active,
         created_by
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id`,
      [
        row.title,
        row.scriptureReference,
        row.scriptureText,
        row.body,
        primary,
        row.publishDate,
        row.isActive,
        createdBy
      ]
    );

    await replacePrayerPromptTags(inserted.rows[0].id, tags);
  }

  return {
    count: rows.length,
    categoriesCreated: tagsCreated,
    categoriesReactivated: tagsReactivated,
    tagsCreated,
    tagsReactivated
  };
}

/**
 * Replace all campaign prompts with rows from CSV.
 * Creates missing tags. Existing sessions keep history (prompt_id set null on delete).
 */
export async function replacePrayerPromptsFromRows(
  rows: CampaignPromptImportRow[],
  createdBy: string | null
) {
  if (rows.length === 0) {
    throw new Error("CSV has no data rows. Keep the header and at least one prompt.");
  }

  await query(`delete from prayer_prompts`);
  return insertCampaignPromptRows(rows, createdBy);
}

/** Append CSV rows without deleting existing campaign prompts. */
export async function appendPrayerPromptsFromRows(
  rows: CampaignPromptImportRow[],
  createdBy: string | null
) {
  if (rows.length === 0) {
    throw new Error("CSV has no data rows. Keep the header and at least one prompt.");
  }

  return insertCampaignPromptRows(rows, createdBy);
}

export async function createPrayerPrompt(input: {
  title: string;
  scriptureReference: string | null;
  scriptureText: string | null;
  body: string;
  tags: string[];
  publishDate: string;
  isActive: boolean;
  createdBy: string | null;
}) {
  const tags = input.tags.length > 0 ? input.tags : ["General"];
  const primary = tags[0];

  const result = await query<{ id: string }>(
    `insert into prayer_prompts (
       title,
       scripture_reference,
       scripture_text,
       body,
       category,
       publish_date,
       is_active,
       created_by
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id`,
    [
      input.title,
      input.scriptureReference,
      input.scriptureText,
      input.body,
      primary,
      input.publishDate,
      input.isActive,
      input.createdBy
    ]
  );

  await replacePrayerPromptTags(result.rows[0].id, tags);
  return result.rows[0];
}

export async function updatePrayerPrompt(input: {
  id: string;
  title: string;
  scriptureReference: string | null;
  scriptureText: string | null;
  body: string;
  tags: string[];
  publishDate: string;
  isActive: boolean;
}) {
  const tags = input.tags.length > 0 ? input.tags : ["General"];
  const primary = tags[0];

  await query(
    `update prayer_prompts
     set title = $2,
         scripture_reference = $3,
         scripture_text = $4,
         body = $5,
         category = $6,
         publish_date = $7,
         is_active = $8
     where id = $1`,
    [
      input.id,
      input.title,
      input.scriptureReference,
      input.scriptureText,
      input.body,
      primary,
      input.publishDate,
      input.isActive
    ]
  );

  await replacePrayerPromptTags(input.id, tags);
}

export async function setPrayerPromptActive(input: {
  id: string;
  isActive: boolean;
}) {
  await query("update prayer_prompts set is_active = $2 where id = $1", [input.id, input.isActive]);
}
