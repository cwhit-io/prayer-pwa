"use client";

import { useState } from "react";
import type { LinkedUserSummary } from "@/lib/planning-center";
import {
  adminRecordPrayerSessionAction,
  adminSavePledgeAction,
  manualPersonOverrideAction,
  refreshUserAction,
  setUserRoleAction,
  syncUserAction,
  unlinkUserAction
} from "./planning-center/actions";

export function MemberEditor({ entry, credentialsConfigured }: { entry: LinkedUserSummary; credentialsConfigured: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="plc-button-secondary">Manage person</button>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby={`edit-person-${entry.id}`}>
          <div className="plc-panel max-h-[92vh] w-full max-w-3xl overflow-y-auto p-6 sm:p-8">
            <header className="flex items-start justify-between gap-5 border-b border-white/10 pb-5">
              <div>
                <p className="plc-eyebrow">Manage person</p>
                <h2 id={`edit-person-${entry.id}`} className="mt-2 text-3xl font-black uppercase text-white">{entry.name}</h2>
                <p className="mt-1 text-white/70">{entry.email}</p>
                <p className="mt-3 text-sm text-white/75">{entry.totalMinutesPrayed.toLocaleString()} campaign minutes prayed · {entry.minutesPerWeek ? `${entry.minutesPerWeek} minutes/week pledged` : "No active campaign pledge"}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="plc-button-secondary">Close</button>
            </header>

            <div className="mt-6 space-y-6">
              <section>
                <div className="mb-3">
                  <h3 className="text-xl font-black uppercase text-white">Access and role</h3>
                  <p className="mt-1 text-sm text-white/70">Use these controls only when someone needs staff access or prayer-team access.</p>
                </div>
                <form action={setUserRoleAction} className="plc-card-muted grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <input type="hidden" name="user_id" value={entry.id} />
                  <label className="plc-label block space-y-2">
                    <span>Application role</span>
                    <select name="role" defaultValue={entry.role} className="plc-input w-full px-3 py-2">
                      <option value="member">Member</option>
                      <option value="prayer_team">Prayer Team</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                  </label>
                  <button className="plc-button-secondary">Save role</button>
                  <p className="text-sm text-white/70 sm:col-span-2">Prayer Team manages prompts and participant entries without viewing progress or moderation. Only superadmins can view private requests or change sensitive settings.</p>
                </form>
              </section>

              <section>
                <div className="mb-3">
                  <h3 className="text-xl font-black uppercase text-white">Directory connection</h3>
                  <p className="mt-1 text-sm text-white/70">Connect or refresh this person&apos;s household and friends lists.</p>
                </div>
                <div className="plc-card-muted flex flex-wrap items-center justify-between gap-4 p-4">
                  <div><p className="font-black text-white">{entry.planningCenterPersonId ? "Connected to the church directory" : "Not connected to the church directory"}</p><p className="mt-1 text-sm text-white/60">{entry.familyCount} household people · {entry.friendsCount} friends</p></div>
                  <div className="flex flex-wrap gap-2">
                    <form action={syncUserAction}><input type="hidden" name="user_id" value={entry.id} /><button className="plc-button-secondary" disabled={!credentialsConfigured}>Sync connection</button></form>
                    {entry.planningCenterPersonId ? <><form action={refreshUserAction}><input type="hidden" name="user_id" value={entry.id} /><button className="plc-button-secondary" disabled={!credentialsConfigured}>Refresh prayer lists</button></form><form action={unlinkUserAction}><input type="hidden" name="user_id" value={entry.id} /><button className="plc-button-secondary">Disconnect</button></form></> : null}
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3"><h3 className="text-xl font-black uppercase text-white">Update prayer activity</h3><p className="mt-1 text-sm text-white/70">Use these when staff receive an offline prayer update or need to record a campaign pledge.</p></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <form action={adminRecordPrayerSessionAction} className="plc-card-muted space-y-3 p-4">
                    <input type="hidden" name="user_id" value={entry.id} />
                    <p className="font-black uppercase text-yellow">Add prayer minutes</p>
                    <label className="plc-label block space-y-2"><span>Minutes prayed</span><input required name="minutes" type="number" min="1" defaultValue="15" className="plc-input w-full px-3 py-2" /></label>
                    <label className="plc-label block space-y-2"><span>Note (optional)</span><input name="notes" className="plc-input w-full px-3 py-2" placeholder="How were these minutes reported?" /></label>
                    <button className="plc-button-secondary">Add minutes</button>
                  </form>
                  <form action={adminSavePledgeAction} className="plc-card-muted space-y-3 p-4">
                    <input type="hidden" name="user_id" value={entry.id} />
                    <p className="font-black uppercase text-yellow">Set campaign pledge pace</p>
                    <label className="plc-label block space-y-2"><span>Minutes pledged per week</span><input required name="minutes_per_week" type="number" min="1" defaultValue={entry.minutesPerWeek ?? 70} className="plc-input w-full px-3 py-2" /></label>
                     <button className="plc-button-secondary">Save campaign pledge</button>
                  </form>
                </div>
              </section>

              <details className="border-t border-white/10 pt-5">
                <summary className="cursor-pointer text-sm font-black uppercase text-yellow">Advanced directory connection</summary>
                <p className="mt-2 text-sm text-white/70">Use this only when the church directory connection needs to be corrected manually.</p>
                <form action={manualPersonOverrideAction} className="mt-4 space-y-3">
                  <input type="hidden" name="user_id" value={entry.id} />
                  <label className="plc-label block space-y-2"><span>Directory person ID</span><input required name="person_id" defaultValue={entry.planningCenterPersonId ?? ""} className="plc-input w-full px-3 py-2 font-mono text-sm" /></label>
                  <label className="plc-label block space-y-2"><span>Directory display name</span><input name="display_name" defaultValue={entry.planningCenterDisplayName ?? entry.name} className="plc-input w-full px-3 py-2" /></label>
                  <label className="flex items-center gap-2 text-sm text-white/75"><input name="pull_lists" type="checkbox" defaultChecked className="plc-checkbox" /> Refresh household and friends lists after saving</label>
                  <button className="plc-button-secondary">Save directory connection</button>
                </form>
              </details>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
