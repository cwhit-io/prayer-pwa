import { query } from "@/lib/postgres";

const PREFS_SCHEMA = `
create table if not exists user_notification_preferences (
  user_id uuid primary key references app_users(id) on delete cascade,
  email_prayer_request_updates boolean not null default false,
  email_pledge_invitations boolean not null default false,
  email_progress_updates boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table user_notification_preferences
  add column if not exists email_pledge_invitations boolean not null default false;
alter table user_notification_preferences
  alter column email_pledge_invitations set default false;
alter table user_notification_preferences
  add column if not exists email_progress_updates boolean not null default false;
`;

let prefsReady: Promise<void> | null = null;

export async function ensureNotificationPreferencesSchema() {
  if (!prefsReady) {
    prefsReady = query(PREFS_SCHEMA)
      .then(() => undefined)
      .catch((error) => {
        prefsReady = null;
        throw error;
      });
  }
  await prefsReady;
}

export type UserNotificationPreferences = {
  userId: string;
  /** Opt-in: email me when someone prays for my prayer requests. */
  emailPrayerRequestUpdates: boolean;
  emailPledgeInvitations: boolean;
  emailProgressUpdates: boolean;
};

export async function getUserNotificationPreferences(
  userId: string
): Promise<UserNotificationPreferences> {
  await ensureNotificationPreferencesSchema();
  const result = await query<{
    email_prayer_request_updates: boolean;
    email_pledge_invitations: boolean;
    email_progress_updates: boolean;
  }>(
    `select email_prayer_request_updates, email_pledge_invitations, email_progress_updates
     from user_notification_preferences
     where user_id = $1
     limit 1`,
    [userId]
  );

  return {
    userId,
    emailPrayerRequestUpdates: Boolean(result.rows[0]?.email_prayer_request_updates),
    emailPledgeInvitations: result.rows[0]?.email_pledge_invitations ?? false,
    emailProgressUpdates: result.rows[0]?.email_progress_updates ?? false
  };
}

export async function saveUserNotificationPreferences(input: {
  userId: string;
  emailPrayerRequestUpdates: boolean;
  emailPledgeInvitations: boolean;
  emailProgressUpdates: boolean;
}) {
  await ensureNotificationPreferencesSchema();
  await query(
    `insert into user_notification_preferences (
       user_id, email_prayer_request_updates, email_pledge_invitations, email_progress_updates, updated_at
     )
     values ($1, $2, $3, $4, now())
     on conflict (user_id) do update
     set email_prayer_request_updates = excluded.email_prayer_request_updates,
         email_pledge_invitations = excluded.email_pledge_invitations,
         email_progress_updates = excluded.email_progress_updates,
         updated_at = now()`,
    [
      input.userId,
      input.emailPrayerRequestUpdates,
      input.emailPledgeInvitations,
      input.emailProgressUpdates
    ]
  );
}

/** Deliverable personal email; shared household authorization addresses are excluded. */
export async function getUserNotifyEmail(userId: string): Promise<string | null> {
  const contact = await query<{ value_normalized: string }>(
    `select own.value_normalized
     from user_contact_methods own
     where own.user_id = $1
       and own.type = 'email'
       and own.verified_at is not null
       and 1 = (
         select count(distinct shared.user_id)
         from user_contact_methods shared
         where shared.type = 'email'
           and shared.verified_at is not null
           and lower(shared.value_normalized) = lower(own.value_normalized)
       )
     order by own.verified_at desc
     limit 1`,
    [userId]
  );

  if (contact.rows[0]?.value_normalized) {
    return contact.rows[0].value_normalized;
  }

  return null;
}

export async function listStaffNotifyEmails(roles: string[] = ["admin", "prayer_team", "superadmin"]) {
  const result = await query<{ id: string; email: string | null }>(
    `select u.id, u.email
     from app_users u
     where u.role = any($1::text[])`,
    [roles]
  );

  const emails: string[] = [];
  const seen = new Set<string>();

  for (const row of result.rows) {
    const resolved = await getUserNotifyEmail(row.id);
    if (!resolved || seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);
    emails.push(resolved);
  }

  return emails;
}
