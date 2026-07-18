import { saveNotificationPreferencesAction } from "./notification-prefs-actions";

export function NotificationPreferencesForm({
  emailPrayerRequestUpdates,
  notifyEmail
}: {
  emailPrayerRequestUpdates: boolean;
  notifyEmail: string | null;
}) {
  return (
    <article className="plc-panel p-6">
      <p className="plc-eyebrow">Account</p>
      <h2 className="mt-2 text-2xl font-black uppercase text-white">My Notifications</h2>
      <p className="plc-copy mt-2 max-w-2xl">
        Opt in to email when someone prays for a request you submitted. We only send if you turn this on — no spam by
        default.
      </p>
      {notifyEmail ? (
        <p className="mt-3 text-sm text-white/50">
          Emails go to <span className="font-black text-white/80">{notifyEmail}</span>
        </p>
      ) : (
        <p className="mt-3 text-sm text-yellow/90">
          No deliverable email on file yet. Sign in with a household email (or add a verified email contact) so we know
          where to send updates.
        </p>
      )}

      <form action={saveNotificationPreferencesAction} className="mt-5 space-y-4">
        <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/80">
          <input
            name="email_prayer_request_updates"
            type="checkbox"
            defaultChecked={emailPrayerRequestUpdates}
            className="plc-checkbox mt-0.5"
          />
          <span>
            <span className="block font-black uppercase text-white">Email me when someone prays for my requests</span>
            <span className="mt-1 block text-white/55">
              Uses the “Someone prayed for your request” template from Admin → Notifications.
            </span>
          </span>
        </label>
        <button className="plc-button" type="submit">
          Save notification preferences
        </button>
      </form>
    </article>
  );
}
