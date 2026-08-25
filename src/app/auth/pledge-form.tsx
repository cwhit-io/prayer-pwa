"use client";

import { useState } from "react";
import { FormSubmitButton } from "@/app/components/form-submit-button";
import { removePledgeAction, savePledgeAction } from "@/app/pledge/actions";

const pledgePresets = [
  { label: "5 min/day", minutesPerWeek: 35 },
  { label: "10 min/day", minutesPerWeek: 70 },
  { label: "15 min/day", minutesPerWeek: 105 },
  { label: "30 min/day", minutesPerWeek: 210 }
];

export function PledgeForm({
  defaultMinutesPerWeek = 70,
  isUpdate = false,
  installmentCount = 52,
  campaignStarted = false,
  committedBeforeNextRate = 0,
  futureInstallments = installmentCount,
  onCancel
}: {
  defaultMinutesPerWeek?: number;
  isUpdate?: boolean;
  installmentCount?: number;
  campaignStarted?: boolean;
  committedBeforeNextRate?: number;
  futureInstallments?: number;
  onCancel?: () => void;
}) {
  const [minutesPerWeek, setMinutesPerWeek] = useState(defaultMinutesPerWeek);
  const projectedCommitment = campaignStarted && isUpdate
    ? committedBeforeNextRate + minutesPerWeek * futureInstallments
    : minutesPerWeek * installmentCount;

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
              aria-pressed={selected}
              className={`min-h-11 rounded-full px-4 py-2 text-sm font-black transition ${
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
            <span>How many minutes will you pledge each week?</span>
          <input
            required
            name="minutes_per_week"
            type="number"
             min="1"
             max="10080"
             step="1"
             autoFocus={isUpdate}
            value={minutesPerWeek}
            onChange={(event) => setMinutesPerWeek(Number(event.target.value) || 0)}
            className="plc-input w-full px-4 py-3"
          />
        </label>
        <p className="rounded-xl border border-yellow/25 bg-yellow/10 px-4 py-3 text-sm text-white/80">
          {campaignStarted && isUpdate
            ? <>This pace applies to {futureInstallments} future campaign {futureInstallments === 1 ? "week" : "weeks"}. Your updated commitment will be <strong className="text-yellow">{projectedCommitment.toLocaleString()} minutes</strong>, including earlier weekly rates.</>
            : <>At this rate, your {installmentCount}-week campaign pledge is <strong className="text-yellow">{projectedCommitment.toLocaleString()} minutes</strong>.</>}
        </p>
        <div className="flex flex-wrap gap-3">
          <FormSubmitButton pendingLabel={isUpdate ? "Updating your pledge…" : "Saving your pledge…"}>
            {isUpdate ? "Update campaign pledge" : "Save campaign pledge"}
          </FormSubmitButton>
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
  installmentCount = 52
}: {
  hasPledge: boolean;
  minutesPerWeek: number | null;
  installmentCount?: number;
}) {
  if (hasPledge) {
    return null;
  }

  return (
    <article id="pledge" className="plc-panel border border-yellow/30 p-6 shadow-[0_0_0_1px_rgba(255,211,0,0.08)]">
       <p className="plc-eyebrow">Campaign commitment</p>
        <h2 className="mt-2 text-2xl font-black uppercase text-white">Make a prayer pledge</h2>
        <p className="plc-copy mt-2">
          Choose a weekly pace for the {installmentCount}-week campaign. Prayer credited to the campaign counts whether or not you make a pledge.
      </p>
      <div className="mt-6">
        <PledgeForm
          defaultMinutesPerWeek={minutesPerWeek ?? 70}
          isUpdate={false}
          installmentCount={installmentCount}
        />
      </div>
    </article>
  );
}

/** Button shown in pledged minutes card when a pledge already exists. */
export function UpdatePledgeButton({
  minutesPerWeek,
  installmentCount,
  campaignStarted,
  committedBeforeNextRate,
  futureInstallments
}: {
  minutesPerWeek: number;
  installmentCount: number;
  campaignStarted: boolean;
  committedBeforeNextRate: number;
  futureInstallments: number;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 min-h-11 text-sm font-black uppercase text-yellow"
        aria-expanded="false"
        aria-controls="weekly-goal-editor"
      >
        Update campaign pledge
      </button>
    );
  }

  return (
    <div id="weekly-goal-editor" className="mt-5 border-t border-white/10 pt-5 text-left">
      <PledgeForm
        defaultMinutesPerWeek={minutesPerWeek}
        isUpdate
        installmentCount={installmentCount}
        campaignStarted={campaignStarted}
        committedBeforeNextRate={committedBeforeNextRate}
        futureInstallments={futureInstallments}
        onCancel={() => setOpen(false)}
      />
      <form action={removePledgeAction} className="mt-4 border-t border-white/10 pt-4">
        <button
          type="submit"
          className="min-h-11 text-sm font-black text-red-200 underline"
          onClick={(event) => {
            if (!window.confirm("Withdraw this campaign pledge? Your prayer history will not be deleted.")) event.preventDefault();
          }}
        >
          Withdraw campaign pledge
        </button>
      </form>
    </div>
  );
}
