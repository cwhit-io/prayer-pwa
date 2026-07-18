import { query } from "@/lib/postgres";
import { buildYouVersionEsvUrl } from "@/lib/youversion";

export type SupplicationItem = {
  kind: "request" | "prompt";
  id: string;
  title: string;
  body: string;
  category: string | null;
  scriptureReference: string | null;
  scriptureText: string | null;
  scriptureHref: string | null;
  prayerCount: number;
};

type Candidate = SupplicationItem & { weight: number };

/**
 * Weight favors under-prayed items:
 *   w = base / (count + 1)^2
 * Requests get a higher base so community needs surface more often than campaign prompts.
 */
function weightFor(kind: "request" | "prompt", prayerCount: number) {
  const base = kind === "request" ? 3 : 1;
  return base / Math.pow(prayerCount + 1, 2);
}

function pickWeighted(candidates: Candidate[]): SupplicationItem | null {
  if (candidates.length === 0) {
    return null;
  }

  const total = candidates.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;

  for (const item of candidates) {
    roll -= item.weight;
    if (roll <= 0) {
      const { weight: _weight, ...rest } = item;
      return rest;
    }
  }

  const last = candidates[candidates.length - 1];
  const { weight: _weight, ...rest } = last;
  return rest;
}

async function loadRequestCandidates(excludeId?: string | null): Promise<Candidate[]> {
  const result = await query<{
    id: string;
    title: string;
    body: string;
    category: string;
    prayer_count: string | number;
  }>(
    `select
       r.id::text,
       r.title,
       r.body,
       r.category,
       coalesce(pc.prayer_count, 0) as prayer_count
     from prayer_requests r
     left join (
       select prayer_request_id, count(*)::int as prayer_count
       from request_prayers
       group by prayer_request_id
     ) pc on pc.prayer_request_id = r.id
     where r.visibility = 'church_anonymous'
       and r.status in ('open', 'praying')
       and r.board_moderation = 'published'
       and (r.publish_at is null or r.publish_at <= now())
       and ($1::uuid is null or r.id <> $1)
     order by coalesce(pc.prayer_count, 0) asc, r.created_at desc
     limit 50`,
    [excludeId ?? null]
  );

  return result.rows.map((row) => {
    const prayerCount = Number(row.prayer_count ?? 0);
    return {
      kind: "request" as const,
      id: row.id,
      title: row.title,
      body: row.body,
      category: row.category,
      scriptureReference: null,
      scriptureText: null,
      scriptureHref: null,
      prayerCount,
      weight: weightFor("request", prayerCount)
    };
  });
}

async function loadPromptCandidates(excludeId?: string | null): Promise<Candidate[]> {
  const result = await query<{
    id: string;
    title: string;
    body: string;
    category: string;
    scripture_reference: string | null;
    scripture_text: string | null;
    prayer_count: string | number;
  }>(
    `select
       p.id::text,
       p.title,
       p.body,
       p.category,
       p.scripture_reference,
       p.scripture_text,
       coalesce(pc.prayer_count, 0) as prayer_count
     from prayer_prompts p
     left join (
       select prayer_prompt_id, count(*)::int as prayer_count
       from prompt_prayers
       group by prayer_prompt_id
     ) pc on pc.prayer_prompt_id = p.id
     where p.is_active = true
       and p.publish_date <= current_date
       and ($1::uuid is null or p.id <> $1)
     order by coalesce(pc.prayer_count, 0) asc, p.publish_date desc
     limit 50`,
    [excludeId ?? null]
  );

  return result.rows.map((row) => {
    const prayerCount = Number(row.prayer_count ?? 0);
    return {
      kind: "prompt" as const,
      id: row.id,
      title: row.title,
      body: row.body,
      category: row.category,
      scriptureReference: row.scripture_reference,
      scriptureText: row.scripture_text,
      scriptureHref: row.scripture_reference ? buildYouVersionEsvUrl(row.scripture_reference) : null,
      prayerCount,
      weight: weightFor("prompt", prayerCount)
    };
  });
}

export type WeightedSupplicationOptions = {
  /** When false (guest pray), only campaign prompts are used. Default true. */
  includeRequests?: boolean;
};

/**
 * Random supplication from community requests + campaign prompts.
 * Under-prayed (and especially never-prayed) requests are weighted higher.
 * Guests should call with `includeRequests: false`.
 */
export async function getWeightedSupplication(
  excludeId?: string | null,
  options?: WeightedSupplicationOptions
): Promise<SupplicationItem | null> {
  const includeRequests = options?.includeRequests !== false;
  const [requests, prompts] = await Promise.all([
    includeRequests ? loadRequestCandidates(excludeId) : Promise.resolve([] as Candidate[]),
    loadPromptCandidates(excludeId)
  ]);

  return pickWeighted([...requests, ...prompts]);
}
