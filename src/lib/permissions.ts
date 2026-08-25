export const APP_USER_ROLES = ["member", "prayer_team", "admin", "superadmin"] as const;

export type AppUserRole = (typeof APP_USER_ROLES)[number];

export const APP_CAPABILITIES = [
  "staff:access",
  "prayer-content:manage",
  "member-entries:manage",
  "people:add",
  "member-progress:read",
  "community-requests:moderate",
  "private-requests:read",
  "campaign-settings:manage",
  "notifications:manage",
  "directory:manage",
  "roles:manage",
  "secrets:manage"
] as const;

export type AppCapability = (typeof APP_CAPABILITIES)[number];

const ROLE_CAPABILITIES: Record<AppUserRole, ReadonlySet<AppCapability>> = {
  member: new Set(),
  prayer_team: new Set([
    "staff:access",
    "prayer-content:manage",
    "member-entries:manage",
    "people:add"
  ]),
  admin: new Set([
    "staff:access",
    "prayer-content:manage",
    "member-entries:manage",
    "people:add",
    "member-progress:read",
    "community-requests:moderate"
  ]),
  superadmin: new Set(APP_CAPABILITIES)
};

export function isAppUserRole(value: string): value is AppUserRole {
  return (APP_USER_ROLES as readonly string[]).includes(value);
}

export function hasCapability(
  role: string | null | undefined,
  capability: AppCapability
): boolean {
  return Boolean(role && isAppUserRole(role) && ROLE_CAPABILITIES[role].has(capability));
}
