/**
 * Product event → managed notification hooks.
 * Failures are swallowed so prayer flows never break on email outages.
 */

import { dispatchManagedNotification } from "@/lib/notification-admin";
import {
  getUserNotificationPreferences,
  getUserNotifyEmail,
  listStaffNotifyEmails
} from "@/lib/notification-preferences";
import { query } from "@/lib/postgres";

function appUrl(path = "") {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://FortWaynePrays.org").replace(/\/$/, "");
  return `${base}${path}`;
}

async function safeDispatch(
  fn: () => Promise<unknown>
): Promise<{ ok: boolean; error?: string }> {
  try {
    await fn();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Notification failed"
    };
  }
}

/**
 * Someone prayed for a community request — email the requester if they opted in.
 */
export async function onRequestPrayed(input: {
  requestId: string;
  prayedByUserId: string;
  prayerCount: number;
}) {
  return safeDispatch(async () => {
    const request = await query<{
      id: string;
      user_id: string | null;
      title: string;
      category: string;
    }>(
      `select id, user_id, title, category
       from prayer_requests
       where id = $1
       limit 1`,
      [input.requestId]
    );

    const row = request.rows[0];
    if (!row?.user_id) {
      return;
    }

    // Don't notify yourself.
    if (row.user_id === input.prayedByUserId) {
      return;
    }

    const prefs = await getUserNotificationPreferences(row.user_id);
    if (!prefs.emailPrayerRequestUpdates) {
      return;
    }

    const email = await getUserNotifyEmail(row.user_id);
    if (!email) {
      return;
    }

    const owner = await query<{ name: string }>(
      `select name from app_users where id = $1 limit 1`,
      [row.user_id]
    );

    await dispatchManagedNotification({
      key: "request_prayed_for",
      email,
      vars: {
        name: owner.rows[0]?.name || "Friend",
        request_title: row.title,
        prayer_count: input.prayerCount,
        category: row.category,
        app_url: appUrl("/requests/mine")
      }
    });
  });
}

/**
 * A request became visible on the community board — alert prayer team / admins.
 */
export async function onBoardRequestPublished(input: { requestId: string }) {
  return safeDispatch(async () => {
    const request = await query<{
      id: string;
      title: string;
      category: string;
      visibility: string;
      board_moderation: string;
      publish_at: string | Date | null;
    }>(
      `select id, title, category, visibility, board_moderation, publish_at
       from prayer_requests
       where id = $1
       limit 1`,
      [input.requestId]
    );

    const row = request.rows[0];
    if (!row) {
      return;
    }
    if (row.visibility !== "church_anonymous" || row.board_moderation !== "published") {
      return;
    }
    if (row.publish_at && new Date(row.publish_at).getTime() > Date.now()) {
      // Scheduled for later — wait until live (cron can re-check later).
      return;
    }

    const staffEmails = await listStaffNotifyEmails(["admin", "prayer_team"]);
    if (staffEmails.length === 0) {
      return;
    }

    await Promise.all(
      staffEmails.map((email) =>
        dispatchManagedNotification({
          key: "new_board_request",
          email,
          vars: {
            request_title: row.title,
            category: row.category,
            app_url: appUrl("/requests")
          }
        })
      )
    );
  });
}

/** Call when a request is created and may already be live on the board. */
export async function onPrayerRequestCreated(input: {
  requestId: string;
  visibility: string;
  boardModeration: string;
  publishAt: Date | null;
}) {
  if (
    input.visibility === "church_anonymous" &&
    input.boardModeration === "published" &&
    (!input.publishAt || input.publishAt.getTime() <= Date.now())
  ) {
    return onBoardRequestPublished({ requestId: input.requestId });
  }
  return { ok: true as const };
}
