"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  normalizeElasticApiKey,
  sendElasticEmail,
  testElasticEmailSendAccess
} from "@/lib/elastic-email";
import { redirectWithError, redirectWithQuery, rethrowIfNextNavigation } from "@/lib/form-action";
import {
  dispatchManagedNotification,
  getManagedNotification,
  resetNotificationTemplate,
  updateNotificationSettings,
  updateNotificationTemplate
} from "@/lib/notification-admin";
import type { NotificationAudience, NotificationFrequency } from "@/lib/notification-catalog";
import { setSetting } from "@/lib/settings";
import { sendTwilioSms, testTwilioConnection } from "@/lib/twilio";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }
  if (user.role !== "admin") {
    redirectWithError("/admin", "Admin access is required.");
  }
  return user;
}

export async function saveElasticEmailCredentialsAction(formData: FormData) {
  try {
    await requireAdmin();

    const apiKey = normalizeElasticApiKey(readText(formData, "api_key"));
    const fromEmail = readText(formData, "from_email");
    const fromName = readText(formData, "from_name") || "Pray Like Crazy";

    if (!apiKey || !fromEmail) {
      redirectWithError("/admin/notifications", "Elastic Email API key and from email are required.");
    }

    await testElasticEmailSendAccess(apiKey, fromEmail);

    await Promise.all([
      setSetting("elasticemail_api_key", apiKey),
      setSetting("elasticemail_from_email", fromEmail),
      setSetting("elasticemail_from_name", fromName)
    ]);

    revalidatePath("/admin");
    revalidatePath("/admin/notifications");
    redirectWithQuery("/admin/notifications", { email_saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/notifications", error, "Could not save Elastic Email settings.");
  }
}

export async function saveTwilioCredentialsAction(formData: FormData) {
  try {
    await requireAdmin();

    const accountSid = readText(formData, "account_sid");
    const authToken = readText(formData, "auth_token");
    const fromNumber = readText(formData, "from_number");
    const verifyServiceSid = readText(formData, "verify_service_sid");

    if (!accountSid || !authToken) {
      redirectWithError(
        "/admin/notifications",
        "Twilio Account SID and Auth Token are required."
      );
    }

    if (!fromNumber && !verifyServiceSid) {
      redirectWithError(
        "/admin/notifications",
        "Provide a From number (notification SMS) and/or a Verify Service SID (login OTP)."
      );
    }

    await Promise.all([
      setSetting("twilio_account_sid", accountSid),
      setSetting("twilio_auth_token", authToken),
      setSetting("twilio_from_number", fromNumber || ""),
      setSetting("twilio_verify_service_sid", verifyServiceSid || "")
    ]);
    await testTwilioConnection();

    revalidatePath("/admin");
    revalidatePath("/admin/notifications");
    redirectWithQuery("/admin/notifications", { sms_saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/notifications", error, "Could not save Twilio settings.");
  }
}

export async function sendTestEmailAction(formData: FormData) {
  try {
    await requireAdmin();
    const to = readText(formData, "test_email");
    if (!to) {
      redirectWithError("/admin/notifications", "Test recipient email is required.");
    }

    await sendElasticEmail({
      to,
      subject: "Pray Like Crazy — test email",
      textBody:
        "This is a test message from the Pray Like Crazy admin notifications setup. Elastic Email is connected.",
      htmlBody:
        "<p>This is a <strong>test message</strong> from the Pray Like Crazy admin notifications setup.</p><p>Elastic Email is connected.</p>"
    });

    revalidatePath("/admin/notifications");
    redirectWithQuery("/admin/notifications", { email_test: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/notifications", error, "Test email failed.");
  }
}

export async function sendTestSmsAction(formData: FormData) {
  try {
    await requireAdmin();
    const to = readText(formData, "test_phone");
    if (!to) {
      redirectWithError(
        "/admin/notifications",
        "Test phone number is required (E.164 format, e.g. +12605551212)."
      );
    }

    await sendTwilioSms({
      to,
      body: "Pray Like Crazy test SMS — Twilio is connected."
    });

    revalidatePath("/admin/notifications");
    redirectWithQuery("/admin/notifications", { sms_test: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/notifications", error, "Test SMS failed.");
  }
}

export async function saveNotificationSettingsAction(formData: FormData) {
  const key = readText(formData, "key");
  const path = key ? `/admin/notifications/${key}` : "/admin/notifications";

  try {
    await requireAdmin();
    if (!key) {
      redirectWithError("/admin/notifications", "Notification key is required.");
    }

    const frequency = readText(formData, "frequency") as NotificationFrequency;
    const audience = readText(formData, "audience") as NotificationAudience;
    const dayRaw = readText(formData, "send_day_of_week");
    const hourRaw = readText(formData, "send_hour_local");
    const sendDayOfWeek = dayRaw === "" ? null : Number(dayRaw);
    const sendHourLocal = Number(hourRaw);

    await updateNotificationSettings({
      key,
      enabled: formData.get("enabled") === "on",
      emailEnabled: formData.get("email_enabled") === "on",
      smsEnabled: formData.get("sms_enabled") === "on",
      frequency: frequency || "weekly",
      sendDayOfWeek:
        sendDayOfWeek != null && Number.isFinite(sendDayOfWeek) ? sendDayOfWeek : null,
      sendHourLocal:
        Number.isFinite(sendHourLocal) && sendHourLocal >= 0 && sendHourLocal <= 23
          ? sendHourLocal
          : 9,
      audience: audience || "members"
    });

    revalidatePath("/admin/notifications");
    revalidatePath(path);
    redirectWithQuery(path, { settings_saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError(path, error, "Could not save settings.");
  }
}

export async function saveNotificationTemplateAction(formData: FormData) {
  const key = readText(formData, "key");
  const path = key ? `/admin/notifications/${key}` : "/admin/notifications";

  try {
    await requireAdmin();
    if (!key) {
      redirectWithError("/admin/notifications", "Notification key is required.");
    }

    let emailHtml = typeof formData.get("email_html") === "string" ? String(formData.get("email_html")) : "";
    const upload = formData.get("html_file");
    if (upload instanceof File && upload.size > 0) {
      const name = upload.name.toLowerCase();
      if (
        !name.endsWith(".html") &&
        !name.endsWith(".htm") &&
        upload.type &&
        !upload.type.includes("html") &&
        upload.type !== "text/plain"
      ) {
        redirectWithError(path, "Upload a .html file for the email body.");
      }
      if (upload.size > 500_000) {
        redirectWithError(path, "HTML file is too large (max 500KB).");
      }
      emailHtml = (await upload.text()).trim();
    }

    await updateNotificationTemplate({
      key,
      emailSubject: readText(formData, "email_subject"),
      emailText: typeof formData.get("email_text") === "string" ? String(formData.get("email_text")) : "",
      emailHtml,
      smsBody: typeof formData.get("sms_body") === "string" ? String(formData.get("sms_body")) : ""
    });

    revalidatePath("/admin/notifications");
    revalidatePath(path);
    redirectWithQuery(path, { template_saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError(path, error, "Could not save template.");
  }
}

export async function resetNotificationTemplateAction(formData: FormData) {
  const key = readText(formData, "key");
  const path = key ? `/admin/notifications/${key}` : "/admin/notifications";

  try {
    await requireAdmin();
    if (!key) {
      redirectWithError("/admin/notifications", "Notification key is required.");
    }

    await resetNotificationTemplate(key);
    revalidatePath("/admin/notifications");
    revalidatePath(path);
    redirectWithQuery(path, { template_reset: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError(path, error, "Could not reset template.");
  }
}

export async function sendManagedTestAction(formData: FormData) {
  const key = readText(formData, "key");
  const path = key ? `/admin/notifications/${key}` : "/admin/notifications";

  try {
    await requireAdmin();
    const email = readText(formData, "test_email") || null;
    const phone = readText(formData, "test_phone") || null;

    if (!key) {
      redirectWithError("/admin/notifications", "Notification key is required.");
    }
    if (!email && !phone) {
      redirectWithError(path, "Enter a test email and/or phone number.");
    }

    const result = await dispatchManagedNotification({
      key,
      email,
      phone,
      force: true,
      vars: {
        name: "Test Person",
        code: "123456",
        minutes: 10,
        contact: email || phone || "",
        pledged_minutes: 150,
        prayed_minutes: 45,
        church_minutes: "12,400",
        goal_minutes: "1,000,000",
        request_title: "Sample prayer request",
        prayer_count: 3,
        category: "Family",
        headline: "Test campaign announcement",
        body: "This is a test body from the admin notifications manager.",
        open_count: 4
      }
    });

    if (result.skipped) {
      redirectWithError(
        path,
        `Test skipped (${result.reason}). Enable email/SMS channels for this type.`
      );
    }

    if (result.results.length > 0 && result.results.every((item) => !item.ok)) {
      redirectWithError(
        path,
        result.results.map((item) => item.error).filter(Boolean).join(" · ") || "Test send failed."
      );
    }

    revalidatePath("/admin/notifications");
    revalidatePath(path);
    redirectWithQuery(path, { test_sent: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError(path, error, "Test send failed.");
  }
}

export async function quickToggleNotificationAction(formData: FormData) {
  try {
    await requireAdmin();
    const key = readText(formData, "key");
    const enable = formData.get("enable") === "1";
    if (!key) {
      redirectWithError("/admin/notifications", "Notification key is required.");
    }

    const current = await getManagedNotification(key);
    if (!current) {
      redirectWithError("/admin/notifications", "Unknown notification.");
      return;
    }

    await updateNotificationSettings({
      key,
      enabled: enable,
      emailEnabled: current.emailEnabled,
      smsEnabled: current.smsEnabled,
      frequency: current.frequency,
      sendDayOfWeek: current.sendDayOfWeek,
      sendHourLocal: current.sendHourLocal,
      audience: current.audience
    });

    revalidatePath("/admin/notifications");
    redirectWithQuery("/admin/notifications", { toggled: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/notifications", error, "Could not update notification.");
  }
}
