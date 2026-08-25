import { query } from "@/lib/postgres";
import { syncCurrentCampaign } from "@/lib/campaign-model";

export async function getSetting(key: string) {
  const result = await query<{ value: string }>(
    `select value from app_settings where key = $1 limit 1`,
    [key]
  );
  return result.rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await query(
    `insert into app_settings (key, value, updated_at)
     values ($1, $2, now())
     on conflict (key) do update
     set value = excluded.value,
         updated_at = now()`,
    [key, value]
  );
}

export async function getOpenAICredentials() {
  const apiKeySetting = await getSetting("openai_api_key");
  const apiKey = apiKeySetting || process.env.OPENAI_API_KEY || null;

  return {
    apiKey,
    configured: Boolean(apiKey),
    source: apiKeySetting ? ("database" as const) : apiKey ? ("environment" as const) : ("none" as const)
  };
}

export async function getPlanningCenterCredentials() {
  const [appIdSetting, secretSetting] = await Promise.all([
    getSetting("planning_center_app_id"),
    getSetting("planning_center_secret")
  ]);

  const appId = appIdSetting || process.env.PLANNING_CENTER_APP_ID || null;
  const secret = secretSetting || process.env.PLANNING_CENTER_SECRET || null;

  return {
    appId,
    secret,
    configured: Boolean(appId && secret),
    source: appIdSetting && secretSetting ? "database" : appId && secret ? "environment" : "none"
  } as const;
}

export type ElasticEmailCredentials = {
  apiKey: string | null;
  fromEmail: string | null;
  fromName: string | null;
  configured: boolean;
  source: "database" | "environment" | "none";
};

export async function getElasticEmailCredentials(): Promise<ElasticEmailCredentials> {
  const [apiKeySetting, fromEmailSetting, fromNameSetting] = await Promise.all([
    getSetting("elasticemail_api_key"),
    getSetting("elasticemail_from_email"),
    getSetting("elasticemail_from_name")
  ]);

  const apiKey = apiKeySetting || process.env.ELASTICEMAIL_API_KEY || null;
  const fromEmail = fromEmailSetting || process.env.ELASTICEMAIL_FROM_EMAIL || null;
  const fromName = fromNameSetting || process.env.ELASTICEMAIL_FROM_NAME || "Pray Like Crazy";
  const fromDb = Boolean(apiKeySetting && fromEmailSetting);

  return {
    apiKey,
    fromEmail,
    fromName,
    configured: Boolean(apiKey && fromEmail),
    source: fromDb ? "database" : apiKey && fromEmail ? "environment" : "none"
  };
}

export type TwilioCredentials = {
  accountSid: string | null;
  authToken: string | null;
  fromNumber: string | null;
  /** Twilio Verify Service SID (VA…) used for login OTP SMS. */
  verifyServiceSid: string | null;
  /** Messages API ready (Account + Token + From number). */
  configured: boolean;
  /** Verify API ready (Account + Token + Verify Service SID). */
  verifyConfigured: boolean;
  source: "database" | "environment" | "none";
};

export async function getTwilioCredentials(): Promise<TwilioCredentials> {
  const [sidSetting, tokenSetting, fromSetting, verifySetting] = await Promise.all([
    getSetting("twilio_account_sid"),
    getSetting("twilio_auth_token"),
    getSetting("twilio_from_number"),
    getSetting("twilio_verify_service_sid")
  ]);

  const accountSid = sidSetting || process.env.TWILIO_ACCOUNT_SID || null;
  const authToken = tokenSetting || process.env.TWILIO_AUTH_TOKEN || null;
  const fromNumber = fromSetting || process.env.TWILIO_FROM_NUMBER || null;
  const verifyServiceSid =
    verifySetting ||
    process.env.TWILIO_VERIFY_SERVICE_SID ||
    null;
  const fromDb = Boolean(sidSetting && tokenSetting && fromSetting);

  return {
    accountSid,
    authToken,
    fromNumber,
    verifyServiceSid,
    configured: Boolean(accountSid && authToken && fromNumber),
    verifyConfigured: Boolean(accountSid && authToken && verifyServiceSid),
    source: fromDb ? "database" : accountSid && authToken && fromNumber ? "environment" : "none"
  };
}

const DEFAULT_GOAL_MINUTES = 1_000_000;
/** Soft cap for a single prayer timer session before auto-pause. */
export const DEFAULT_MAX_SESSION_MINUTES = 60;
/** How many minutes each “keep going” extension adds. */
export const DEFAULT_SESSION_EXTENSION_MINUTES = 30;

function isoDateOrNull(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }
  const [year, month, day] = trimmed.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    return null;
  }
  return trimmed;
}

export type CampaignSettings = {
  startDate: string | null;
  endDate: string | null;
  goalMinutes: number;
  /** Soft auto-pause cap for the PRAY timer (minutes). */
  maxSessionMinutes: number;
  /** When true, show shared tags on A–T–S cards on the PRAY page. */
  showActsTags: boolean;
};

export async function getCampaignSettings(): Promise<CampaignSettings> {
  const [startDate, endDate, goalRaw, maxSessionRaw, showActsTagsRaw] = await Promise.all([
    getSetting("campaign_start_date"),
    getSetting("campaign_end_date"),
    getSetting("campaign_goal_minutes"),
    getSetting("campaign_max_session_minutes"),
    getSetting("campaign_show_acts_tags")
  ]);

  const goalParsed = Number(goalRaw);
  const maxSessionParsed = Number(maxSessionRaw);
  return {
    startDate: isoDateOrNull(startDate),
    endDate: isoDateOrNull(endDate),
    goalMinutes:
      Number.isFinite(goalParsed) && goalParsed > 0 ? Math.round(goalParsed) : DEFAULT_GOAL_MINUTES,
    maxSessionMinutes:
      Number.isFinite(maxSessionParsed) && maxSessionParsed > 0
        ? Math.min(24 * 60, Math.round(maxSessionParsed))
        : DEFAULT_MAX_SESSION_MINUTES,
    showActsTags: showActsTagsRaw === "1" || showActsTagsRaw === "true"
  };
}

export async function saveCampaignSettings(input: {
  startDate: string | null;
  endDate: string | null;
  goalMinutes: number;
  maxSessionMinutes?: number;
  showActsTags?: boolean;
}) {
  const startDate = isoDateOrNull(input.startDate);
  const endDate = isoDateOrNull(input.endDate);
  const goalMinutes =
    Number.isFinite(input.goalMinutes) && input.goalMinutes > 0
      ? Math.round(input.goalMinutes)
      : DEFAULT_GOAL_MINUTES;
  const maxSessionMinutes =
    input.maxSessionMinutes != null &&
    Number.isFinite(input.maxSessionMinutes) &&
    input.maxSessionMinutes > 0
      ? Math.min(24 * 60, Math.round(input.maxSessionMinutes))
      : DEFAULT_MAX_SESSION_MINUTES;
  const showActsTags = Boolean(input.showActsTags);

  if (startDate && endDate && startDate > endDate) {
    throw new Error("Campaign end date must be on or after the start date.");
  }

  await Promise.all([
    setSetting("campaign_start_date", startDate ?? ""),
    setSetting("campaign_end_date", endDate ?? ""),
    setSetting("campaign_goal_minutes", String(goalMinutes)),
    setSetting("campaign_max_session_minutes", String(maxSessionMinutes)),
    setSetting("campaign_show_acts_tags", showActsTags ? "1" : "0")
  ]);

  if (startDate && endDate) {
    await syncCurrentCampaign({ startDate, endDate, goalMinutes });
  }

  return {
    startDate,
    endDate,
    goalMinutes,
    maxSessionMinutes,
    showActsTags
  } satisfies CampaignSettings;
}

/** Calendar progress helpers for pacing vs the goal. */
export function getCampaignCalendarMetrics(settings: CampaignSettings, now = new Date()) {
  if (!settings.startDate || !settings.endDate || settings.endDate < settings.startDate) {
    return {
      hasDates: false as const,
      totalDays: 0,
      elapsedDays: 0,
      remainingDays: 0,
      calendarProgressPercent: 0,
      expectedMinutesByNow: 0
    };
  }

  const ordinal = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day) / 86_400_000;
  };
  const localParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Indiana/Indianapolis",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(localParts.find((entry) => entry.type === type)?.value ?? 0);
  const today = Date.UTC(part("year"), part("month") - 1, part("day")) / 86_400_000;
  const dayFraction = (part("hour") * 3600 + part("minute") * 60 + part("second")) / 86_400;
  const start = ordinal(settings.startDate);
  const end = ordinal(settings.endDate);
  const totalDays = end - start + 1;
  const elapsed = Math.min(totalDays, Math.max(0, today - start + dayFraction));
  const elapsedDays = Math.min(totalDays, Math.max(0, Math.floor(elapsed)));
  const remainingDays = Math.max(0, Math.ceil(totalDays - elapsed));
  const calendarProgressPercent = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
  const expectedMinutesByNow = Math.round((settings.goalMinutes * elapsed) / totalDays);

  return {
    hasDates: true as const,
    totalDays,
    elapsedDays,
    remainingDays,
    calendarProgressPercent,
    expectedMinutesByNow
  };
}
