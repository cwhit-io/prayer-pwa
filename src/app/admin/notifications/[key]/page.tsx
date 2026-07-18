import Link from "next/link";
import { notFound } from "next/navigation";
import { FormBanner } from "@/app/components/form-banner";
import { getCurrentUser } from "@/lib/auth";
import { getManagedNotification } from "@/lib/notification-admin";
import {
  NOTIFICATION_AUDIENCES,
  NOTIFICATION_FREQUENCIES,
  WEEKDAY_OPTIONS
} from "@/lib/notification-catalog";
import {
  resetNotificationTemplateAction,
  saveNotificationSettingsAction,
  saveNotificationTemplateAction,
  sendManagedTestAction
} from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminNotificationDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ key: string }>;
  searchParams?: Promise<{
    settings_saved?: string;
    template_saved?: string;
    template_reset?: string;
    test_sent?: string;
    error?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const { key } = await params;
  const query = await searchParams;

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

  const notification = await getManagedNotification(key);
  if (!notification) {
    notFound();
  }

  return (
    <main className="plc-page">
      <div className="plc-shell-wide space-y-8">
        <header className="space-y-3">
          <Link href="/admin/notifications" className="text-sm font-black uppercase text-yellow">
            ← All notifications
          </Link>
          <p className="plc-eyebrow">Admin · Notifications · {notification.key}</p>
          <h1 className="plc-title">{notification.label}</h1>
          <p className="plc-copy max-w-3xl">{notification.description}</p>
          {notification.key === "request_prayed_for" ? (
            <p className="text-sm text-white/55">
              Members must also opt in on their profile (`/auth`) before emails are sent.
            </p>
          ) : null}
          {notification.key === "new_board_request" ? (
            <p className="text-sm text-white/55">
              Goes to users with role admin or prayer_team who have a real email address on file.
            </p>
          ) : null}
          <FormBanner
            error={query?.error}
            success={
              query?.settings_saved === "1"
                ? "Settings saved."
                : query?.template_saved === "1"
                  ? "Template saved."
                  : query?.template_reset === "1"
                    ? "Template reset to defaults."
                    : query?.test_sent === "1"
                      ? "Test notification sent (see send log)."
                      : null
            }
          />
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="plc-panel p-6">
            <h2 className="text-2xl font-black uppercase text-white">Delivery settings</h2>
            <p className="plc-copy mt-2">
              Control whether this type runs, which channels it uses, how often, and who it targets.
              {notification.isSystem ? " System types stay on so login keeps working." : ""}
            </p>
            <form action={saveNotificationSettingsAction} className="mt-5 space-y-4">
              <input type="hidden" name="key" value={notification.key} />

              {!notification.isSystem ? (
                <label className="flex items-center gap-3 text-sm text-white/80">
                  <input
                    name="enabled"
                    type="checkbox"
                    defaultChecked={notification.enabled}
                    className="plc-checkbox"
                  />
                  Enabled
                </label>
              ) : (
                <p className="text-sm font-black uppercase text-yellow">Always enabled (system)</p>
              )}

              <div className="flex flex-wrap gap-4">
                {notification.supportsEmail ? (
                  <label className="flex items-center gap-3 text-sm text-white/80">
                    <input
                      name="email_enabled"
                      type="checkbox"
                      defaultChecked={notification.emailEnabled}
                      className="plc-checkbox"
                    />
                    Email channel
                  </label>
                ) : null}
                {notification.supportsSms ? (
                  <label className="flex items-center gap-3 text-sm text-white/80">
                    <input
                      name="sms_enabled"
                      type="checkbox"
                      defaultChecked={notification.smsEnabled}
                      className="plc-checkbox"
                    />
                    SMS channel
                  </label>
                ) : null}
              </div>

              <label className="plc-label block space-y-2">
                <span>Frequency</span>
                <select
                  name="frequency"
                  defaultValue={notification.frequency}
                  className="plc-input w-full px-4 py-3"
                >
                  {NOTIFICATION_FREQUENCIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} — {option.hint}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="plc-label block space-y-2">
                  <span>Send day (weekly / biweekly)</span>
                  <select
                    name="send_day_of_week"
                    defaultValue={notification.sendDayOfWeek ?? ""}
                    className="plc-input w-full px-4 py-3"
                  >
                    <option value="">Not set</option>
                    {WEEKDAY_OPTIONS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="plc-label block space-y-2">
                  <span>Send hour (local, 0–23)</span>
                  <input
                    name="send_hour_local"
                    type="number"
                    min={0}
                    max={23}
                    defaultValue={notification.sendHourLocal}
                    className="plc-input w-full px-4 py-3"
                  />
                </label>
              </div>

              <label className="plc-label block space-y-2">
                <span>Audience</span>
                <select
                  name="audience"
                  defaultValue={notification.audience}
                  className="plc-input w-full px-4 py-3"
                >
                  {NOTIFICATION_AUDIENCES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <button className="plc-button">Save settings</button>
            </form>
          </article>

          <article className="plc-panel p-6">
            <h2 className="text-2xl font-black uppercase text-white">Send test</h2>
            <p className="plc-copy mt-2">
              Uses the saved template and forced delivery (even if the type is disabled). Sample merge tags are filled
              automatically.
            </p>
            <form action={sendManagedTestAction} className="mt-5 space-y-4">
              <input type="hidden" name="key" value={notification.key} />
              <label className="plc-label block space-y-2">
                <span>Test email</span>
                <input
                  name="test_email"
                  type="email"
                  placeholder="you@example.com"
                  className="plc-input w-full px-4 py-3"
                />
              </label>
              <label className="plc-label block space-y-2">
                <span>Test phone (E.164)</span>
                <input
                  name="test_phone"
                  placeholder="+12605551212"
                  className="plc-input w-full px-4 py-3 font-mono text-sm"
                />
              </label>
              <button className="plc-button">Send test with this template</button>
            </form>

            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-sm font-black uppercase text-white/50">Merge tags</p>
              <p className="mt-2 flex flex-wrap gap-2">
                {notification.mergeTags.map((tag) => (
                  <code key={tag} className="rounded bg-black/40 px-2 py-1 text-xs text-yellow">
                    {tag}
                  </code>
                ))}
              </p>
            </div>
          </article>
        </section>

        <section className="plc-panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black uppercase text-white">Email & SMS template</h2>
              <p className="plc-copy mt-2">
                Paste HTML, or upload a <code className="text-yellow">.html</code> file to replace the email HTML body.
                Plain text is used as a fallback and for some clients.
              </p>
            </div>
            <form action={resetNotificationTemplateAction}>
              <input type="hidden" name="key" value={notification.key} />
              <button className="plc-button-secondary">Reset to defaults</button>
            </form>
          </div>

          <form action={saveNotificationTemplateAction} className="mt-6 space-y-5">
            <input type="hidden" name="key" value={notification.key} />

            <label className="plc-label block space-y-2">
              <span>Email subject</span>
              <input
                name="email_subject"
                defaultValue={notification.emailSubject}
                className="plc-input w-full px-4 py-3"
              />
            </label>

            <label className="plc-label block space-y-2">
              <span>Email plain text</span>
              <textarea
                name="email_text"
                rows={6}
                defaultValue={notification.emailText}
                className="plc-input w-full px-4 py-3 font-mono text-sm"
              />
            </label>

            <label className="plc-label block space-y-2">
              <span>Email HTML</span>
              <textarea
                name="email_html"
                rows={14}
                defaultValue={notification.emailHtml}
                className="plc-input w-full px-4 py-3 font-mono text-xs leading-5"
              />
            </label>

            <label className="plc-label block space-y-2">
              <span>Upload HTML file (optional — replaces HTML body on save)</span>
              <input
                name="html_file"
                type="file"
                accept=".html,.htm,text/html,text/plain"
                className="block w-full text-sm text-white/70 file:mr-4 file:rounded-full file:border-0 file:bg-yellow file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:text-black"
              />
            </label>

            {notification.supportsSms ? (
              <label className="plc-label block space-y-2">
                <span>SMS body</span>
                <textarea
                  name="sms_body"
                  rows={3}
                  defaultValue={notification.smsBody}
                  className="plc-input w-full px-4 py-3 font-mono text-sm"
                />
              </label>
            ) : (
              <input type="hidden" name="sms_body" value="" />
            )}

            <button className="plc-button">Save template</button>
          </form>

          {notification.emailHtml ? (
            <div className="mt-8 border-t border-white/10 pt-6">
              <p className="text-sm font-black uppercase text-white/50">HTML preview (raw styles)</p>
              <div
                className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-white p-4 text-black"
                dangerouslySetInnerHTML={{ __html: notification.emailHtml }}
              />
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
