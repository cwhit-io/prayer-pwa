"use client";

import { useState } from "react";
import type { StaffEntryUser } from "@/lib/planning-center";
import {
  adminRecordPrayerSessionAction,
  adminSavePledgeAction
} from "./planning-center/actions";

export function StaffEntryEditor({ entry }: { entry: StaffEntryUser }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="plc-button-secondary">
        Record update
      </button>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby={`staff-entry-${entry.id}`}>
          <div className="plc-panel max-h-[92vh] w-full max-w-3xl overflow-y-auto p-6 sm:p-8">
            <header className="flex items-start justify-between gap-5 border-b border-white/10 pb-5">
              <div>
                <p className="plc-eyebrow">Record participant update</p>
                <h2 id={`staff-entry-${entry.id}`} className="mt-2 text-3xl font-black uppercase text-white">{entry.name}</h2>
                <p className="mt-1 text-white/70">{entry.email}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="plc-button-secondary">Close</button>
            </header>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <form action={adminRecordPrayerSessionAction} className="plc-card-muted space-y-3 p-4">
                <input type="hidden" name="user_id" value={entry.id} />
                <p className="font-black uppercase text-yellow">Add prayer minutes</p>
                <label className="plc-label block space-y-2"><span>Minutes prayed</span><input required name="minutes" type="number" min="1" defaultValue="15" className="plc-input w-full px-3 py-2" /></label>
                <label className="plc-label block space-y-2"><span>Note (optional)</span><input name="notes" className="plc-input w-full px-3 py-2" placeholder="How were these minutes reported?" /></label>
                <button className="plc-button-secondary">Add minutes</button>
              </form>
              <form action={adminSavePledgeAction} className="plc-card-muted space-y-3 p-4">
                <input type="hidden" name="user_id" value={entry.id} />
                <p className="font-black uppercase text-yellow">Campaign pledge</p>
                {entry.hasPledge ? (
                  <p className="text-sm text-white/70">A campaign pledge is already recorded for this person. Ask an admin to make changes.</p>
                ) : (
                  <>
                    <p className="text-sm text-white/70">No active pledge is recorded.</p>
                    <label className="plc-label block space-y-2"><span>Minutes pledged per week</span><input required name="minutes_per_week" type="number" min="1" defaultValue="70" className="plc-input w-full px-3 py-2" /></label>
                    <button className="plc-button-secondary">Add campaign pledge</button>
                  </>
                )}
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
