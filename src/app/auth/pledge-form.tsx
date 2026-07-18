"use client";

import { useState } from "react";
import { savePledgeAction } from "@/app/pledge/actions";

const pledgePresets = [
  { label: "5 min/day", minutesPerWeek: 35 },
  { label: "10 min/day", minutesPerWeek: 70 },
  { label: "15 min/day", minutesPerWeek: 105 },
  { label: "30 min/day", minutesPerWeek: 210 }
];

export function PledgeForm({
  defaultMinutesPerWeek = 70,
  defaultIsPublic = true,
  isUpdate = false,
  onCancel
}: {
  defaultMinutesPerWeek?: number;
  defaultIsPublic?: boolean;
  isUpdate?: boolean;
  onCancel?: () => void;
}) {
  const [minutesPerWeek, setMinutesPerWeek] = useState(defaultMinutesPerWeek);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {pledgePresets.map((preset) => {
          const selected = minutesPerWeek === preset.minutesPerWeek;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => setMinutesPerWeek(preset.minutesPerWeek)}
              className={`rounded-full px-4 py-2 text-[11px] font-black uppercase transition ${
                selected
                  ? "bg-yellow text-black"
                  : "border border-white/20 bg-black/30 text-white/75 hover:border-yellow/50"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <form action={savePledgeAction} className="mt-6 space-y-4">
        <label className="plc-label block space-y-2">
          <span>Weekly minutes</span>
          <input
            required
            name="minutes_per_week"
            type="number"
            min="1"
            value={minutesPerWeek}
            onChange={(event) => setMinutesPerWeek(Number(event.target.value) || 0)}
            className="plc-input w-full px-4 py-3"
          />
        </label>
        <label className="plc-card-muted flex items-center gap-3 px-4 py-3 text-sm text-white/75">
          <input
            name="is_public"
            type="checkbox"
            defaultChecked={defaultIsPublic}
            className="plc-checkbox"
          />
          Count this pledge in public campaign totals
        </label>
        <div className="flex flex-wrap gap-3">
          <button className="plc-button">{isUpdate ? "Update pledge" : "Save pledge"}</button>
          {isUpdate && onCancel ? (
            <button type="button" onClick={onCancel} className="plc-button-secondary">
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

/** Full pledge card — only shown when the user has no pledge yet. */
export function PledgeSection({
  hasPledge,
  minutesPerWeek,
  isPublic
}: {
  hasPledge: boolean;
  minutesPerWeek: number | null;
  isPublic: boolean;
}) {
  if (hasPledge) {
    return null;
  }

  return (
    <article id="pledge" className="plc-panel p-6">
      <p className="plc-eyebrow">Commitment</p>
      <h2 className="mt-2 text-2xl font-black uppercase text-white">My Pledge</h2>
      <p className="plc-copy mt-2">Choose a rhythm that fits your life. You can update this anytime.</p>
      <div className="mt-6">
        <PledgeForm
          defaultMinutesPerWeek={minutesPerWeek ?? 70}
          defaultIsPublic={isPublic}
          isUpdate={false}
        />
      </div>
    </article>
  );
}

/** Button shown in pledged minutes card when a pledge already exists. */
export function UpdatePledgeButton({
  minutesPerWeek,
  isPublic
}: {
  minutesPerWeek: number;
  isPublic: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-4 text-sm font-black uppercase text-yellow">
        Update my pledge
      </button>
    );
  }

  return (
    <div className="mt-5 border-t border-white/10 pt-5 text-left">
      <PledgeForm
        defaultMinutesPerWeek={minutesPerWeek}
        defaultIsPublic={isPublic}
        isUpdate
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
