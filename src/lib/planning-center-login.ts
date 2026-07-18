import crypto from "node:crypto";
import { dispatchManagedNotification } from "@/lib/notification-admin";
import {
  fetchPrayerPeopleForPerson,
  findLoginCandidatesByContact,
  type PcoLoginCandidate
} from "@/lib/pco-client";
import { replacePrayerPeopleForUser } from "@/lib/pco-people";
import { roleForEmail } from "@/lib/auth";
import { query } from "@/lib/postgres";
import { getPlanningCenterCredentials, getTwilioCredentials } from "@/lib/settings";
import { checkTwilioVerify, startTwilioVerify } from "@/lib/twilio";

const CHALLENGE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
/** Stored in login_challenges.code_hash when OTP is handled by Twilio Verify (not a local hash). */
const TWILIO_VERIFY_CODE_HASH = "twilio_verify";
/** Max login codes per contact method in a rolling hour. */
const MAX_CODES_PER_HOUR = 5;
/** Max login code requests across the app per hour (abuse guard). */
const MAX_GLOBAL_CODES_PER_HOUR = 200;

export type ContactType = "email" | "phone";

export type LoginCandidate = PcoLoginCandidate;

type ChallengeRow = {
  id: string;
  destination_type: ContactType;
  destination_normalized: string;
  code_hash: string;
  expires_at: string | Date;
  verified_at: string | Date | null;
  consumed_at: string | Date | null;
  attempt_count: number;
  candidate_people: LoginCandidate[];
  debug_code: string | null;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  planning_center_person_id: string | null;
  planning_center_display_name: string | null;
  planning_center_sync_status: string;
};

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function normalizeLoginContact(value: string) {
  const trimmed = value.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const type: ContactType = isEmail ? "email" : "phone";
  const normalized = isEmail ? normalizeEmail(trimmed) : normalizePhone(trimmed);

  if (type === "email" && !normalized) {
    throw new Error("Enter a valid email address.");
  }

  if (type === "phone" && normalized.replace(/\D/g, "").length < 10) {
    throw new Error("Enter a valid phone number.");
  }

  return { type, normalized };
}

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function createCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function syntheticEmailForPerson(personId: string) {
  return `pco-${personId}@planningcenter.local`;
}

/** Account email when registering without Planning Center (email contact uses real address). */
function unlinkedAccountEmail(contactType: ContactType, contact: string) {
  if (contactType === "email") {
    return contact;
  }
  const digits = contact.replace(/\D/g, "");
  return `phone-${digits}@unlinked.local`;
}

function mapUserRow(user: UserRow) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    planningCenterPersonId: user.planning_center_person_id,
    planningCenterDisplayName: user.planning_center_display_name,
    planningCenterSyncStatus: user.planning_center_sync_status
  };
}

async function findUserIdByContact(contactType: ContactType, contact: string) {
  const byMethod = await query<{ user_id: string }>(
    `select user_id
     from user_contact_methods
     where type = $1
       and value_normalized = $2
     order by verified_at desc nulls last, created_at desc
     limit 1`,
    [contactType, contact]
  );
  if (byMethod.rows[0]?.user_id) {
    return byMethod.rows[0].user_id;
  }

  if (contactType === "email") {
    const byEmail = await query<{ id: string }>(
      `select id from app_users where lower(email) = lower($1) limit 1`,
      [contact]
    );
    return byEmail.rows[0]?.id ?? null;
  }

  const phoneEmail = unlinkedAccountEmail("phone", contact);
  const byPhoneEmail = await query<{ id: string }>(
    `select id from app_users where email = $1 limit 1`,
    [phoneEmail]
  );
  return byPhoneEmail.rows[0]?.id ?? null;
}

async function loadUserRow(userId: string) {
  const result = await query<UserRow>(
    `select id, name, email, role, planning_center_person_id, planning_center_display_name, planning_center_sync_status
     from app_users
     where id = $1
     limit 1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

async function attachContactMethod(input: {
  userId: string;
  contactType: ContactType;
  contact: string;
  planningCenterPersonId?: string | null;
}) {
  await query(
    `insert into user_contact_methods (
       user_id,
       type,
       value_normalized,
       verified_at,
       planning_center_person_id
     )
     values ($1, $2, $3, now(), $4)
     on conflict (user_id, type, value_normalized) do update
     set verified_at = now(),
         planning_center_person_id = coalesce(excluded.planning_center_person_id, user_contact_methods.planning_center_person_id)`,
    [input.userId, input.contactType, input.contact, input.planningCenterPersonId ?? null]
  );
}

async function enforceLoginRateLimits(contactType: ContactType, contact: string) {
  const perContact = await query<{ count: string }>(
    `select count(*)::text as count
     from login_challenges
     where destination_type = $1
       and destination_normalized = $2
       and created_at > now() - interval '1 hour'`,
    [contactType, contact]
  );

  if (Number(perContact.rows[0]?.count ?? 0) >= MAX_CODES_PER_HOUR) {
    throw new Error("Too many login codes requested for this contact. Try again in about an hour.");
  }

  const global = await query<{ count: string }>(
    `select count(*)::text as count
     from login_challenges
     where created_at > now() - interval '1 hour'`
  );

  if (Number(global.rows[0]?.count ?? 0) >= MAX_GLOBAL_CODES_PER_HOUR) {
    throw new Error("Login is temporarily busy. Please try again shortly.");
  }
}

/**
 * Look up household people in Planning Center.
 * Empty array = not in directory → unlinked account registration after OTP.
 */
async function findPlanningCenterCandidates(contactType: ContactType, contact: string) {
  const credentials = await getPlanningCenterCredentials();
  if (!credentials.configured) {
    // Still allow OTP + unlinked registration without PCO.
    return [] as LoginCandidate[];
  }

  try {
    return await findLoginCandidatesByContact({ contactType, contact });
  } catch {
    // Directory lookup failed — allow unlinked registration rather than blocking sign-in.
    return [] as LoginCandidate[];
  }
}

async function cacheCandidates(candidates: LoginCandidate[]) {
  for (const candidate of candidates) {
    if (candidate.personId.startsWith("local-")) {
      continue;
    }

    await query(
      `insert into planning_center_people_cache (
         planning_center_person_id,
         name,
         first_name,
         last_name,
         primary_email,
         primary_phone,
         household_ids,
         synced_at
       )
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
       on conflict (planning_center_person_id) do update
       set name = excluded.name,
           first_name = excluded.first_name,
           last_name = excluded.last_name,
           primary_email = excluded.primary_email,
           primary_phone = excluded.primary_phone,
           household_ids = excluded.household_ids,
           synced_at = now()`,
      [
        candidate.personId,
        candidate.name,
        candidate.firstName,
        candidate.lastName,
        candidate.email,
        candidate.phone,
        JSON.stringify(candidate.householdId ? [candidate.householdId] : [])
      ]
    );

    if (candidate.householdId && !candidate.householdId.startsWith("local-")) {
      const householdMembers = candidates.filter((item) => item.householdId === candidate.householdId);
      await query(
        `insert into planning_center_households_cache (
           planning_center_household_id,
           name,
           primary_contact_person_id,
           members,
           synced_at
         )
         values ($1, $2, $3, $4::jsonb, now())
         on conflict (planning_center_household_id) do update
         set name = excluded.name,
             primary_contact_person_id = excluded.primary_contact_person_id,
             members = excluded.members,
             synced_at = now()`,
        [
          candidate.householdId,
          candidate.householdName || "Household",
          householdMembers[0]?.personId ?? null,
          JSON.stringify(householdMembers)
        ]
      );
    }
  }
}

async function sendLoginCode(input: {
  contactType: ContactType;
  contact: string;
  code: string;
}) {
  try {
    const result = await dispatchManagedNotification({
      key: "login_code",
      email: input.contactType === "email" ? input.contact : null,
      phone: input.contactType === "phone" ? input.contact : null,
      vars: {
        code: input.code,
        minutes: CHALLENGE_MINUTES,
        contact: input.contact
      },
      force: true
    });

    if (result.skipped) {
      return { delivered: false, error: `Login code notification ${result.reason}` };
    }

    const delivered = result.results.some((item) => item.ok);
    const error = result.results.find((item) => !item.ok)?.error ?? null;
    return { delivered, error };
  } catch (error) {
    return {
      delivered: false,
      error: error instanceof Error ? error.message : "Delivery failed"
    };
  }
}

export async function startPlanningCenterLogin(contactInput: string) {
  const { type, normalized } = normalizeLoginContact(contactInput);
  await enforceLoginRateLimits(type, normalized);

  // May be empty — after OTP the person can create an unlinked account.
  const candidates = await findPlanningCenterCandidates(type, normalized);

  // Phone login OTPs go through Twilio Verify (Twilio owns the code).
  // Email keeps app-generated codes via Elastic Email / managed notification.
  if (type === "phone") {
    const twilio = await getTwilioCredentials();
    let delivery: { delivered: boolean; error: string | null } = {
      delivered: false,
      error: null
    };
    let codeHash = TWILIO_VERIFY_CODE_HASH;
    let storeDebugCode: string | null = null;

    if (twilio.verifyConfigured) {
      try {
        await startTwilioVerify({ to: normalized, channel: "sms" });
        delivery = { delivered: true, error: null };
      } catch (error) {
        delivery = {
          delivered: false,
          error: error instanceof Error ? error.message : "Twilio Verify failed"
        };
      }
    } else if (!isProduction()) {
      // Dev without Verify credentials: fall back to local debug OTP.
      const code = createCode();
      codeHash = hashCode(code);
      storeDebugCode = code;
      delivery = { delivered: false, error: "Twilio Verify not configured (dev debug code)." };
    } else {
      delivery = {
        delivered: false,
        error: "Twilio Verify is not configured (Account SID, Auth Token, Verify Service SID)."
      };
    }

    if (!delivery.delivered && isProduction()) {
      throw new Error(
        delivery.error
          ? `Could not send your login code: ${delivery.error}`
          : "Could not send your login code. SMS verification is not configured."
      );
    }

    // If Verify failed in dev, still allow local debug OTP so login can be tested.
    if (!delivery.delivered && !isProduction() && codeHash === TWILIO_VERIFY_CODE_HASH) {
      const code = createCode();
      codeHash = hashCode(code);
      storeDebugCode = code;
    }

    const result = await query<{ id: string }>(
      `insert into login_challenges (
         destination_type,
         destination_normalized,
         code_hash,
         expires_at,
         candidate_people,
         debug_code
       )
       values ($1, $2, $3, now() + ($4 || ' minutes')::interval, $5::jsonb, $6)
       returning id`,
      [
        type,
        normalized,
        codeHash,
        CHALLENGE_MINUTES,
        JSON.stringify(candidates),
        storeDebugCode
      ]
    );

    await cacheCandidates(candidates);

    return {
      challengeId: result.rows[0].id,
      contactType: type,
      contact: normalized,
      delivery: delivery.delivered ? ("sent" as const) : ("debug" as const),
      debugCode: storeDebugCode,
      hasPlanningCenterMatch: candidates.length > 0
    };
  }

  const code = createCode();
  const delivery = await sendLoginCode({ contactType: type, contact: normalized, code }).catch(
    (error: unknown) => ({
      delivered: false,
      error: error instanceof Error ? error.message : "Delivery failed"
    })
  );

  // Production requires real delivery (Elastic Email). Dev may show debug code.
  if (!delivery.delivered && isProduction()) {
    throw new Error(
      delivery.error
        ? `Could not send your login code: ${delivery.error}`
        : "Could not send your login code. Email is not configured."
    );
  }

  const storeDebugCode = !isProduction() && !delivery.delivered ? code : !isProduction() ? code : null;

  const result = await query<{ id: string }>(
    `insert into login_challenges (
       destination_type,
       destination_normalized,
       code_hash,
       expires_at,
       candidate_people,
       debug_code
     )
     values ($1, $2, $3, now() + ($4 || ' minutes')::interval, $5::jsonb, $6)
     returning id`,
    [
      type,
      normalized,
      hashCode(code),
      CHALLENGE_MINUTES,
      JSON.stringify(candidates),
      storeDebugCode
    ]
  );

  await cacheCandidates(candidates);

  return {
    challengeId: result.rows[0].id,
    contactType: type,
    contact: normalized,
    delivery: delivery.delivered ? ("sent" as const) : ("debug" as const),
    debugCode: storeDebugCode,
    hasPlanningCenterMatch: candidates.length > 0
  };
}

export async function verifyPlanningCenterLoginCode(input: {
  challengeId: string;
  code: string;
}) {
  const challengeResult = await query<ChallengeRow>(
    `select id,
            destination_type,
            destination_normalized,
            code_hash,
            expires_at,
            verified_at,
            consumed_at,
            attempt_count,
            candidate_people,
            debug_code
     from login_challenges
     where id = $1
     limit 1`,
    [input.challengeId]
  );

  const challenge = challengeResult.rows[0];
  if (!challenge) {
    throw new Error("Login code was not found. Please request a new code.");
  }

  if (challenge.consumed_at) {
    throw new Error("This login code has already been used. Please request a new code.");
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    throw new Error("This login code expired. Please request a new code.");
  }

  if (challenge.attempt_count >= MAX_ATTEMPTS) {
    throw new Error("Too many attempts. Please request a new code.");
  }

  let valid = false;

  if (challenge.code_hash === TWILIO_VERIFY_CODE_HASH) {
    // Phone OTP managed by Twilio Verify.
    try {
      const check = await checkTwilioVerify({
        to: challenge.destination_normalized,
        code: input.code.trim()
      });
      valid = check.ok;
    } catch (error) {
      await query(
        `update login_challenges set attempt_count = attempt_count + 1 where id = $1`,
        [input.challengeId]
      );
      throw error instanceof Error
        ? error
        : new Error("Could not verify code with Twilio.");
    }
  } else {
    const providedHash = hashCode(input.code.trim());
    const expectedHash = challenge.code_hash;
    valid =
      providedHash.length === expectedHash.length &&
      crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(expectedHash));
  }

  if (!valid) {
    await query(
      `update login_challenges set attempt_count = attempt_count + 1 where id = $1`,
      [input.challengeId]
    );
    throw new Error("That code did not match.");
  }

  await query(`update login_challenges set verified_at = now() where id = $1`, [input.challengeId]);

  return {
    challengeId: challenge.id,
    contactType: challenge.destination_type,
    contact: challenge.destination_normalized,
    candidates: challenge.candidate_people
  };
}

export async function getVerifiedLoginChallenge(challengeId: string) {
  const result = await query<ChallengeRow>(
    `select id,
            destination_type,
            destination_normalized,
            code_hash,
            expires_at,
            verified_at,
            consumed_at,
            attempt_count,
            candidate_people,
            debug_code
     from login_challenges
     where id = $1
       and verified_at is not null
       and consumed_at is null
       and expires_at > now()
     limit 1`,
    [challengeId]
  );

  const challenge = result.rows[0];
  if (!challenge) {
    return null;
  }

  return {
    challengeId: challenge.id,
    contactType: challenge.destination_type,
    contact: challenge.destination_normalized,
    candidates: challenge.candidate_people
  };
}

export async function getPendingLoginChallenge(challengeId: string) {
  const result = await query<ChallengeRow>(
    `select id,
            destination_type,
            destination_normalized,
            code_hash,
            expires_at,
            verified_at,
            consumed_at,
            attempt_count,
            candidate_people,
            debug_code
     from login_challenges
     where id = $1
       and verified_at is null
       and consumed_at is null
       and expires_at > now()
     limit 1`,
    [challengeId]
  );

  const challenge = result.rows[0];
  if (!challenge) {
    return null;
  }

  return {
    challengeId: challenge.id,
    contactType: challenge.destination_type,
    contact: challenge.destination_normalized,
    debugCode: challenge.debug_code
  };
}

export async function completePlanningCenterLogin(input: {
  challengeId: string;
  personId: string;
}) {
  const result = await query<ChallengeRow>(
    `select id,
            destination_type,
            destination_normalized,
            code_hash,
            expires_at,
            verified_at,
            consumed_at,
            attempt_count,
            candidate_people,
            debug_code
     from login_challenges
     where id = $1
       and verified_at is not null
       and consumed_at is null
       and expires_at > now()
     limit 1`,
    [input.challengeId]
  );

  const challenge = result.rows[0];
  if (!challenge) {
    throw new Error("Your verified login has expired. Please request a new code.");
  }

  const verified = {
    challengeId: challenge.id,
    contactType: challenge.destination_type,
    contact: challenge.destination_normalized,
    candidates: challenge.candidate_people
  };

  const candidate = verified.candidates.find((item) => item.personId === input.personId);
  if (!candidate) {
    throw new Error("Please choose one of the verified household members.");
  }

  const userResult = await query<UserRow>(
    `insert into app_users (
       name,
       email,
       role,
       planning_center_person_id,
       planning_center_display_name,
       planning_center_linked_at,
       planning_center_sync_status,
       planning_center_last_synced_at
     )
     values ($1, $2, 'member', $3, $1, now(), 'linked', now())
     on conflict (planning_center_person_id) where planning_center_person_id is not null do update
     set name = excluded.name,
         planning_center_display_name = excluded.planning_center_display_name,
         planning_center_linked_at = coalesce(app_users.planning_center_linked_at, now()),
         planning_center_sync_status = 'linked',
         planning_center_last_synced_at = now()
     returning
       id,
       name,
       email,
       role,
       planning_center_person_id,
       planning_center_display_name,
       planning_center_sync_status`,
    [candidate.name, syntheticEmailForPerson(candidate.personId), candidate.personId]
  );

  const user = userResult.rows[0];

  await attachContactMethod({
    userId: user.id,
    contactType: verified.contactType,
    contact: verified.contact,
    planningCenterPersonId: candidate.personId
  });

  await query(`update login_challenges set consumed_at = now() where id = $1`, [input.challengeId]);

  // Full Family + Friends pull when this is a real PCO person (not local dev fallback).
  if (!candidate.personId.startsWith("local-")) {
    try {
      const related = await fetchPrayerPeopleForPerson(candidate.personId);
      await replacePrayerPeopleForUser(user.id, related);
    } catch {
      // Fall back to household candidates from the login challenge if Groups/People pull fails.
      const householdMembers = verified.candidates
        .filter(
          (item) =>
            item.householdId &&
            item.householdId === candidate.householdId &&
            item.personId !== candidate.personId
        )
        .map((item) => ({
          planningCenterPersonId: item.personId,
          name: item.name,
          email: item.email,
          focusArea: "family" as const,
          sourceType: "household" as const,
          sourceGroupPcId: item.householdId ?? "",
          sourceGroupName: item.householdName
        }));

      if (householdMembers.length > 0) {
        await replacePrayerPeopleForUser(user.id, householdMembers);
      }
    }
  } else {
    const householdMembers = verified.candidates
      .filter(
        (item) =>
          item.householdId &&
          item.householdId === candidate.householdId &&
          item.personId !== candidate.personId
      )
      .map((item) => ({
        planningCenterPersonId: item.personId,
        name: item.name,
        email: item.email,
        focusArea: "family" as const,
        sourceType: "household" as const,
        sourceGroupPcId: item.householdId ?? "",
        sourceGroupName: item.householdName
      }));

    if (householdMembers.length > 0) {
      await replacePrayerPeopleForUser(user.id, householdMembers);
    }
  }

  return mapUserRow(user);
}

/**
 * Finish login when the contact is not in Planning Center.
 * Reuses an existing account that already verified this contact; otherwise creates one (unlinked).
 */
export async function completeUnlinkedLogin(input: {
  challengeId: string;
  name?: string | null;
}) {
  const result = await query<ChallengeRow>(
    `select id,
            destination_type,
            destination_normalized,
            code_hash,
            expires_at,
            verified_at,
            consumed_at,
            attempt_count,
            candidate_people,
            debug_code
     from login_challenges
     where id = $1
       and verified_at is not null
       and consumed_at is null
       and expires_at > now()
     limit 1`,
    [input.challengeId]
  );

  const challenge = result.rows[0];
  if (!challenge) {
    throw new Error("Your verified login has expired. Please request a new code.");
  }

  const contactType = challenge.destination_type;
  const contact = challenge.destination_normalized;

  const existingUserId = await findUserIdByContact(contactType, contact);
  if (existingUserId) {
    const existing = await loadUserRow(existingUserId);
    if (!existing) {
      throw new Error("Account not found. Please request a new code.");
    }

    const displayName = input.name?.trim();
    if (displayName && displayName !== existing.name) {
      await query(`update app_users set name = $2 where id = $1`, [existing.id, displayName]);
      existing.name = displayName;
    }

    await attachContactMethod({
      userId: existing.id,
      contactType,
      contact,
      planningCenterPersonId: existing.planning_center_person_id
    });
    await query(`update login_challenges set consumed_at = now() where id = $1`, [input.challengeId]);
    return mapUserRow(existing);
  }

  const name = input.name?.trim();
  if (!name) {
    throw new Error("Enter your name to create a prayer account.");
  }

  const email = unlinkedAccountEmail(contactType, contact);
  const role = roleForEmail(contactType === "email" ? contact : email);

  const userResult = await query<UserRow>(
    `insert into app_users (
       name,
       email,
       role,
       planning_center_person_id,
       planning_center_display_name,
       planning_center_linked_at,
       planning_center_sync_status,
       planning_center_last_synced_at
     )
     values ($1, $2, $3, null, null, null, 'unlinked', null)
     on conflict (email) do update
     set name = excluded.name,
         role = case when excluded.role = 'admin' then 'admin' else app_users.role end
     returning
       id,
       name,
       email,
       role,
       planning_center_person_id,
       planning_center_display_name,
       planning_center_sync_status`,
    [name, email, role]
  );

  const user = userResult.rows[0];
  if (!user) {
    throw new Error("Could not create your account.");
  }

  await attachContactMethod({
    userId: user.id,
    contactType,
    contact,
    planningCenterPersonId: null
  });
  await query(`update login_challenges set consumed_at = now() where id = $1`, [input.challengeId]);

  return mapUserRow(user);
}

/** Whether this verified challenge has Planning Center people to pick from. */
export async function challengeHasPlanningCenterCandidates(challengeId: string) {
  const verified = await getVerifiedLoginChallenge(challengeId);
  return Boolean(verified && verified.candidates.length > 0);
}

/**
 * After OTP verify: if no PCO people and contact already registered, sign them in immediately.
 * Returns the user when auto-completed, or null when the UI should collect a name / person pick.
 */
export async function tryAutoCompleteUnlinkedLogin(challengeId: string) {
  const verified = await getVerifiedLoginChallenge(challengeId);
  if (!verified || verified.candidates.length > 0) {
    return null;
  }

  const existingUserId = await findUserIdByContact(verified.contactType, verified.contact);
  if (!existingUserId) {
    return null;
  }

  return completeUnlinkedLogin({ challengeId });
}
