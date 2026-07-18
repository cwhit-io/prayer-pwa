import { getTwilioCredentials } from "@/lib/settings";

export type SendSmsInput = {
  to: string;
  body: string;
  from?: string;
};

function twilioAuthHeader(accountSid: string, authToken: string) {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

export async function sendTwilioSms(input: SendSmsInput) {
  const credentials = await getTwilioCredentials();
  if (!credentials.accountSid || !credentials.authToken || !credentials.fromNumber) {
    throw new Error("Twilio is not configured (Account SID, Auth Token, and From number required).");
  }

  const to = input.to.trim();
  const body = input.body.trim();
  if (!to || !body) {
    throw new Error("SMS recipient and body are required.");
  }

  const from = (input.from || credentials.fromNumber).trim();
  const url = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`;

  const params = new URLSearchParams({
    To: to,
    From: from,
    Body: body
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: twilioAuthHeader(credentials.accountSid, credentials.authToken),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  const payload = (await response.json().catch(() => null)) as
    | { sid?: string; status?: string; message?: string; code?: number; error_message?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      payload?.message ||
        payload?.error_message ||
        `Twilio SMS failed (${response.status}).`
    );
  }

  return {
    ok: true as const,
    sid: payload?.sid ?? null,
    status: payload?.status ?? null
  };
}

/** Lightweight check that Account SID + Auth Token are accepted. */
export async function testTwilioConnection() {
  const credentials = await getTwilioCredentials();
  if (!credentials.accountSid || !credentials.authToken) {
    throw new Error("Twilio Account SID and Auth Token are required.");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}.json`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: twilioAuthHeader(credentials.accountSid, credentials.authToken)
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(
      payload?.message || `Twilio connection failed (${response.status}).`
    );
  }

  return { ok: true as const };
}

type TwilioVerifyErrorBody = {
  message?: string;
  code?: number;
  status?: number;
  more_info?: string;
};

/**
 * Start a Twilio Verify SMS to `to` (E.164).
 * Twilio generates and sends the code — do not invent a local OTP for phone login.
 */
export async function startTwilioVerify(input: { to: string; channel?: "sms" }) {
  const credentials = await getTwilioCredentials();
  if (!credentials.accountSid || !credentials.authToken || !credentials.verifyServiceSid) {
    throw new Error(
      "Twilio Verify is not configured (Account SID, Auth Token, and Verify Service SID required)."
    );
  }

  const to = input.to.trim();
  if (!to) {
    throw new Error("Phone number is required for verification.");
  }

  const channel = input.channel ?? "sms";
  const url = `https://verify.twilio.com/v2/Services/${credentials.verifyServiceSid}/Verifications`;
  const params = new URLSearchParams({
    To: to,
    Channel: channel
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: twilioAuthHeader(credentials.accountSid, credentials.authToken),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  const payload = (await response.json().catch(() => null)) as
    | ({ sid?: string; status?: string; to?: string } & TwilioVerifyErrorBody)
    | null;

  if (!response.ok) {
    throw new Error(
      payload?.message || `Twilio Verify start failed (${response.status}).`
    );
  }

  return {
    ok: true as const,
    sid: payload?.sid ?? null,
    status: payload?.status ?? null
  };
}

/**
 * Check a code against an in-flight Twilio Verify for `to`.
 * Returns true only when Twilio reports status "approved".
 */
export async function checkTwilioVerify(input: { to: string; code: string }) {
  const credentials = await getTwilioCredentials();
  if (!credentials.accountSid || !credentials.authToken || !credentials.verifyServiceSid) {
    throw new Error(
      "Twilio Verify is not configured (Account SID, Auth Token, and Verify Service SID required)."
    );
  }

  const to = input.to.trim();
  const code = input.code.trim();
  if (!to || !code) {
    throw new Error("Phone number and code are required.");
  }

  const url = `https://verify.twilio.com/v2/Services/${credentials.verifyServiceSid}/VerificationCheck`;
  const params = new URLSearchParams({
    To: to,
    Code: code
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: twilioAuthHeader(credentials.accountSid, credentials.authToken),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  const payload = (await response.json().catch(() => null)) as
    | ({ sid?: string; status?: string; valid?: boolean } & TwilioVerifyErrorBody)
    | null;

  // 404 / max attempts / expired often come back as non-2xx with a message.
  if (!response.ok) {
    const msg = payload?.message || "";
    // Treat wrong/expired codes as invalid rather than hard system failures when Twilio says so.
    if (
      response.status === 404 ||
      /not found|expired|max check|invalid/i.test(msg)
    ) {
      return { ok: false as const, status: payload?.status ?? null };
    }
    throw new Error(msg || `Twilio Verify check failed (${response.status}).`);
  }

  const approved = payload?.status === "approved" || payload?.valid === true;
  return {
    ok: approved,
    status: payload?.status ?? null
  };
}
