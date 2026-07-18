/**
 * Notification facade — call these from product code later.
 * Providers can be swapped without touching call sites.
 */

import { sendElasticEmail, type SendEmailInput } from "@/lib/elastic-email";
import {
  getElasticEmailCredentials,
  getTwilioCredentials
} from "@/lib/settings";
import { sendTwilioSms, type SendSmsInput } from "@/lib/twilio";

export type NotificationChannel = "email" | "sms";

export async function getNotificationProviderStatus() {
  const [email, sms] = await Promise.all([
    getElasticEmailCredentials(),
    getTwilioCredentials()
  ]);

  return {
    email: {
      provider: "elasticemail" as const,
      configured: email.configured,
      source: email.source,
      fromEmail: email.fromEmail,
      fromName: email.fromName
    },
    sms: {
      provider: "twilio" as const,
      configured: sms.configured || sms.verifyConfigured,
      messagingConfigured: sms.configured,
      verifyConfigured: sms.verifyConfigured,
      source: sms.source,
      fromNumber: sms.fromNumber,
      verifyServiceSid: sms.verifyServiceSid
    }
  };
}

export async function sendNotificationEmail(input: SendEmailInput) {
  return sendElasticEmail(input);
}

export async function sendNotificationSms(input: SendSmsInput) {
  return sendTwilioSms(input);
}

/** Convenience helper for future campaign blasts / reminders. */
export async function notifyUser(input: {
  email?: string | null;
  phone?: string | null;
  subject?: string;
  message: string;
  html?: string;
  channels?: NotificationChannel[];
}) {
  const channels = input.channels ?? ["email", "sms"];
  const results: Array<{ channel: NotificationChannel; ok: boolean; error?: string }> = [];

  if (channels.includes("email") && input.email) {
    try {
      await sendNotificationEmail({
        to: input.email,
        subject: input.subject || "Pray Like Crazy",
        textBody: input.message,
        htmlBody: input.html
      });
      results.push({ channel: "email", ok: true });
    } catch (error) {
      results.push({
        channel: "email",
        ok: false,
        error: error instanceof Error ? error.message : "Email failed"
      });
    }
  }

  if (channels.includes("sms") && input.phone) {
    try {
      await sendNotificationSms({
        to: input.phone,
        body: input.message
      });
      results.push({ channel: "sms", ok: true });
    } catch (error) {
      results.push({
        channel: "sms",
        ok: false,
        error: error instanceof Error ? error.message : "SMS failed"
      });
    }
  }

  return results;
}
