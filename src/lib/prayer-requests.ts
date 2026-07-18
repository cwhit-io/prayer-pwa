import { query } from "@/lib/postgres";
import { requestCategories, requestVisibilities } from "@/lib/request-options";

export { requestCategories, requestVisibilities };

export const requestStatuses = ["open", "praying", "answered", "archived"] as const;

export type PrayerRequest = {
  id: string;
  userId: string | null;
  requesterName: string | null;
  requesterEmail: string | null;
  title: string;
  body: string;
  category: string;
  visibility: string;
  status: string;
  isAnonymous: boolean;
  verifiedAnonymous: boolean;
  routingQueue: string;
  targetGroupId: string | null;
  targetGroupName: string | null;
  createdAt: string;
  answeredAt: string | null;
  boardModeration: string;
  publishAt: string | null;
  moderationNotes: string | null;
  matchedKeywords: string | null;
};

export type Testimony = {
  id: string;
  userId: string | null;
  prayerRequestId: string | null;
  title: string;
  story: string;
  approved: boolean;
  featured: boolean;
  createdAt: string;
};

export type FeaturedCommunityPrayer = {
  id: string;
  source: "testimony" | "request";
  title: string;
  body: string;
  category: string;
  createdAt: string;
};

type PrayerRequestRow = {
  id: string;
  user_id: string | null;
  requester_name: string | null;
  requester_email: string | null;
  title: string;
  body: string;
  category: string;
  visibility: string;
  status: string;
  is_anonymous: boolean;
  verified_anonymous: boolean;
  routing_queue: string;
  target_group_id: string | null;
  target_group_name: string | null;
  created_at: string | Date;
  answered_at: string | Date | null;
  board_moderation: string;
  publish_at: string | Date | null;
  moderation_notes: string | null;
  matched_keywords: string | null;
};

type TestimonyRow = {
  id: string;
  user_id: string | null;
  prayer_request_id: string | null;
  title: string;
  story: string;
  approved: boolean;
  featured: boolean;
  created_at: string | Date;
};

type FeaturedCommunityPrayerRow = {
  id: string;
  source: "testimony" | "request";
  title: string;
  body: string;
  category: string;
  created_at: string | Date;
};

function formatDateValue(value: string | Date | null) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function mapRequest(row: PrayerRequestRow): PrayerRequest {
  return {
    id: row.id,
    userId: row.user_id,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    title: row.title,
    body: row.body,
    category: row.category,
    visibility: row.visibility,
    status: row.status,
    isAnonymous: row.is_anonymous,
    verifiedAnonymous: row.verified_anonymous,
    routingQueue: row.routing_queue,
    targetGroupId: row.target_group_id,
    targetGroupName: row.target_group_name,
    createdAt: formatDateValue(row.created_at) ?? "",
    answeredAt: formatDateValue(row.answered_at),
    boardModeration: row.board_moderation ?? "published",
    publishAt: formatDateValue(row.publish_at),
    moderationNotes: row.moderation_notes,
    matchedKeywords: row.matched_keywords
  };
}

function mapTestimony(row: TestimonyRow): Testimony {
  return {
    id: row.id,
    userId: row.user_id,
    prayerRequestId: row.prayer_request_id,
    title: row.title,
    story: row.story,
    approved: row.approved,
    featured: row.featured,
    createdAt: formatDateValue(row.created_at) ?? ""
  };
}

function mapFeaturedCommunityPrayer(row: FeaturedCommunityPrayerRow): FeaturedCommunityPrayer {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    body: row.body,
    category: row.category,
    createdAt: formatDateValue(row.created_at) ?? ""
  };
}

const requestSelect = `
  select
    r.id,
    r.user_id,
    u.name as requester_name,
    u.email as requester_email,
    r.title,
    r.body,
    r.category,
    r.visibility,
    r.status,
    r.is_anonymous,
    r.verified_anonymous,
    r.routing_queue,
    r.target_group_id,
    g.name as target_group_name,
    r.created_at,
    r.answered_at,
    r.board_moderation,
    r.publish_at,
    r.moderation_notes,
    r.matched_keywords
  from prayer_requests r
  left join app_users u on u.id = r.user_id
  left join groups g on g.id = r.target_group_id
`;

export async function createPrayerRequest(input: {
  userId: string;
  title: string;
  body: string;
  category: string;
  visibility: string;
  isAnonymous: boolean;
  verifiedAnonymous?: boolean;
  boardModeration?: string;
  publishAt?: Date | null;
  matchedKeywords?: string[];
  moderationNotes?: string | null;
}) {
  const boardModeration = input.boardModeration ?? "published";
  const publishAt = input.publishAt ?? null;

  const result = await query<{ id: string }>(
    `insert into prayer_requests (
       user_id,
       title,
       body,
       category,
       visibility,
       is_anonymous,
       verified_anonymous,
       routing_queue,
       target_group_id,
       board_moderation,
       publish_at,
       matched_keywords,
       moderation_notes
     )
     values ($1, $2, $3, $4, $5, $6, $7, 'prayer_team', null, $8, $9, $10, $11)
     returning id`,
    [
      input.userId,
      input.title,
      input.body,
      input.category,
      input.visibility,
      input.isAnonymous,
      Boolean(input.verifiedAnonymous),
      boardModeration,
      publishAt,
      input.matchedKeywords?.length ? input.matchedKeywords.join(", ") : null,
      input.moderationNotes ?? null
    ]
  );

  const created = result.rows[0];

  try {
    const { onPrayerRequestCreated } = await import("@/lib/notification-events");
    await onPrayerRequestCreated({
      requestId: created.id,
      visibility: input.visibility,
      boardModeration,
      publishAt
    });
  } catch {
    // ignore
  }

  return created;
}

export async function getRequestsForUser(userId: string) {
  const result = await query<PrayerRequestRow>(
    `${requestSelect}
     where r.user_id = $1
     order by r.created_at desc
     limit 50`,
    [userId]
  );

  return result.rows.map(mapRequest);
}

export type CommunityBoardItem = {
  id: string;
  requestId: string | null;
  kind: "request" | "testimony";
  title: string;
  body: string;
  category: string;
  status: string;
  authorLabel: string;
  createdAt: string;
  /** Total times this request has been marked as prayed for (not unique people). */
  prayerCount: number;
};

/**
 * Public community board: church-shared requests only.
 * Open / under-prayed requests float to the top; prayer counts power the badge.
 */
export async function getCommunityBoardItems(limit = 60): Promise<CommunityBoardItem[]> {
  const result = await query<{
    id: string;
    kind: "request" | "testimony";
    title: string;
    body: string;
    category: string;
    status: string;
    author_label: string;
    created_at: string | Date;
    prayer_count: string | number;
  }>(
    `select
       r.id::text,
       'request'::text as kind,
       r.title,
       r.body,
       r.category,
       r.status,
       case
         when r.is_anonymous then 'Anonymous'
         else coalesce(u.name, 'Church family')
       end as author_label,
       r.created_at,
       coalesce(pc.prayer_count, 0) as prayer_count
     from prayer_requests r
     left join app_users u on u.id = r.user_id
     left join (
       select prayer_request_id, count(*)::int as prayer_count
       from request_prayers
       group by prayer_request_id
     ) pc on pc.prayer_request_id = r.id
     where r.visibility = 'church_anonymous'
       and r.status in ('open', 'praying', 'answered')
       and r.board_moderation = 'published'
       and (r.publish_at is null or r.publish_at <= now())
     order by
       case when r.status in ('open', 'praying') then 0 else 1 end,
       coalesce(pc.prayer_count, 0) asc,
       r.created_at desc
     limit $1`,
    [limit]
  );

  return result.rows.map((row) => ({
    id: `${row.kind}-${row.id}`,
    requestId: row.id,
    kind: "request",
    title: row.title,
    body: row.body,
    category: row.category,
    status: row.status,
    authorLabel: row.author_label,
    createdAt: formatDateValue(row.created_at) ?? "",
    prayerCount: Number(row.prayer_count ?? 0)
  }));
}

/** Record that a signed-in user prayed for a community request (can be multiple times). */
export async function markRequestPrayed(input: { requestId: string; userId: string }) {
  const allowed = await query<{ id: string }>(
    `select id
     from prayer_requests
     where id = $1
       and visibility = 'church_anonymous'
       and status in ('open', 'praying', 'answered')
       and board_moderation = 'published'
       and (publish_at is null or publish_at <= now())
     limit 1`,
    [input.requestId]
  );

  if (!allowed.rows[0]) {
    throw new Error("That prayer request is not available on the community board.");
  }

  await query(
    `insert into request_prayers (prayer_request_id, user_id)
     values ($1, $2)`,
    [input.requestId, input.userId]
  );

  await query(
    `update prayer_requests
     set status = case when status = 'open' then 'praying' else status end
     where id = $1`,
    [input.requestId]
  );

  const countResult = await query<{ count: string }>(
    `select count(*)::text as count from request_prayers where prayer_request_id = $1`,
    [input.requestId]
  );

  const prayerCount = Number(countResult.rows[0]?.count ?? 0);

  // Event hook: email requester if they opted in (never blocks prayer).
  try {
    const { onRequestPrayed } = await import("@/lib/notification-events");
    await onRequestPrayed({
      requestId: input.requestId,
      prayedByUserId: input.userId,
      prayerCount
    });
  } catch {
    // ignore
  }

  return { prayerCount };
}

export async function getPrayerTeamRequests() {
  const result = await query<PrayerRequestRow>(
    `${requestSelect}
     where r.status in ('open', 'praying')
       and (
         r.routing_queue = 'prayer_team'
         or r.visibility in ('prayer_team', 'church_anonymous')
         or r.target_group_id is null
       )
     order by r.created_at desc
     limit 100`
  );

  return result.rows.map(mapRequest);
}

export async function getRequestsForLeader(userId: string) {
  const result = await query<PrayerRequestRow>(
    `${requestSelect}
     where r.status in ('open', 'praying')
       and r.target_group_id in (
         select g.id
         from groups g
         where g.leader_user_id = $1
         union
         select m.group_id
         from group_memberships m
         where m.user_id = $1
           and m.role = 'leader'
       )
     order by r.created_at desc
     limit 100`,
    [userId]
  );

  return result.rows.map(mapRequest);
}

export async function getPastoralQueueRequests() {
  const result = await query<PrayerRequestRow>(
    `${requestSelect}
     where r.status in ('open', 'praying')
       and r.routing_queue = 'pastor'
     order by r.created_at desc
     limit 100`
  );

  return result.rows.map(mapRequest);
}

export async function getFeaturedCommunityPrayer() {
  const result = await query<FeaturedCommunityPrayerRow>(
    `select
       r.id,
       'request'::text as source,
       r.title,
       r.body,
       r.category,
       r.created_at
     from prayer_requests r
     where r.visibility = 'church_anonymous'
       and r.status in ('open', 'praying', 'answered')
       and r.board_moderation = 'published'
       and (r.publish_at is null or r.publish_at <= now())
     order by r.created_at desc
     limit 1`
  );

  return result.rows[0] ? mapFeaturedCommunityPrayer(result.rows[0]) : null;
}

export async function getAdminPrayerRequests() {
  const result = await query<PrayerRequestRow>(
    `${requestSelect}
     order by
       case r.board_moderation
         when 'pending_review' then 0
         else 1
       end,
       case r.status
         when 'open' then 1
         when 'praying' then 2
         when 'answered' then 3
         else 4
       end,
       r.created_at desc
     limit 150`
  );

  return result.rows.map(mapRequest);
}

export async function getPendingBoardReviewRequests() {
  const result = await query<PrayerRequestRow>(
    `${requestSelect}
     where r.board_moderation = 'pending_review'
     order by r.created_at asc
     limit 100`
  );

  return result.rows.map(mapRequest);
}

/** Community board posts waiting on the random delay clock. */
export async function getDelayedBoardRequests() {
  const result = await query<PrayerRequestRow>(
    `${requestSelect}
     where r.visibility = 'church_anonymous'
       and r.board_moderation = 'published'
       and r.publish_at is not null
       and r.publish_at > now()
     order by r.publish_at asc
     limit 100`
  );

  return result.rows.map(mapRequest);
}

export async function approveBoardRequest(input: {
  id: string;
  publishImmediately?: boolean;
  notes?: string | null;
}) {
  const publishAt = input.publishImmediately === false ? null : new Date();
  await query(
    `update prayer_requests
     set board_moderation = 'published',
         publish_at = coalesce($2, now()),
         moderation_notes = coalesce($3, moderation_notes)
     where id = $1`,
    [input.id, publishAt, input.notes ?? null]
  );

  try {
    const { onBoardRequestPublished } = await import("@/lib/notification-events");
    await onBoardRequestPublished({ requestId: input.id });
  } catch {
    // ignore
  }
}

/** Force a delayed (or held) community post live on the board immediately. */
export async function publishBoardRequestNow(input: { id: string; notes?: string | null }) {
  await query(
    `update prayer_requests
     set board_moderation = 'published',
         publish_at = now(),
         moderation_notes = coalesce($2, moderation_notes)
     where id = $1`,
    [input.id, input.notes ?? "Published to community board immediately by admin."]
  );

  try {
    const { onBoardRequestPublished } = await import("@/lib/notification-events");
    await onBoardRequestPublished({ requestId: input.id });
  } catch {
    // ignore
  }
}

export async function rejectBoardRequest(input: { id: string; notes?: string | null }) {
  await query(
    `update prayer_requests
     set board_moderation = 'rejected',
         publish_at = null,
         moderation_notes = coalesce($2, moderation_notes)
     where id = $1`,
    [input.id, input.notes ?? null]
  );
}

export async function updatePrayerRequestStatus(input: {
  id: string;
  status: string;
}) {
  await query(
    `update prayer_requests
     set status = $2,
         answered_at = case when $2 = 'answered' then coalesce(answered_at, now()) else answered_at end
     where id = $1`,
    [input.id, input.status]
  );
}

/** Owner: mark a request as answered (stays in history; drops priority on board). */
export async function markOwnRequestAnswered(input: { id: string; userId: string }) {
  const result = await query<{ id: string }>(
    `update prayer_requests
     set status = 'answered',
         answered_at = coalesce(answered_at, now())
     where id = $1
       and user_id = $2
       and status is distinct from 'archived'
     returning id`,
    [input.id, input.userId]
  );

  if (!result.rows[0]) {
    throw new Error("Request not found, or you don’t have permission to update it.");
  }

  return result.rows[0];
}

/**
 * Owner: remove a community request from the public board (and pending queue).
 * Private prayer-team requests are closed as archived instead.
 */
export async function unpublishOwnRequest(input: { id: string; userId: string }) {
  const existing = await query<{
    id: string;
    visibility: string;
    board_moderation: string;
    status: string;
  }>(
    `select id, visibility, board_moderation, status
     from prayer_requests
     where id = $1
       and user_id = $2
     limit 1`,
    [input.id, input.userId]
  );

  const row = existing.rows[0];
  if (!row) {
    throw new Error("Request not found, or you don’t have permission to update it.");
  }

  if (row.visibility === "church_anonymous") {
    if (row.board_moderation === "unpublished" || row.board_moderation === "rejected") {
      throw new Error("This request is already off the community board.");
    }

    await query(
      `update prayer_requests
       set board_moderation = 'unpublished',
           publish_at = null,
           moderation_notes = case
             when moderation_notes is null or moderation_notes = '' then 'Removed from community board by requester.'
             else moderation_notes
           end
       where id = $1
         and user_id = $2`,
      [input.id, input.userId]
    );
    return { id: row.id, action: "unpublished" as const };
  }

  // Private prayer: no board — close it out.
  await query(
    `update prayer_requests
     set status = 'archived',
         answered_at = coalesce(answered_at, now())
     where id = $1
       and user_id = $2`,
    [input.id, input.userId]
  );
  return { id: row.id, action: "archived" as const };
}

export async function createTestimony(input: {
  userId: string;
  prayerRequestId: string;
  title: string;
  story: string;
}) {
  const result = await query<{ id: string }>(
    `insert into testimonies (user_id, prayer_request_id, title, story)
     values ($1, $2, $3, $4)
     returning id`,
    [input.userId, input.prayerRequestId, input.title, input.story]
  );

  return result.rows[0];
}

export async function getPendingTestimonies() {
  const result = await query<TestimonyRow>(
    `select id, user_id, prayer_request_id, title, story, approved, featured, created_at
     from testimonies
     where approved = false
     order by created_at desc
     limit 80`
  );

  return result.rows.map(mapTestimony);
}

export async function updateTestimonyModeration(input: {
  id: string;
  approved: boolean;
  featured: boolean;
}) {
  await query(
    `update testimonies
     set approved = $2,
         featured = $3
     where id = $1`,
    [input.id, input.approved, input.featured]
  );
}

/** Leaders may see identity when verified_anonymous is true; public lists still hide it. */
export function displayRequesterName(
  request: Pick<PrayerRequest, "isAnonymous" | "verifiedAnonymous" | "requesterName">,
  options?: { leaderView?: boolean }
) {
  if (request.isAnonymous) {
    if (options?.leaderView && request.verifiedAnonymous && request.requesterName) {
      return `${request.requesterName} (private follow-up)`;
    }
    return "Anonymous";
  }

  return request.requesterName ?? "Unknown";
}
