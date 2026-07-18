import { query } from "@/lib/postgres";

/**
 * ACTS / prayer-path step labels — never use as content tags.
 * Step is already A / C / T / S on the guide; tags are topical only.
 */
export const RESERVED_STEP_TAG_NAMES = [
  "adoration",
  "confession",
  "thanksgiving",
  "supplication"
] as const;

export function isReservedStepTagName(name: string | null | undefined): boolean {
  if (!name) {
    return false;
  }
  return (RESERVED_STEP_TAG_NAMES as readonly string[]).includes(name.trim().toLowerCase());
}

/** Drop reserved step labels from a tag list (case-insensitive). */
export function filterReservedStepTagNames(names: string[]): string[] {
  return names.filter((name) => !isReservedStepTagName(name));
}

export type PromptTag = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  /** Campaign (supplication) prompts using this tag. */
  promptCount?: number;
  /** ACTS prompts using this tag (all steps). */
  actsCount?: number;
  /** ACTS Adoration prompts with this tag. */
  actsACount?: number;
  /** ACTS Confession prompts with this tag. */
  actsCCount?: number;
  /** ACTS Thanksgiving prompts with this tag. */
  actsTCount?: number;
  /**
   * Ideal coverage: ≥1 campaign + ≥1 A + ≥1 C + ≥1 T.
   * Only meaningful when counts are loaded.
   */
  coverageComplete?: boolean;
  /** Missing slots for the ideal set, e.g. ["S", "A"]. */
  coverageGaps?: string[];
};

type TagRow = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  prompt_count?: string | number | null;
  acts_count?: string | number | null;
  acts_a_count?: string | number | null;
  acts_c_count?: string | number | null;
  acts_t_count?: string | number | null;
};

function coverageFromCounts(input: {
  campaign: number;
  a: number;
  c: number;
  t: number;
}) {
  const gaps: string[] = [];
  if (input.campaign < 1) {
    gaps.push("S");
  }
  if (input.a < 1) {
    gaps.push("A");
  }
  if (input.c < 1) {
    gaps.push("C");
  }
  if (input.t < 1) {
    gaps.push("T");
  }
  return {
    coverageComplete: gaps.length === 0,
    coverageGaps: gaps
  };
}

function mapTag(row: TagRow): PromptTag {
  const campaign = row.prompt_count != null ? Number(row.prompt_count) : 0;
  const actsA = row.acts_a_count != null ? Number(row.acts_a_count) : 0;
  const actsC = row.acts_c_count != null ? Number(row.acts_c_count) : 0;
  const actsT = row.acts_t_count != null ? Number(row.acts_t_count) : 0;
  const actsTotal =
    row.acts_count != null ? Number(row.acts_count) : actsA + actsC + actsT;
  const coverage = coverageFromCounts({
    campaign,
    a: actsA,
    c: actsC,
    t: actsT
  });

  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    promptCount: campaign,
    actsCount: actsTotal,
    actsACount: actsA,
    actsCCount: actsC,
    actsTCount: actsT,
    coverageComplete: coverage.coverageComplete,
    coverageGaps: coverage.coverageGaps
  };
}

/** Active tag names for filters and simple pickers. */
export async function getActivePromptTagNames(): Promise<string[]> {
  const result = await query<{ name: string }>(
    `select name
     from prompt_tags
     where is_active = true
       and lower(name) <> all($1::text[])
     order by sort_order asc, name asc`,
    [RESERVED_STEP_TAG_NAMES]
  );

  if (result.rows.length === 0) {
    return [
      "Future",
      "Family",
      "Friends",
      "Finances",
      "Church",
      "Fort Wayne",
      "Personal renewal"
    ];
  }

  return result.rows.map((row) => row.name);
}

export async function listPromptTags(options?: { includeInactive?: boolean }) {
  const includeInactive = options?.includeInactive ?? false;

  const result = await query<TagRow>(
    `select
       t.id,
       t.name,
       t.sort_order,
       t.is_active,
       count(distinct ppt.prayer_prompt_id)::text as prompt_count,
       count(distinct apt.acts_prompt_id)::text as acts_count,
       count(distinct apt.acts_prompt_id) filter (where a.step = 'A')::text as acts_a_count,
       count(distinct apt.acts_prompt_id) filter (where a.step = 'C')::text as acts_c_count,
       count(distinct apt.acts_prompt_id) filter (where a.step = 'T')::text as acts_t_count
     from prompt_tags t
     left join prayer_prompt_tags ppt on ppt.tag_id = t.id
     left join acts_prompt_tags apt on apt.tag_id = t.id
     left join acts_prompts a on a.id = apt.acts_prompt_id and a.is_active = true
     where lower(t.name) <> all($1::text[])
       ${includeInactive ? "" : "and t.is_active = true"}
     group by t.id
     order by t.sort_order asc, t.name asc`,
    [RESERVED_STEP_TAG_NAMES]
  );

  return result.rows.map(mapTag);
}

export async function createPromptTag(input: { name: string; sortOrder?: number }) {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Tag name is required.");
  }
  if (isReservedStepTagName(name)) {
    throw new Error(
      "Adoration, Confession, Thanksgiving, and Supplication are step names, not tags."
    );
  }

  let sortOrder = input.sortOrder;
  if (sortOrder == null || !Number.isFinite(sortOrder)) {
    const max = await query<{ max: string | null }>(
      `select max(sort_order)::text as max from prompt_tags`
    );
    sortOrder = Number(max.rows[0]?.max ?? 0) + 10;
  }

  const result = await query<{ id: string }>(
    `insert into prompt_tags (name, sort_order, is_active)
     values ($1, $2, true)
     on conflict (name) do update
     set is_active = true,
         updated_at = now()
     returning id`,
    [name, sortOrder]
  );

  return result.rows[0];
}

export async function updatePromptTag(input: {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}) {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Tag name is required.");
  }
  if (isReservedStepTagName(name)) {
    throw new Error(
      "Adoration, Confession, Thanksgiving, and Supplication are step names, not tags."
    );
  }

  await query(
    `update prompt_tags
     set name = $2,
         sort_order = $3,
         is_active = $4,
         updated_at = now()
     where id = $1`,
    [input.id, name, input.sortOrder, input.isActive]
  );

  // Keep legacy category text in sync when the primary label renames.
  // (category column remains a denormalized display fallback.)
  await query(
    `update prayer_prompts p
     set category = $2
     where p.category is distinct from $2
       and exists (
         select 1 from prayer_prompt_tags ppt
         where ppt.prayer_prompt_id = p.id and ppt.tag_id = $1
       )
       and (
         select count(*) from prayer_prompt_tags ppt2 where ppt2.prayer_prompt_id = p.id
       ) = 1`,
    [input.id, name]
  );
}

export async function setPromptTagActive(input: { id: string; isActive: boolean }) {
  await query(
    `update prompt_tags
     set is_active = $2,
         updated_at = now()
     where id = $1`,
    [input.id, input.isActive]
  );
}

/**
 * Ensure tag names exist (and are active). Returns id map by lowercased name
 * and canonical display names.
 */
export async function ensurePromptTagsForImport(names: string[]) {
  const unique = Array.from(
    new Set(
      names
        .map((n) => n.trim())
        .filter(Boolean)
        .filter((n) => !isReservedStepTagName(n))
    )
  );

  const existing = await query<{ id: string; name: string; is_active: boolean }>(
    `select id, name, is_active from prompt_tags
     where lower(name) <> all($1::text[])`,
    [RESERVED_STEP_TAG_NAMES]
  );

  const byLower = new Map(
    existing.rows.map((row) => [row.name.toLowerCase(), row] as const)
  );

  let maxSort = 0;
  const maxResult = await query<{ max: string | null }>(
    `select max(sort_order)::text as max from prompt_tags`
  );
  maxSort = Number(maxResult.rows[0]?.max ?? 0);

  const idsByLower = new Map<string, string>();
  const canonical = new Map<string, string>();
  let created = 0;
  let reactivated = 0;

  for (const name of unique) {
    const key = name.toLowerCase();
    const match = byLower.get(key);

    if (match) {
      if (!match.is_active) {
        await query(
          `update prompt_tags set is_active = true, updated_at = now() where id = $1`,
          [match.id]
        );
        reactivated += 1;
      }
      idsByLower.set(key, match.id);
      canonical.set(key, match.name);
      continue;
    }

    maxSort += 10;
    const inserted = await query<{ id: string }>(
      `insert into prompt_tags (name, sort_order, is_active)
       values ($1, $2, true)
       returning id`,
      [name, maxSort]
    );
    const id = inserted.rows[0].id;
    byLower.set(key, { id, name, is_active: true });
    idsByLower.set(key, id);
    canonical.set(key, name);
    created += 1;
  }

  return { created, reactivated, idsByLower, canonical };
}

/** Parse comma/pipe/semicolon separated tag names. */
export function parseTagNameList(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  return filterReservedStepTagNames(
    Array.from(
      new Set(
        value
          .split(/[,|;]+/)
          .map((part) => part.trim())
          .filter(Boolean)
      )
    )
  );
}

/**
 * Read tags from a CSV row.
 * Prefers multi-value columns (tags/tag/categories) and always merges legacy `category`.
 * Reserved step names (Adoration/Confession/Thanksgiving/Supplication) are dropped.
 */
export function readTagsFromCsvRow(
  line: string[],
  header: Map<string, number>,
  cellAtFn: (row: string[], map: Map<string, number>, key: string) => string,
  cellAtAnyFn: (row: string[], map: Map<string, number>, keys: string[]) => string
): string[] {
  const multi = parseTagNameList(cellAtAnyFn(line, header, ["tags", "tag", "categories"]));
  const legacy = parseTagNameList(cellAtFn(line, header, "category"));
  return filterReservedStepTagNames(Array.from(new Set([...multi, ...legacy])));
}

export async function replacePrayerPromptTags(promptId: string, tagNames: string[]) {
  const names = filterReservedStepTagNames(
    Array.from(new Set(tagNames.map((n) => n.trim()).filter(Boolean)))
  );
  const { idsByLower, canonical } = await ensurePromptTagsForImport(names);

  await query(`delete from prayer_prompt_tags where prayer_prompt_id = $1`, [promptId]);

  const orderedIds: string[] = [];
  for (const name of names) {
    const id = idsByLower.get(name.toLowerCase());
    if (id && !orderedIds.includes(id)) {
      orderedIds.push(id);
    }
  }

  for (const tagId of orderedIds) {
    await query(
      `insert into prayer_prompt_tags (prayer_prompt_id, tag_id) values ($1, $2)
       on conflict do nothing`,
      [promptId, tagId]
    );
  }

  // Denormalized primary category = first tag (legacy UIs / request matching).
  const primary =
    names.length > 0
      ? canonical.get(names[0].toLowerCase()) || names[0]
      : "General";
  await query(`update prayer_prompts set category = $2 where id = $1`, [promptId, primary]);

  return orderedIds;
}

export async function replaceActsPromptTags(actsPromptId: string, tagNames: string[]) {
  const names = filterReservedStepTagNames(
    Array.from(new Set(tagNames.map((n) => n.trim()).filter(Boolean)))
  );
  const { idsByLower } = await ensurePromptTagsForImport(names);

  await query(`delete from acts_prompt_tags where acts_prompt_id = $1`, [actsPromptId]);

  const orderedIds: string[] = [];
  for (const name of names) {
    const id = idsByLower.get(name.toLowerCase());
    if (id && !orderedIds.includes(id)) {
      orderedIds.push(id);
    }
  }

  for (const tagId of orderedIds) {
    await query(
      `insert into acts_prompt_tags (acts_prompt_id, tag_id) values ($1, $2)
       on conflict do nothing`,
      [actsPromptId, tagId]
    );
  }

  return orderedIds;
}

export async function getTagsForPrayerPrompts(promptIds: string[]) {
  if (promptIds.length === 0) {
    return new Map<string, string[]>();
  }

  const result = await query<{ prayer_prompt_id: string; name: string }>(
    `select ppt.prayer_prompt_id::text, t.name
     from prayer_prompt_tags ppt
     join prompt_tags t on t.id = ppt.tag_id
     where ppt.prayer_prompt_id = any($1::uuid[])
     order by t.sort_order asc, t.name asc`,
    [promptIds]
  );

  const map = new Map<string, string[]>();
  for (const row of result.rows) {
    const list = map.get(row.prayer_prompt_id) ?? [];
    list.push(row.name);
    map.set(row.prayer_prompt_id, list);
  }
  return map;
}

export async function getTagsForActsPrompts(actsIds: string[]) {
  if (actsIds.length === 0) {
    return new Map<string, string[]>();
  }

  const result = await query<{ acts_prompt_id: string; name: string }>(
    `select apt.acts_prompt_id::text, t.name
     from acts_prompt_tags apt
     join prompt_tags t on t.id = apt.tag_id
     where apt.acts_prompt_id = any($1::uuid[])
     order by t.sort_order asc, t.name asc`,
    [actsIds]
  );

  const map = new Map<string, string[]>();
  for (const row of result.rows) {
    const list = map.get(row.acts_prompt_id) ?? [];
    list.push(row.name);
    map.set(row.acts_prompt_id, list);
  }
  return map;
}

export async function getTagIdsByNames(names: string[]): Promise<string[]> {
  const cleaned = Array.from(new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean)));
  if (cleaned.length === 0) {
    return [];
  }

  const result = await query<{ id: string }>(
    `select id from prompt_tags where lower(name) = any($1::text[])`,
    [cleaned]
  );
  return result.rows.map((row) => row.id);
}

/**
 * Resolve preferred tag ids for linking ACTS to a supplication focus.
 * Uses prompt tags when focus is a campaign prompt; otherwise matches free-form
 * names (e.g. request category) against the shared tag table (case-insensitive).
 */
export async function resolvePreferredTagIds(input: {
  kind?: "request" | "prompt" | null;
  id?: string | null;
  tagNames?: string[] | null;
  category?: string | null;
}): Promise<string[]> {
  const names = new Set<string>();

  if (input.tagNames) {
    for (const name of input.tagNames) {
      if (name.trim()) {
        names.add(name.trim());
      }
    }
  }
  if (input.category?.trim()) {
    names.add(input.category.trim());
  }

  if (input.kind === "prompt" && input.id) {
    const fromPrompt = await query<{ name: string }>(
      `select t.name
       from prayer_prompt_tags ppt
       join prompt_tags t on t.id = ppt.tag_id
       where ppt.prayer_prompt_id = $1`,
      [input.id]
    );
    for (const row of fromPrompt.rows) {
      names.add(row.name);
    }
  }

  return getTagIdsByNames(Array.from(names));
}
