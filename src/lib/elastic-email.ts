import { getElasticEmailCredentials } from "@/lib/settings";

const ELASTICEMAIL_API = "https://api.elasticemail.com/v4";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  htmlBody?: string;
  textBody?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
};

/** Strip whitespace/newlines that break API keys when pasted. */
export function normalizeElasticApiKey(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function formatFromAddress(email: string, name?: string | null) {
  const fromEmail = email.trim();
  const fromName = name?.trim();
  if (!fromName) {
    return fromEmail;
  }
  // Quote display names so multi-word names parse correctly.
  const safeName = fromName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${safeName}" <${fromEmail}>`;
}

function parseElasticError(text: string) {
  try {
    const json = JSON.parse(text) as { Error?: string; message?: string };
    return json.Error || json.message || text;
  } catch {
    return text;
  }
}

export const ELASTIC_ACCESS_DENIED_HELP =
  "Elastic Email returned Access Denied. Fix the API key in Elastic Email → Settings → Manage API Keys: " +
  "(1) Permissions = Plugin or Full Access (must include “Send email via HTTP” / SendHttp), " +
  "(2) clear any IP access restrictions (or add this server’s IP), " +
  "(3) confirm the From address is a verified sender/domain, " +
  "(4) check the dashboard for account holds. Then paste the key again and save.";

function isAccessDenied(status: number, message: string) {
  const lower = message.toLowerCase();
  return (
    status === 401 ||
    status === 403 ||
    lower.includes("access denied") ||
    lower.includes("accessdenied")
  );
}

function buildBodyParts(input: { htmlBody?: string; textBody?: string }) {
  return [
    input.htmlBody
      ? { ContentType: "HTML", Content: input.htmlBody, Charset: "utf-8" }
      : null,
    input.textBody
      ? { ContentType: "PlainText", Content: input.textBody, Charset: "utf-8" }
      : input.htmlBody
        ? {
            ContentType: "PlainText",
            Content: input.htmlBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
            Charset: "utf-8"
          }
        : null
  ].filter(Boolean);
}

export async function sendElasticEmail(input: SendEmailInput) {
  const credentials = await getElasticEmailCredentials();
  const apiKey = credentials.apiKey ? normalizeElasticApiKey(credentials.apiKey) : null;
  if (!apiKey || !credentials.fromEmail) {
    throw new Error("Elastic Email is not configured (API key + from email required).");
  }

  const recipients = (Array.isArray(input.to) ? input.to : [input.to])
    .map((email) => email.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    throw new Error("At least one recipient email is required.");
  }

  if (!input.htmlBody && !input.textBody) {
    throw new Error("Email body (html or text) is required.");
  }

  const fromEmail = (input.fromEmail || credentials.fromEmail).trim();
  const fromName = input.fromName ?? credentials.fromName ?? "Pray Like Crazy";

  // Transactional endpoint (not bulk /emails). Official payload shape:
  // Recipients: { To: string[] }, Content: { From, Subject, Body, ... }
  const response = await fetch(`${ELASTICEMAIL_API}/emails/transactional`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-ElasticEmail-ApiKey": apiKey
    },
    body: JSON.stringify({
      Recipients: {
        To: recipients
      },
      Content: {
        From: formatFromAddress(fromEmail, fromName),
        ReplyTo: input.replyTo || fromEmail,
        Subject: input.subject,
        Body: buildBodyParts(input)
      }
    })
  });

  const text = await response.text().catch(() => "");
  type ElasticSendResponse = {
    MessageID?: string;
    TransactionID?: string;
    Error?: string;
    message?: string;
  };
  let payload: ElasticSendResponse | null = null;
  try {
    payload = text ? (JSON.parse(text) as ElasticSendResponse) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const raw = payload?.Error || payload?.message || text || `HTTP ${response.status}`;
    if (isAccessDenied(response.status, raw)) {
      throw new Error(ELASTIC_ACCESS_DENIED_HELP);
    }
    throw new Error(
      raw.length > 300 ? `Elastic Email request failed (${response.status}): ${raw.slice(0, 300)}` : raw
    );
  }

  return {
    ok: true as const,
    messageId: payload?.MessageID ?? payload?.TransactionID ?? null
  };
}

/**
 * Confirm the key can use SendHttp without delivering mail.
 * Invalid recipient should fail validation only if the key is allowed to send.
 */
export async function testElasticEmailSendAccess(apiKey: string, fromEmail: string) {
  const key = normalizeElasticApiKey(apiKey);
  if (!key) {
    throw new Error("Elastic Email API key is missing.");
  }
  const from = fromEmail.trim();
  if (!from) {
    throw new Error("From email is required.");
  }

  const response = await fetch(`${ELASTICEMAIL_API}/emails/transactional`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-ElasticEmail-ApiKey": key
    },
    body: JSON.stringify({
      Recipients: {
        // Intentionally invalid — we only care whether Elastic rejects for Access Denied.
        To: ["not-a-valid-email-address"]
      },
      Content: {
        From: from,
        Subject: "PLC permission probe",
        Body: [{ ContentType: "PlainText", Content: "probe", Charset: "utf-8" }]
      }
    })
  });

  const text = await response.text().catch(() => "");
  const message = text ? parseElasticError(text) : `HTTP ${response.status}`;

  if (isAccessDenied(response.status, message)) {
    throw new Error(ELASTIC_ACCESS_DENIED_HELP);
  }

  // Invalid key wording from Elastic
  const lower = message.toLowerCase();
  if (lower.includes("apikey expired") || lower.includes("api key expired") || lower.includes("invalid api")) {
    throw new Error(
      "Elastic Email rejected this API key (invalid or expired). Create a new key with Plugin / Full Access permissions and try again."
    );
  }

  // Any other response (validation error, 400 about recipient, even unexpected 200) means auth worked.
  return { ok: true as const };
}

/**
 * Lightweight check that the API key is accepted (ViewSettings via domains).
 * Prefer testElasticEmailSendAccess when configuring send.
 */
export async function testElasticEmailConnection(apiKey?: string) {
  const key =
    (apiKey ? normalizeElasticApiKey(apiKey) : null) ||
    normalizeElasticApiKey((await getElasticEmailCredentials()).apiKey ?? "") ||
    null;

  if (!key) {
    throw new Error("Elastic Email API key is missing.");
  }

  const response = await fetch(`${ELASTICEMAIL_API}/domains`, {
    method: "GET",
    headers: {
      "X-ElasticEmail-ApiKey": key
    }
  });

  if (response.ok) {
    return { ok: true as const };
  }

  const text = await response.text().catch(() => "");
  const message = text ? parseElasticError(text) : "";

  if (isAccessDenied(response.status, message)) {
    // Missing ViewSettings is fine; send access is checked separately.
    return { ok: true as const, limited: true as const };
  }

  const lower = message.toLowerCase();
  if (lower.includes("apikey expired") || lower.includes("api key expired")) {
    throw new Error(
      "Elastic Email rejected this API key (invalid or expired). Create a new key and paste it again."
    );
  }

  throw new Error(
    message
      ? `Elastic Email connection failed: ${message.slice(0, 200)}`
      : `Elastic Email connection failed (${response.status}).`
  );
}
