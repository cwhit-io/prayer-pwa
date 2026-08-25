"use client";

import { useState } from "react";
import { FormSubmitButton } from "@/app/components/form-submit-button";
import { savePrayerSessionAction } from "./actions";

export function ManualEntry({
  promptId,
  requestId,
  focusLabel,
  defaultMinutes,
  today,
  canSaveToHistory = true,
  timerActive = false,
  defaultOpen = false,
  collapsible = true
}: {
  promptId?: string;
  requestId?: string;
  focusLabel?: string;
  defaultMinutes: number;
  today: string;
  canSaveToHistory?: boolean;
  timerActive?: boolean;
  defaultOpen?: boolean;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function saveManualEntry(formData: FormData) {
    setMessage(null);
    let result: Awaited<ReturnType<typeof savePrayerSessionAction>>;
    try {
      result = await savePrayerSessionAction(formData);
    } catch {
      result = { ok: false, error: "The network connection was interrupted. Your entry was not saved." };
    }
    setMessage(result.ok
      ? {
          kind: "success",
          text: result.signedIn
            ? `${result.minutes} prayer ${result.minutes === 1 ? "minute" : "minutes"} saved to your history.`
            : `${result.minutes} guest prayer ${result.minutes === 1 ? "minute" : "minutes"} recorded.`,
        }
      : { kind: "error", text: result.error });
  }

  if (!open && collapsible) {
    return (
      <div className="flex justify-center">
        <button type="button" onClick={() => setOpen(true)} className="plc-button-secondary">
          Log prayer completed earlier
        </button>
      </div>
    );
  }

  return (
    <form action={saveManualEntry} className="plc-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
         <div>
           <h2 className="text-2xl font-black uppercase text-white">Add prayer time from earlier</h2>
           <p className="plc-copy mt-2">Use this form if you already prayed and did not use the timer.</p>
           {timerActive ? (
             <p className="mt-2 text-base font-black text-yellow">This creates a separate entry. Your timer will keep running.</p>
           ) : null}
         </div>
         {collapsible ? (
           <button type="button" onClick={() => setOpen(false)} className="text-sm font-black uppercase text-yellow">
             Hide
           </button>
         ) : null}
      </div>
      <input type="hidden" name="entry_type" value="manual" />
      {promptId ? <input type="hidden" name="prompt_id" value={promptId} /> : null}
      {requestId ? <input type="hidden" name="request_id" value={requestId} /> : null}
      {focusLabel ? <input type="hidden" name="focus_label" value={focusLabel} /> : null}
      <div className="mt-6 grid gap-4">
        <label className="plc-label space-y-2">
           <span>How many minutes did you pray?</span>
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
           <span>What date did you pray?</span>
           <input required name="started_at" type="date" defaultValue={today} max={today} className="plc-input w-full px-4 py-3" />
         </label>
         {canSaveToHistory ? (
           <label className="plc-label space-y-2">
              <span>Optional private note about what you prayed for</span>
              <textarea name="notes" className="plc-input min-h-28 w-full px-4 py-3" placeholder="Share a note if it would help you remember this prayer." />
           </label>
         ) : (
           <p className="text-base text-white/75">Sign in to save private prayer notes and personal history.</p>
         )}
      </div>
         <FormSubmitButton pendingLabel="Adding prayer minutes…" className="plc-button mt-6">
          {canSaveToHistory ? "Add minutes to my history" : "Record guest prayer time"}
          </FormSubmitButton>
         {message ? (
           <p className={`mt-4 text-base ${message.kind === "error" ? "text-red-200" : "text-yellow"}`} role={message.kind === "error" ? "alert" : "status"}>
             {message.text}
           </p>
         ) : null}
    </form>
  );
}
