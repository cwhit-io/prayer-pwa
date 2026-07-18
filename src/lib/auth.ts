import crypto from "node:crypto";
import { cookies } from "next/headers";
import { query } from "@/lib/postgres";

export const SESSION_COOKIE_NAME = "prayer_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;

/** Church staff domain — any login/contact email here is granted admin. */
export const STAFF_ADMIN_EMAIL_DOMAIN = "blackhawkministries.org";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  planningCenterPersonId: string | null;
  planningCenterDisplayName: string | null;
  planningCenterSyncStatus: string;
};

/** True when the address is on the Blackhawk Ministries staff domain. */
export function isStaffAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) {
    return false;
  }
  return normalized.slice(at + 1) === STAFF_ADMIN_EMAIL_DOMAIN;
}

export function roleForEmail(email: string | null | undefined, fallback = "member"): string {
  return isStaffAdminEmail(email) ? "admin" : fallback;
}

/**
 * Elevate to admin when the account email or any verified email contact is staff domain.
 * Safe to call on every login; only updates when needed.
 */
export async function elevateStaffAdminIfEligible(userId: string) {
  await query(
    `update app_users u
     set role = 'admin'
     where u.id = $1
       and u.role is distinct from 'admin'
       and (
         lower(split_part(u.email, '@', 2)) = $2
         or exists (
           select 1
           from user_contact_methods m
           where m.user_id = u.id
             and m.type = 'email'
             and lower(split_part(m.value_normalized, '@', 2)) = $2
         )
       )`,
    [userId, STAFF_ADMIN_EMAIL_DOMAIN]
  );
}

type SessionUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  planning_center_person_id: string | null;
  planning_center_display_name: string | null;
  planning_center_sync_status: string;
};

export async function createSessionForUser(userId: string) {
  // Staff @blackhawkministries.org become admin on sign-in.
  await elevateStaffAdminIfEligible(userId);

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

export async function signOutCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
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

  // Already signed in with staff email — promote without forcing re-login.
  if (row.role !== "admin") {
    await elevateStaffAdminIfEligible(row.id);
    if (
      isStaffAdminEmail(row.email) ||
      (await hasStaffAdminContact(row.id))
    ) {
      row.role = "admin";
    }
  }

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

async function hasStaffAdminContact(userId: string) {
  const result = await query<{ ok: number }>(
    `select 1 as ok
     from user_contact_methods
     where user_id = $1
       and type = 'email'
       and lower(split_part(value_normalized, '@', 2)) = $2
     limit 1`,
    [userId, STAFF_ADMIN_EMAIL_DOMAIN]
  );
  return Boolean(result.rows[0]);
}

const APP_USER_ROLES = ["member", "admin", "prayer_team"] as const;
export type AppUserRole = (typeof APP_USER_ROLES)[number];

export function isAppUserRole(value: string): value is AppUserRole {
  return (APP_USER_ROLES as readonly string[]).includes(value);
}

/**
 * Admin People tab: set a user's app role.
 * Blocks demoting the last remaining admin.
 */
export async function setAppUserRole(input: {
  userId: string;
  role: AppUserRole;
  actorUserId: string;
}) {
  if (!isAppUserRole(input.role)) {
    throw new Error("Invalid role.");
  }

  const current = await query<{ id: string; role: string }>(
    `select id, role from app_users where id = $1 limit 1`,
    [input.userId]
  );
  const row = current.rows[0];
  if (!row) {
    throw new Error("User not found.");
  }

  if (row.role === "admin" && input.role !== "admin") {
    const remaining = await query<{ count: string }>(
      `select count(*)::text as count
       from app_users
       where role = 'admin'
         and id <> $1`,
      [input.userId]
    );
    if (Number(remaining.rows[0]?.count ?? 0) < 1) {
      throw new Error("Cannot remove the last admin. Promote someone else first.");
    }
  }

  await query(`update app_users set role = $2 where id = $1`, [input.userId, input.role]);

  return { userId: input.userId, role: input.role, actorUserId: input.actorUserId };
}

export async function upsertUserByEmail(input: {
  name: string;
  email: string;
  role?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const role = roleForEmail(email, input.role ?? "member");

  // Preserve elevated roles on re-sign-in; always elevate staff emails to admin.
  const result = await query<{
    id: string;
    name: string;
    email: string;
    role: string;
    planning_center_person_id: string | null;
    planning_center_display_name: string | null;
    planning_center_sync_status: string;
  }>(
    `insert into app_users (name, email, role)
     values ($1, $2, $3)
     on conflict (email) do update
     set name = excluded.name,
         role = case
           when lower(split_part(excluded.email, '@', 2)) = $4 then 'admin'
           else app_users.role
         end
     returning
       id,
       name,
       email,
       role,
       planning_center_person_id,
       planning_center_display_name,
       planning_center_sync_status`,
    [input.name, email, role, STAFF_ADMIN_EMAIL_DOMAIN]
  );

  const row = result.rows[0];
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
