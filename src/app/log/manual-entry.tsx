"use client";

import { useState } from "react";
import { logPrayerSessionAction } from "./actions";

export function ManualEntry({
  promptId,
  defaultMinutes,
  today
}: {
  promptId?: string;
  defaultMinutes: number;
  today: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex justify-center">
        <button type="button" onClick={() => setOpen(true)} className="plc-button-secondary">
          Enter minutes manually
        </button>
      </div>
    );
  }

  return (
    <form action={logPrayerSessionAction} className="plc-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-black uppercase text-white">Manual entry</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-black uppercase text-yellow">
          Hide
        </button>
      </div>
      <input type="hidden" name="entry_type" value="manual" />
      {promptId ? <input type="hidden" name="prompt_id" value={promptId} /> : null}
      <div className="mt-6 grid gap-4">
        <label className="plc-label space-y-2">
          <span>Minutes</span>
          <input
            required
            name="minutes"
            type="number"
            min="1"
            defaultValue={defaultMinutes}
            className="plc-input w-full px-4 py-3"
          />
        </label>
        <label className="plc-label space-y-2">
          <span>Date</span>
          <input required name="started_at" type="date" defaultValue={today} className="plc-input w-full px-4 py-3" />
        </label>
        <label className="plc-label space-y-2">
          <span>Notes</span>
          <textarea name="notes" className="plc-input min-h-28 w-full px-4 py-3" placeholder="Optional prayer note" />
        </label>
      </div>
      <button className="plc-button mt-6">Save manual entry</button>
    </form>
  );
}
