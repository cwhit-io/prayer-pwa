import Link from "next/link";
import { FormBanner } from "@/app/components/form-banner";
import { getCurrentUser, hasCapability } from "@/lib/auth";
import {
  getNotificationAdminSummary,
  listManagedNotifications
} from "@/lib/notification-admin";
import {
  NOTIFICATION_FREQUENCIES,
  WEEKDAY_OPTIONS
} from "@/lib/notification-catalog";
import {
  quickToggleNotificationAction
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

  if (!hasCapability(user.role, "notifications:manage")) {
    return (
      <main className="plc-page">
        <section className="plc-panel mx-auto max-w-3xl p-6">
          <h1 className="text-3xl font-black uppercase text-white">Superadmin access needed</h1>
        </section>
      </main>
    );
  }

  const [types, summary] = await Promise.all([
    listManagedNotifications(),
    getNotificationAdminSummary()
  ]);

  return (
    <main className="plc-page">
      <div className="plc-shell-wide space-y-8">
        <header className="space-y-3">
          <p className="plc-eyebrow">Staff admin · Notifications</p>
          <h1 className="plc-title">Manage email and text messages.</h1>
          <p className="plc-copy max-w-3xl">
            Turn message types on or off, choose when they send, edit the wording, and check whether email and text
            delivery are connected. Sign-in codes are managed separately and always remain available.
          </p>
          {params?.toggled === "1" ? (
            <p className="text-sm font-black uppercase text-yellow">Notification setting updated.</p>
          ) : null}
          <FormBanner error={params?.error} />
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <article className="plc-panel p-5">
               <p className="text-xs font-black uppercase text-white/65">Message types enabled</p>
            <p className="mt-2 text-3xl font-black text-yellow">
              {summary.enabled}/{summary.total}
            </p>
          </article>
          <article className="plc-panel p-5">
               <p className="text-xs font-black uppercase text-white/65">Recent messages sent</p>
            <p className="mt-2 text-3xl font-black text-white">{summary.recentLogs.length}</p>
          </article>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
               <h2 className="text-2xl font-black uppercase text-white">Message types</h2>
               <p className="plc-copy mt-1">For each message, choose whether it is active, who receives it, and how it is written.</p>
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

      </div>
    </main>
  );
}
