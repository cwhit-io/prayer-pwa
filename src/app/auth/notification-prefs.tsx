import { saveNotificationPreferencesAction } from "./notification-prefs-actions";
import { FormSubmitButton } from "@/app/components/form-submit-button";

export function NotificationPreferencesForm({
  emailPrayerRequestUpdates,
  emailPledgeInvitations,
  emailProgressUpdates,
  notifyEmail,
  hasPledge
}: {
  emailPrayerRequestUpdates: boolean;
  emailPledgeInvitations: boolean;
  emailProgressUpdates: boolean;
  notifyEmail: string | null;
  hasPledge: boolean;
}) {
  return (
    <article className="plc-panel p-6">
      {notifyEmail ? (
        <p className="text-sm text-white/70">
          Emails go to <span className="font-black text-white/80">{notifyEmail}</span>
        </p>
      ) : (
        <p className="mt-3 text-sm text-yellow/90">
           No personal email is connected. Contact the church office for help connecting one.
        </p>
      )}

      <form action={saveNotificationPreferencesAction} className="mt-5 space-y-4">
        <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/80">
          <input
            name="email_prayer_request_updates"
            type="checkbox"
            defaultChecked={emailPrayerRequestUpdates}
            disabled={!notifyEmail}
            className="plc-checkbox mt-0.5"
          />
          <span>
            <span className="block font-black text-white">Someone prays for my request</span>
            <span className="mt-1 block text-white/55">
               Receive an email when another participant records prayer.
            </span>
          </span>
        </label>
        {!hasPledge ? <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/80">
          <input
            name="email_pledge_invitations"
            type="checkbox"
            defaultChecked={emailPledgeInvitations}
            disabled={!notifyEmail}
            className="plc-checkbox mt-0.5"
          />
          <span>
             <span className="block font-black text-white">Invitation to make a campaign pledge</span>
            <span className="mt-1 block text-white/55">
               Stops after you set a goal or receive five invitations.
            </span>
          </span>
        </label> : null}
        <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/80">
          <input
            name="email_progress_updates"
            type="checkbox"
            defaultChecked={emailProgressUpdates}
            disabled={!notifyEmail}
            className="plc-checkbox mt-0.5"
          />
          <span>
            <span className="block font-black text-white">Prayer progress updates</span>
            <span className="mt-1 block text-white/55">
               Campaign pledge progress and church-wide updates.
            </span>
          </span>
        </label>
          <FormSubmitButton pendingLabel="Saving notification settings…" disabled={!notifyEmail}>
            Save notification settings
          </FormSubmitButton>
      </form>
    </article>
  );
}
