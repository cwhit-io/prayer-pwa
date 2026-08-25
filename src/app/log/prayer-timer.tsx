"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { logPrayerSessionAction } from "./actions";

export function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

export function buildTimerSessionFormData(input: {
  clientSessionId?: string | null;
  elapsedSeconds: number;
  notes: string;
  startedAt: Date | null;
  promptId?: string | null;
  requestId?: string | null;
  focusLabel?: string | null;
}) {
  const endedAt = new Date();
  const minutes = Math.max(1, Math.ceil(input.elapsedSeconds / 60));
  const formData = new FormData();
  const start =
    input.startedAt ?? new Date(endedAt.getTime() - Math.max(1, input.elapsedSeconds) * 1000);

  formData.set("entry_type", "timer");
  formData.set("minutes", String(minutes));
  formData.set("elapsed_seconds", String(Math.max(1, Math.floor(input.elapsedSeconds))));
  formData.set("started_at", start.toISOString());
  formData.set("ended_at", endedAt.toISOString());
  formData.set("notes", input.notes);

  if (input.clientSessionId) {
    formData.set("client_session_id", input.clientSessionId);
  }

  if (input.promptId) {
    formData.set("prompt_id", input.promptId);
  }
  if (input.requestId) {
    formData.set("request_id", input.requestId);
  }
  if (input.focusLabel) {
    formData.set("focus_label", input.focusLabel);
  }

  return formData;
}

/** In-page timer controls for the PRAY session. */
export function SessionTimerBar({
  promptId,
  requestId,
  focusLabel,
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
  saveLabel,
  canSaveNotes = true
}: {
  promptId?: string;
  requestId?: string;
  focusLabel?: string;
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
  canSaveNotes?: boolean;
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
      promptId,
      requestId,
      focusLabel
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
            <span
              className="font-mono text-5xl font-black tabular-nums leading-none text-white sm:text-7xl"
              role="timer"
              aria-label={`Prayer session elapsed time: ${formatElapsed(elapsedSeconds)}`}
            >
              {formatElapsed(elapsedSeconds)}
            </span>
            <span className="text-xs font-black uppercase tracking-[0.18em] text-yellow">
              {isRunning ? "Running" : elapsedSeconds > 0 ? "Paused" : "Ready"}
            </span>
            <span className="sr-only" aria-live="polite">
              {isRunning ? "Prayer timer running" : elapsedSeconds > 0 ? "Prayer timer paused" : "Prayer timer ready"}
            </span>
          </div>
          {onEnd ? (
            <button type="button" onClick={onEnd} className="min-h-11 px-3 text-xs font-black uppercase text-white/70 hover:text-yellow">
              Finish prayer
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
            {busy ? "Saving…" : saveLabel || "Save prayer time"}
          </button>
          {canSaveNotes ? (
            <button
              type="button"
              onClick={() => setShowNotes((value) => !value)}
              className={`${btn} border border-white/25 text-white`}
              aria-expanded={showNotes}
              aria-controls="prayer-note"
            >
              {showNotes ? "Hide prayer note" : "Add prayer note"}
            </button>
          ) : null}
          <button type="button" onClick={onReset} className={`${btn} border border-white/25 text-white`}>
             Discard and restart
          </button>
        </div>

        <p className="text-sm text-white/75">
          Your time is being tracked. It is not saved until you choose{" "}
          <strong className="text-white">{saveLabel || "Save prayer time"}</strong>.
        </p>
        <p className="text-sm text-white/75">Partial minutes are recorded as the next whole minute.</p>
        {!canSaveNotes ? (
          <p className="text-sm text-white/75">Sign in before praying if you want to save a private prayer note.</p>
        ) : null}

        {showNotes ? (
          <label className="block space-y-2">
            <span className="plc-label">Prayer note (optional)</span>
            <textarea
              id="prayer-note"
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              className="plc-input h-28 w-full resize-none px-3 py-2 text-sm sm:h-32"
              placeholder="This note is saved with your prayer session."
              autoFocus
            />
          </label>
        ) : null}
      </div>
    </section>
  );
}

/** Wall-clock elapsed time, including time while a phone suspends background JavaScript. */
export function useSessionClock(isActive: boolean, isRunning: boolean, maxSeconds = Number.POSITIVE_INFINITY) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const runningSinceRef = useRef<number | null>(null);
  const maxSecondsRef = useRef(maxSeconds);
  maxSecondsRef.current = maxSeconds;

  useEffect(() => {
    if (!isActive) {
      accumulatedRef.current = 0;
      runningSinceRef.current = null;
      setElapsedSeconds(0);
      return;
    }

    if (!isRunning) {
      if (runningSinceRef.current != null) {
        accumulatedRef.current = Math.min(
          maxSeconds,
          accumulatedRef.current + Math.max(0, Math.floor((Date.now() - runningSinceRef.current) / 1000))
        );
        runningSinceRef.current = null;
        setElapsedSeconds(accumulatedRef.current);
      }
      return;
    }

    runningSinceRef.current ??= Date.now();
    const updateElapsed = () => {
      const runningSeconds = runningSinceRef.current == null
        ? 0
        : Math.max(0, Math.floor((Date.now() - runningSinceRef.current) / 1000));
      setElapsedSeconds(Math.min(maxSeconds, accumulatedRef.current + runningSeconds));
    };

    updateElapsed();
    intervalRef.current = window.setInterval(() => {
      updateElapsed();
    }, 1000);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
      if (runningSinceRef.current != null) {
        accumulatedRef.current = Math.min(
          maxSeconds,
          accumulatedRef.current + Math.max(0, Math.floor((Date.now() - runningSinceRef.current) / 1000))
        );
        runningSinceRef.current = null;
      }
    };
  }, [isActive, isRunning, maxSeconds]);

  const resetElapsed = useCallback(() => {
    accumulatedRef.current = 0;
    runningSinceRef.current = null;
    setElapsedSeconds(0);
  }, []);

  const restoreElapsed = useCallback((seconds: number) => {
    const restored = Math.min(maxSecondsRef.current, Math.max(0, Math.floor(seconds)));
    accumulatedRef.current = restored;
    runningSinceRef.current = null;
    setElapsedSeconds(restored);
  }, []);

  return { elapsedSeconds, resetElapsed, restoreElapsed };
}
