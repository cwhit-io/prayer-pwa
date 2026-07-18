import { query } from "@/lib/postgres";

const PREFS_SCHEMA = `
create table if not exists user_notification_preferences (
  user_id uuid primary key references app_users(id) on delete cascade,
  email_prayer_request_updates boolean not null default false,
  updated_at timestamptz not null default now()
);
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
};

export async function getUserNotificationPreferences(
  userId: string
): Promise<UserNotificationPreferences> {
  await ensureNotificationPreferencesSchema();
  const result = await query<{ email_prayer_request_updates: boolean }>(
    `select email_prayer_request_updates
     from user_notification_preferences
     where user_id = $1
     limit 1`,
    [userId]
  );

  return {
    userId,
    emailPrayerRequestUpdates: Boolean(result.rows[0]?.email_prayer_request_updates)
  };
}

export async function saveUserNotificationPreferences(input: {
  userId: string;
  emailPrayerRequestUpdates: boolean;
}) {
  await ensureNotificationPreferencesSchema();
  await query(
    `insert into user_notification_preferences (user_id, email_prayer_request_updates, updated_at)
     values ($1, $2, now())
     on conflict (user_id) do update
     set email_prayer_request_updates = excluded.email_prayer_request_updates,
         updated_at = now()`,
    [input.userId, input.emailPrayerRequestUpdates]
  );
}

/** Best deliverable email for a user (verified contact method preferred). */
export async function getUserNotifyEmail(userId: string): Promise<string | null> {
  const contact = await query<{ value_normalized: string }>(
    `select value_normalized
     from user_contact_methods
     where user_id = $1
       and type = 'email'
       and verified_at is not null
     order by verified_at desc
     limit 1`,
    [userId]
  );

  if (contact.rows[0]?.value_normalized) {
    return contact.rows[0].value_normalized;
  }

  const user = await query<{ email: string }>(
    `select email from app_users where id = $1 limit 1`,
    [userId]
  );
  const email = user.rows[0]?.email?.trim().toLowerCase() ?? null;
  if (!email) {
    return null;
  }
  if (email.endsWith("@guest.local") || email.endsWith("@planningcenter.local")) {
    return null;
  }
  return email;
}

export async function listStaffNotifyEmails(roles: string[] = ["admin", "prayer_team"]) {
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
