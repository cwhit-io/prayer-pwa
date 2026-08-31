import crypto from "node:crypto";
import { cookies } from "next/headers";
import { query, withTransaction } from "@/lib/postgres";
import { isAppUserRole, type AppUserRole } from "@/lib/permissions";

export { APP_USER_ROLES, hasCapability, isAppUserRole } from "@/lib/permissions";
export type { AppCapability, AppUserRole } from "@/lib/permissions";

export const SESSION_COOKIE_NAME = "prayer_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_DURATION_MS = SESSION_DURATION_SECONDS * 1000;

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: AppUserRole;
  planningCenterPersonId: string | null;
  planningCenterDisplayName: string | null;
  planningCenterSyncStatus: string;
};

type SessionUserRow = {
  id: string;
  name: string;
  email: string;
  role: AppUserRole;
  planning_center_person_id: string | null;
  planning_center_display_name: string | null;
  planning_center_sync_status: string;
};

export async function createSessionForUser(userId: string) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

  await query(
    `insert into auth_sessions (token, user_id, expires_at)
     values ($1, $2, $3)
     on conflict (token) do update
     set user_id = excluded.user_id,
         expires_at = excluded.expires_at`,
    [token, userId, expiresAt]
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/"
  });

  return token;
}

export async function refreshSessionToken(token: string) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const result = await query<{ token: string }>(
    `update auth_sessions
     set expires_at = $2
     where token = $1
       and expires_at > now()
     returning token`,
    [token, expiresAt]
  );

  if (!result.rows[0]) {
    return null;
  }

  return { token, expiresAt };
}

export async function signOutCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const session = await query<{ user_id: string; is_demo: boolean }>(
      `select s.user_id, coalesce(u.is_demo, false) as is_demo
       from auth_sessions s
       join app_users u on u.id = s.user_id
       where s.token = $1
       limit 1`,
      [token]
    );
    const row = session.rows[0];
    if (row?.is_demo) {
      await query(`delete from prayer_friend_slots where user_id = $1`, [row.user_id]);
      await query(`delete from prayer_sessions where user_id = $1`, [row.user_id]);
    }
    await query("delete from auth_sessions where token = $1", [token]);
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const result = await query<SessionUserRow>(
    `select
       u.id,
       u.name,
       u.email,
       u.role,
       u.planning_center_person_id,
       u.planning_center_display_name,
       u.planning_center_sync_status
     from auth_sessions s
     join app_users u on u.id = s.user_id
     where s.token = $1
       and s.expires_at > now()
     limit 1`,
    [token]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  await query(
    `update app_users
     set first_seen_at = coalesce(first_seen_at, now()),
         last_seen_at = now()
     where id = $1
       and (
         first_seen_at is null
         or last_seen_at is null
         or last_seen_at < now() - interval '15 minutes'
       )`,
    [row.id]
  );

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    planningCenterPersonId: row.planning_center_person_id,
    planningCenterDisplayName: row.planning_center_display_name,
    planningCenterSyncStatus: row.planning_center_sync_status
  };
}

/**
 * Superadmin People tab: set a user's app role, revoke existing sessions, and
 * retain an audit trail. The database also protects the final superadmin.
 */
export async function setAppUserRole(input: {
  userId: string;
  role: AppUserRole;
  actorUserId: string;
}) {
  if (!isAppUserRole(input.role)) {
    throw new Error("Invalid role.");
  }

  await withTransaction(async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtext('app_user_role_change'))");
    const actor = await client.query<{ role: string }>(
      `select role from app_users where id = $1 for update`,
      [input.actorUserId]
    );
    if (actor.rows[0]?.role !== "superadmin") {
      throw new Error("Superadmin access is required.");
    }

    const current = await client.query<{ id: string; role: string }>(
      `select id, role from app_users where id = $1 for update`,
      [input.userId]
    );
    const row = current.rows[0];
    if (!row) {
      throw new Error("User not found.");
    }
    if (row.role === input.role) {
      return;
    }

    if (row.role === "superadmin" && input.role !== "superadmin") {
      const remaining = await client.query<{ count: string }>(
        `select count(*)::text as count from app_users where role = 'superadmin' and id <> $1`,
        [input.userId]
      );
      if (Number(remaining.rows[0]?.count ?? 0) < 1) {
        throw new Error("Cannot remove the final superadmin. Promote someone else first.");
      }
    }

    await client.query(`update app_users set role = $2 where id = $1`, [input.userId, input.role]);
    await client.query(`delete from auth_sessions where user_id = $1`, [input.userId]);
    await client.query(
      `insert into authorization_audit_log (actor_user_id, target_user_id, action, details)
       values ($1, $2, 'role_changed', jsonb_build_object('from', $3::text, 'to', $4::text))`,
      [input.actorUserId, input.userId, row.role, input.role]
    );
  });

  return { userId: input.userId, role: input.role, actorUserId: input.actorUserId };
}
