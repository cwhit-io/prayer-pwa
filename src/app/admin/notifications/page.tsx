import Link from "next/link";
import { FormBanner } from "@/app/components/form-banner";
import { getCurrentUser } from "@/lib/auth";
import {
  getNotificationAdminSummary,
  listManagedNotifications
} from "@/lib/notification-admin";
import {
  NOTIFICATION_FREQUENCIES,
  WEEKDAY_OPTIONS
} from "@/lib/notification-catalog";
import { getNotificationProviderStatus } from "@/lib/notifications";
import { getElasticEmailCredentials, getTwilioCredentials } from "@/lib/settings";
import {
  quickToggleNotificationAction,
  saveElasticEmailCredentialsAction,
  saveTwilioCredentialsAction,
  sendTestEmailAction,
  sendTestSmsAction
} from "./actions";

export const dynamic = "force-dynamic";

function frequencyLabel(value: string) {
  return NOTIFICATION_FREQUENCIES.find((item) => item.value === value)?.label ?? value;
}

function dayLabel(value: number | null) {
  if (value == null) {
    return null;
  }
  return WEEKDAY_OPTIONS.find((item) => item.value === value)?.label ?? null;
}

export default async function AdminNotificationsPage({
  searchParams
}: {
  searchParams?: Promise<{
    email_saved?: string;
    sms_saved?: string;
    email_test?: string;
    sms_test?: string;
    email_error?: string;
    sms_error?: string;
    toggled?: string;
    error?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;

  if (!user) {
    return (
      <main className="plc-page">
        <section className="plc-panel mx-auto max-w-3xl p-6">
          <h1 className="text-3xl font-black uppercase text-white">Sign in required</h1>
          <Link href="/auth" className="plc-button mt-5">
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  if (user.role !== "admin") {
    return (
      <main className="plc-page">
        <section className="plc-panel mx-auto max-w-3xl p-6">
          <h1 className="text-3xl font-black uppercase text-white">Admin access needed</h1>
        </section>
      </main>
    );
  }

  const [status, emailCreds, smsCreds, types, summary] = await Promise.all([
    getNotificationProviderStatus(),
    getElasticEmailCredentials(),
    getTwilioCredentials(),
    listManagedNotifications(),
    getNotificationAdminSummary()
  ]);

  return (
    <main className="plc-page">
      <div className="plc-shell-wide space-y-8">
        <header className="space-y-3">
          <p className="plc-eyebrow">Admin · Notifications</p>
          <h1 className="plc-title">Manage how the church is nudged.</h1>
          <p className="plc-copy max-w-3xl">
            Turn notification types on or off, set how often they send, edit email HTML and SMS copy, and keep provider
            credentials healthy. Login codes always stay available for sign-in.
          </p>
          {params?.email_saved === "1" ? (
            <p className="text-sm font-black uppercase text-yellow">Elastic Email saved and verified.</p>
          ) : null}
          {params?.sms_saved === "1" ? (
            <p className="text-sm font-black uppercase text-yellow">Twilio saved and verified.</p>
          ) : null}
          {params?.email_test === "1" ? (
            <p className="text-sm font-black uppercase text-yellow">Provider test email sent.</p>
          ) : null}
          {params?.sms_test === "1" ? (
            <p className="text-sm font-black uppercase text-yellow">Provider test SMS sent.</p>
          ) : null}
          {params?.toggled === "1" ? (
            <p className="text-sm font-black uppercase text-yellow">Notification setting updated.</p>
          ) : null}
          {params?.email_error ? (
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
              <p className="font-black uppercase tracking-wide text-red-200">Email error</p>
              <p className="mt-2 whitespace-pre-wrap">{params.email_error}</p>
            </div>
          ) : null}
          {params?.sms_error ? (
            <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
              <p className="font-black uppercase tracking-wide text-red-200">SMS error</p>
              <p className="mt-2 whitespace-pre-wrap">{params.sms_error}</p>
            </div>
          ) : null}
          <FormBanner error={params?.error} />
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="plc-panel p-5">
            <p className="text-xs font-black uppercase text-white/45">Types enabled</p>
            <p className="mt-2 text-3xl font-black text-yellow">
              {summary.enabled}/{summary.total}
            </p>
          </article>
          <article className="plc-panel p-5">
            <p className="text-xs font-black uppercase text-white/45">Email ready</p>
            <p className="mt-2 text-3xl font-black text-white">
              {status.email.configured ? "Yes" : "No"}
            </p>
          </article>
          <article className="plc-panel p-5">
            <p className="text-xs font-black uppercase text-white/45">SMS ready</p>
            <p className="mt-2 text-3xl font-black text-white">
              {status.sms.configured || smsCreds.verifyConfigured ? "Yes" : "No"}
            </p>
          </article>
          <article className="plc-panel p-5">
            <p className="text-xs font-black uppercase text-white/45">Recent sends</p>
            <p className="mt-2 text-3xl font-black text-white">{summary.recentLogs.length}</p>
          </article>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black uppercase text-white">Notification types</h2>
              <p className="plc-copy mt-1">Frequency, channels, audience, and templates.</p>
            </div>
          </div>

          <div className="space-y-3">
            {types.map((item) => {
              const day = dayLabel(item.sendDayOfWeek);
              return (
                <article key={item.key} className="plc-panel p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-black uppercase text-white">{item.label}</h3>
                        {item.isSystem ? (
                          <span className="rounded-full border border-yellow/40 px-2 py-0.5 text-[10px] font-black uppercase text-yellow">
                            System
                          </span>
                        ) : null}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                            item.enabled
                              ? "bg-yellow/20 text-yellow"
                              : "border border-white/20 text-white/45"
                          }`}
                        >
                          {item.enabled ? "On" : "Off"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-white/60">{item.description}</p>
                      <p className="mt-3 text-xs uppercase tracking-wide text-white/40">
                        {frequencyLabel(item.frequency)}
                        {day ? ` · ${day}` : ""}
                        {` · ${item.sendHourLocal}:00 local`}
                        {" · "}
                        {item.emailEnabled ? "Email" : "No email"}
                        {" · "}
                        {item.smsEnabled ? "SMS" : "No SMS"}
                        {" · "}
                        {item.audience.replace("_", " ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!item.isSystem ? (
                        <form action={quickToggleNotificationAction}>
                          <input type="hidden" name="key" value={item.key} />
                          <input type="hidden" name="enable" value={item.enabled ? "0" : "1"} />
                          <button className="plc-button-secondary">
                            {item.enabled ? "Disable" : "Enable"}
                          </button>
                        </form>
                      ) : null}
                      <Link href={`/admin/notifications/${item.key}`} className="plc-button">
                        Manage
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="plc-panel p-6">
          <h2 className="text-2xl font-black uppercase text-white">Recent send log</h2>
          {summary.recentLogs.length === 0 ? (
            <p className="plc-copy mt-3">No sends logged yet. Use Manage → Send test on a type.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {summary.recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="plc-card-muted flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <span className="font-black uppercase text-white">{log.notificationKey}</span>
                    <span className="text-white/40"> · {log.channel}</span>
                    <span className="text-white/50"> · {log.recipient}</span>
                  </div>
                  <div className="text-xs uppercase tracking-wide text-white/45">
                    <span className={log.status === "sent" ? "text-yellow" : "text-red-300"}>
                      {log.status}
                    </span>
                    {" · "}
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section id="providers" className="grid gap-6 lg:grid-cols-2">
          <article className="plc-panel p-6">
            <h2 className="text-2xl font-black uppercase text-white">Elastic Email</h2>
            <p className="plc-copy mt-2">
              Status:{" "}
              <span className="text-yellow">{status.email.configured ? "Ready" : "Not set"}</span>
              {status.email.fromEmail ? ` · ${status.email.fromEmail}` : ""}
            </p>
            <form action={saveElasticEmailCredentialsAction} className="mt-5 space-y-4">
              <label className="plc-label block space-y-2">
                <span>API key</span>
                <input
                  required
                  name="api_key"
                  type="password"
                  defaultValue={emailCreds.apiKey ?? ""}
                  className="plc-input w-full px-4 py-3 font-mono text-sm"
                  autoComplete="off"
                />
              </label>
              <label className="plc-label block space-y-2">
                <span>From email</span>
                <input
                  required
                  name="from_email"
                  type="email"
                  defaultValue={emailCreds.fromEmail ?? ""}
                  className="plc-input w-full px-4 py-3"
                />
              </label>
              <label className="plc-label block space-y-2">
                <span>From name</span>
                <input
                  name="from_name"
                  defaultValue={emailCreds.fromName ?? "Pray Like Crazy"}
                  className="plc-input w-full px-4 py-3"
                />
              </label>
              <button className="plc-button">Save & verify email</button>
            </form>

            {status.email.configured ? (
              <form action={sendTestEmailAction} className="mt-6 space-y-3 border-t border-white/10 pt-5">
                <p className="text-sm font-black uppercase text-white/50">Provider test email</p>
                <label className="plc-label block space-y-2">
                  <span>To</span>
                  <input
                    required
                    name="test_email"
                    type="email"
                    placeholder="you@example.com"
                    className="plc-input w-full px-4 py-3"
                  />
                </label>
                <button className="plc-button-secondary">Send provider test</button>
              </form>
            ) : null}
          </article>

          <article className="plc-panel p-6">
            <h2 className="text-2xl font-black uppercase text-white">Twilio</h2>
            <p className="plc-copy mt-2">
              Messaging:{" "}
              <span className="text-yellow">
                {status.sms.messagingConfigured ? "Ready" : "Not set"}
              </span>
              {status.sms.fromNumber ? ` · ${status.sms.fromNumber}` : ""}
              {" · "}
              Login Verify:{" "}
              <span className="text-yellow">
                {status.sms.verifyConfigured ? "Ready" : "Not set"}
              </span>
            </p>
            <p className="mt-2 text-sm text-white/50">
              Login phone codes use <strong className="text-white/70">Twilio Verify</strong>. Campaign /
              notification SMS still use the Messages API (From number).
            </p>
            <form action={saveTwilioCredentialsAction} className="mt-5 space-y-4">
              <label className="plc-label block space-y-2">
                <span>Account SID</span>
                <input
                  required
                  name="account_sid"
                  defaultValue={smsCreds.accountSid ?? ""}
                  className="plc-input w-full px-4 py-3 font-mono text-sm"
                  autoComplete="off"
                />
              </label>
              <label className="plc-label block space-y-2">
                <span>Auth token</span>
                <input
                  required
                  name="auth_token"
                  type="password"
                  defaultValue={smsCreds.authToken ?? ""}
                  className="plc-input w-full px-4 py-3 font-mono text-sm"
                  autoComplete="off"
                />
              </label>
              <label className="plc-label block space-y-2">
                <span>Verify Service SID (login OTP)</span>
                <input
                  name="verify_service_sid"
                  defaultValue={smsCreds.verifyServiceSid ?? ""}
                  placeholder="VAxxxxxxxx…"
                  className="plc-input w-full px-4 py-3 font-mono text-sm"
                  autoComplete="off"
                />
              </label>
              <label className="plc-label block space-y-2">
                <span>From number (notification SMS)</span>
                <input
                  name="from_number"
                  defaultValue={smsCreds.fromNumber ?? ""}
                  placeholder="+12605551212"
                  className="plc-input w-full px-4 py-3 font-mono text-sm"
                />
              </label>
              <button className="plc-button">Save & verify Twilio</button>
            </form>

            {status.sms.messagingConfigured ? (
              <form action={sendTestSmsAction} className="mt-6 space-y-3 border-t border-white/10 pt-5">
                <p className="text-sm font-black uppercase text-white/50">Provider test SMS</p>
                <label className="plc-label block space-y-2">
                  <span>To (E.164)</span>
                  <input
                    required
                    name="test_phone"
                    placeholder="+12605551212"
                    className="plc-input w-full px-4 py-3 font-mono text-sm"
                  />
                </label>
                <button className="plc-button-secondary">Send provider test</button>
              </form>
            ) : null}
          </article>
        </section>
      </div>
    </main>
  );
}
