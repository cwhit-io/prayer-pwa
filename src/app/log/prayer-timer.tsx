"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { logPrayerSessionAction } from "./actions";

export function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

export function buildTimerSessionFormData(input: {
  elapsedSeconds: number;
  notes: string;
  startedAt: Date | null;
  promptId?: string | null;
}) {
  const endedAt = new Date();
  const minutes = Math.max(1, Math.ceil(input.elapsedSeconds / 60));
  const formData = new FormData();
  const start =
    input.startedAt ?? new Date(endedAt.getTime() - Math.max(1, input.elapsedSeconds) * 1000);

  formData.set("entry_type", "timer");
  formData.set("minutes", String(minutes));
  formData.set("started_at", start.toISOString());
  formData.set("ended_at", endedAt.toISOString());
  formData.set("notes", input.notes);

  if (input.promptId) {
    formData.set("prompt_id", input.promptId);
  }

  return formData;
}

/** In-page timer controls for the PRAY session. */
export function SessionTimerBar({
  promptId,
  elapsedSeconds,
  isRunning,
  notes,
  startedAt,
  onNotesChange,
  onPause,
  onResume,
  onReset,
  onEnd,
  onSave,
  saving = false,
  saveLabel
}: {
  promptId?: string;
  elapsedSeconds: number;
  isRunning: boolean;
  notes: string;
  startedAt: Date | null;
  onNotesChange: (value: string) => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  /** Request end (parent may confirm save first). */
  onEnd?: () => void;
  /** Optional override for Save; defaults to logging the session. */
  onSave?: () => void;
  saving?: boolean;
  /** Override Save button label (e.g. guest “Sign in to save”). */
  saveLabel?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [showNotes, setShowNotes] = useState(false);
  const busy = isPending || saving;

  function finishTimer() {
    if (onSave) {
      onSave();
      return;
    }

    const formData = buildTimerSessionFormData({
      elapsedSeconds,
      notes,
      startedAt,
      promptId
    });

    startTransition(() => {
      void logPrayerSessionAction(formData);
    });
  }

  const btn =
    "inline-flex min-h-11 min-w-[4.75rem] flex-1 items-center justify-center rounded-full px-4 py-2.5 text-sm font-black uppercase sm:flex-none sm:min-w-0";

  return (
    <section className="plc-panel p-5 sm:p-7">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-baseline">
            <span className="font-mono text-5xl font-black tabular-nums leading-none text-white sm:text-7xl">
              {formatElapsed(elapsedSeconds)}
            </span>
            <span className="text-xs font-black uppercase tracking-[0.18em] text-yellow">
              {isRunning ? "Running" : elapsedSeconds > 0 ? "Paused" : "Ready"}
            </span>
          </div>
          {onEnd ? (
            <button type="button" onClick={onEnd} className="text-xs font-black uppercase text-white/50 hover:text-yellow">
              End session
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
          {!isRunning ? (
            <button type="button" onClick={onResume} className={`${btn} bg-yellow text-black`}>
              {elapsedSeconds === 0 ? "Start" : "Resume"}
            </button>
          ) : (
            <button type="button" onClick={onPause} className={`${btn} bg-yellow text-black`}>
              Pause
            </button>
          )}
          <button
            type="button"
            onClick={finishTimer}
            disabled={busy || elapsedSeconds === 0}
            className={`${btn} border border-white/25 text-white disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {busy ? "…" : saveLabel || "Save"}
          </button>
          <button
            type="button"
            onClick={() => setShowNotes((value) => !value)}
            className={`${btn} border border-white/25 text-white`}
            aria-expanded={showNotes}
          >
            Note
          </button>
          <button type="button" onClick={onReset} className={`${btn} border border-white/25 text-white`}>
            Reset
          </button>
        </div>

        {showNotes ? (
          <textarea
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            className="plc-input h-28 w-full resize-none px-3 py-2 text-sm sm:h-32"
            placeholder="Optional prayer note"
            autoFocus
          />
        ) : null}
      </div>
    </section>
  );
}

/** Elapsed seconds while a session is active and running. */
export function useSessionClock(isActive: boolean, isRunning: boolean) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      setElapsedSeconds(0);
      return;
    }

    if (!isRunning) {
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [isActive, isRunning]);

  const resetElapsed = useCallback(() => {
    setElapsedSeconds(0);
  }, []);

  return { elapsedSeconds, resetElapsed };
}
