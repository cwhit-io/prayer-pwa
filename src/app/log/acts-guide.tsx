"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshIcon } from "@/app/components/icons";
import { ScriptureReference } from "@/app/components/scripture-reference";
import type { SessionFocus } from "@/lib/pray-links";
import { logPrayerSessionAction, markFocusPrayedAction, refreshStepPromptAction } from "./actions";
import { ManualEntry } from "./manual-entry";
import { buildTimerSessionFormData, formatElapsed, SessionTimerBar, useSessionClock } from "./prayer-timer";

export type { SessionFocus };

export type StepPrompt = {
  id: string;
  title: string;
  body: string;
  scriptureReference: string | null;
  scriptureText: string | null;
  scriptureHref: string | null;
  tags?: string[];
};

type StepLetter = "A" | "C" | "T" | "S";

type PromptMap = Record<StepLetter, StepPrompt | null | undefined>;

const defaultSteps = [
  {
    letter: "A" as const,
    name: "Adoration",
    focus: "Worship God for who He is",
    fallbackPrompt: "Praise God for His character—His love, power, faithfulness, and presence with you right now."
  },
  {
    letter: "C" as const,
    name: "Confession",
    focus: "Be honest before Him",
    fallbackPrompt: "Bring anything that weighs on you. Receive His forgiveness without shame—grace meets you here."
  },
  {
    letter: "T" as const,
    name: "Thanksgiving",
    focus: "Name His gifts",
    fallbackPrompt: "Thank God for specific people, mercies, and answered prayers. Gratitude softens the heart."
  },
  {
    letter: "S" as const,
    name: "Supplication",
    focus: "Ask and intercede",
    fallbackPrompt: "Pray for your needs and for others—Future, Family, Friends, and Finances. Ask boldly and trust Him."
  }
];

function focusToStepPrompt(focus: SessionFocus): StepPrompt {
  return {
    id: focus.id,
    title: focus.title,
    body: focus.body,
    scriptureReference: focus.scriptureReference ?? null,
    scriptureText: focus.scriptureText ?? null,
    scriptureHref: focus.scriptureHref ?? null,
    tags: focus.tags ?? (focus.category ? [focus.category] : [])
  };
}

/** Minutes added each time someone continues past the soft session cap. */
const SESSION_EXTENSION_MINUTES = 30;
const DEFAULT_MAX_SESSION_MINUTES = 60;

function SaveLeaveDialog({
  elapsedSeconds,
  leaving,
  isSaving,
  onSave,
  onDiscard,
  onKeep
}: {
  elapsedSeconds: number;
  leaving: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onKeep: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-session-title"
    >
      <div className="plc-panel w-full max-w-md p-6 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
        <p className="plc-eyebrow">Save this prayer?</p>
        <h2 id="save-session-title" className="mt-2 text-2xl font-black uppercase text-white">
          {formatElapsed(elapsedSeconds)} unsaved
        </h2>
        <p className="plc-copy mt-3">
          {leaving
            ? "You’re leaving with unsaved prayer time. Save it to your total, or discard and continue."
            : "Save this time to your prayer total, or end without saving."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={onSave} disabled={isSaving} className="plc-button disabled:opacity-60">
            {isSaving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onDiscard} className="plc-button-secondary">
            {leaving ? "Leave without saving" : "End without saving"}
          </button>
          <button type="button" onClick={onKeep} className="plc-button-secondary">
            Keep praying
          </button>
        </div>
      </div>
    </div>
  );
}

function SoftCapDialog({
  elapsedSeconds,
  extensionMinutes,
  isSaving,
  onContinue,
  onSave,
  onEnd
}: {
  elapsedSeconds: number;
  extensionMinutes: number;
  isSaving: boolean;
  onContinue: () => void;
  onSave: () => void;
  onEnd: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="soft-cap-title"
    >
      <div className="plc-panel w-full max-w-md p-6 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
        <p className="plc-eyebrow">Session check-in</p>
        <h2 id="soft-cap-title" className="mt-2 text-2xl font-black uppercase text-white">
          {formatElapsed(elapsedSeconds)} so far
        </h2>
        <p className="plc-copy mt-3">
          The timer paused at the session soft cap so time doesn&apos;t run forever in the background. Continue for
          another {extensionMinutes} minutes, save what you have, or end without saving.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={onContinue} className="plc-button">
            Continue +{extensionMinutes} min
          </button>
          <button type="button" onClick={onSave} disabled={isSaving} className="plc-button-secondary disabled:opacity-60">
            {isSaving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onEnd} className="plc-button-secondary">
            End without saving
          </button>
        </div>
      </div>
    </div>
  );
}

function ActsStepTabs({
  active,
  setActive
}: {
  active: number;
  setActive: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {defaultSteps.map((step, index) => {
        const isActive = index === active;
        return (
          <button
            key={step.letter}
            type="button"
            onClick={() => setActive(index)}
            className={`rounded-xl border px-2 py-3 text-center transition ${
              isActive
                ? "border-yellow bg-yellow text-black shadow-[0_8px_24px_rgba(255,211,0,0.25)]"
                : "border-white/15 bg-black/30 text-white hover:border-yellow/50"
            }`}
            aria-label={step.name}
            aria-pressed={isActive}
          >
            <span className="block font-mono text-2xl font-black leading-none">{step.letter}</span>
          </button>
        );
      })}
    </div>
  );
}

function ActsStepContent({
  active,
  setActive,
  prompts,
  refreshingLetter,
  onRefresh,
  lockSupplication,
  supplicationKind,
  onPrayedForThis,
  isMarkingPrayed,
  showTags = false
}: {
  active: number;
  setActive: (index: number) => void;
  prompts: PromptMap;
  refreshingLetter: StepLetter | null;
  onRefresh: () => void;
  lockSupplication: boolean;
  supplicationKind?: "request" | "prompt" | null;
  onPrayedForThis?: () => void;
  isMarkingPrayed?: boolean;
  showTags?: boolean;
}) {
  const current = defaultSteps[active];
  const letter = current.letter;
  const stepContent = prompts[letter] ?? null;
  const isRefreshing = refreshingLetter === letter;
  const canRefresh = !(lockSupplication && letter === "S");
  const showPrayedButton = letter === "S" && Boolean(stepContent) && Boolean(onPrayedForThis);

  const sLabel =
    letter !== "S"
      ? `${current.name} prompt`
      : lockSupplication
        ? "Your focus"
        : supplicationKind === "request"
          ? "Community request"
          : supplicationKind === "prompt"
            ? "Campaign prompt"
            : "Supplication";

  return (
    <div className="space-y-5 sm:space-y-6">
      <ActsStepTabs active={active} setActive={setActive} />

      {stepContent ? (
        <article className="relative rounded-2xl border border-paper/10 bg-night-deep/70 p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4 pr-11">
            <div className="min-w-0 space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-yellow">{sLabel}</p>
              <h3 className="text-2xl font-black uppercase leading-snug text-paper sm:text-[1.75rem]">
                {stepContent.title}
              </h3>
              {showTags && stepContent.tags && stepContent.tags.length > 0 ? (
                <p className="text-xs font-black uppercase tracking-wide text-muted">
                  {stepContent.tags.join(" · ")}
                </p>
              ) : null}
            </div>
            {canRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing || isMarkingPrayed}
                title="Load another prompt"
                aria-label={`Load another ${current.name} prompt`}
                className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-paper/15 bg-surface text-yellow transition hover:border-yellow/60 hover:bg-surface-raised disabled:cursor-wait disabled:opacity-60 sm:right-5 sm:top-5"
              >
                <RefreshIcon
                  className={`h-4 w-4 ${isRefreshing || isMarkingPrayed ? "animate-spin" : ""}`}
                />
              </button>
            ) : null}
          </div>

          {stepContent.scriptureReference ? (
            <div className="mt-5 border-t border-paper/10 pt-5 sm:mt-6 sm:pt-6">
              <ScriptureReference
                reference={stepContent.scriptureReference}
                href={stepContent.scriptureHref}
                text={stepContent.scriptureText}
                className="space-y-3 [&_a]:text-base sm:[&_a]:text-lg [&_blockquote]:text-[1.08rem] sm:[&_blockquote]:text-lg [&_blockquote]:leading-relaxed"
              />
            </div>
          ) : null}

          <p className="plc-reading mt-5 text-base leading-relaxed sm:mt-6 sm:text-lg sm:leading-8">
            {stepContent.body}
          </p>

          {showPrayedButton ? (
            <button
              type="button"
              onClick={onPrayedForThis}
              disabled={isMarkingPrayed}
              className="plc-button mt-6 disabled:cursor-wait disabled:opacity-60"
            >
              {isMarkingPrayed ? "Recording…" : "I prayed for this"}
            </button>
          ) : null}
        </article>
      ) : (
        <div className="relative rounded-2xl border border-paper/10 bg-night-deep/70 p-5 sm:p-7">
          {canRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Load a prompt"
              aria-label={`Load a ${current.name} prompt`}
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-paper/15 bg-surface text-yellow transition hover:border-yellow/60 hover:bg-surface-raised disabled:cursor-wait disabled:opacity-60 sm:right-5 sm:top-5"
            >
              <RefreshIcon className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          ) : null}
          <p className="pr-12 text-base text-muted sm:text-lg">
            {isRefreshing ? "Loading a prompt…" : "No prompt loaded. Tap refresh to try one."}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 border-t border-paper/10 pt-5 sm:pt-6">
        <button
          type="button"
          disabled={active === 0}
          onClick={() => setActive(Math.max(0, active - 1))}
          className="plc-button-secondary min-w-[7.5rem] text-base disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[8.5rem] sm:text-lg"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={active === defaultSteps.length - 1}
          onClick={() => setActive(Math.min(defaultSteps.length - 1, active + 1))}
          className="plc-button min-w-[7.5rem] text-base disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[8.5rem] sm:text-lg"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function ActsGuide({
  promptId,
  actsPrompts,
  supplicationPrompt,
  focus = null,
  lockInitialFocus = false,
  includeRequests = true,
  canSaveSessions = true,
  maxSessionMinutes = DEFAULT_MAX_SESSION_MINUTES,
  showActsTags = false,
  manualEntry
}: {
  promptId?: string;
  actsPrompts?: {
    A?: StepPrompt | null;
    C?: StepPrompt | null;
    T?: StepPrompt | null;
  };
  supplicationPrompt?: StepPrompt | null;
  /** Current S focus (request or prompt) for labeling + prayer counts. */
  focus?: SessionFocus | null;
  /** When true (deep link from board/prompts), block S refresh until “I prayed for this”. */
  lockInitialFocus?: boolean;
  /** Members: include community requests in S refresh. Guests: prompts only. */
  includeRequests?: boolean;
  /**
   * When false, hide “I prayed for this” (needs a signed-in user).
   * Timer Save still works for guests — minutes go to the campaign total only.
   */
  canSaveSessions?: boolean;
  /** Soft auto-pause cap for the PRAY timer (from campaign settings). */
  maxSessionMinutes?: number;
  /** Campaign setting: show shared tags on step cards. */
  showActsTags?: boolean;
  /** Shown only when the timer session is not active. */
  manualEntry?: { defaultMinutes: number; today: string };
}) {
  const router = useRouter();
  const capSeconds = Math.max(1, Math.round(maxSessionMinutes)) * 60;
  const [supplicationFocus, setSupplicationFocus] = useState<SessionFocus | null>(focus);
  const [lockS, setLockS] = useState(Boolean(lockInitialFocus && focus));
  const [sessionActive, setSessionActive] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [notes, setNotes] = useState("");
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  // Always land on Adoration; focus still loads into Supplication for when they advance.
  const [active, setActive] = useState(0);
  const [prompts, setPrompts] = useState<PromptMap>({
    A: actsPrompts?.A ?? null,
    C: actsPrompts?.C ?? null,
    T: actsPrompts?.T ?? null,
    S: focus ? focusToStepPrompt(focus) : (supplicationPrompt ?? null)
  });
  const [timerPromptId, setTimerPromptId] = useState(
    focus?.kind === "prompt" ? focus.id : (promptId ?? supplicationPrompt?.id)
  );
  const [refreshingLetter, setRefreshingLetter] = useState<StepLetter | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [capDialogOpen, setCapDialogOpen] = useState(false);
  const [sessionLimitSeconds, setSessionLimitSeconds] = useState(capSeconds);
  const [pausedByTab, setPausedByTab] = useState(false);
  const [isSaving, startSaveTransition] = useTransition();
  const [isMarkingPrayed, setIsMarkingPrayed] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const { elapsedSeconds, resetElapsed } = useSessionClock(sessionActive, isRunning);
  const elapsedRef = useRef(0);
  const isRunningRef = useRef(false);
  const pendingHrefRef = useRef<string | null>(null);
  const allowNavRef = useRef(false);

  useEffect(() => {
    elapsedRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  const letter = defaultSteps[active].letter;
  const hasUnsavedTime = sessionActive && elapsedSeconds > 0;

  function startSession() {
    const now = new Date();
    setSessionActive(true);
    setIsRunning(true);
    setStartedAt(now);
    resetElapsed();
    setNotes("");
    setLeaveDialogOpen(false);
    setCapDialogOpen(false);
    setSessionLimitSeconds(capSeconds);
    setPausedByTab(false);
    pendingHrefRef.current = null;
    // Begin the session on Adoration; S already holds the loaded focus.
    setActive(0);
  }

  function clearSession() {
    setLeaveDialogOpen(false);
    setCapDialogOpen(false);
    setSessionActive(false);
    setIsRunning(false);
    setStartedAt(null);
    resetElapsed();
    setNotes("");
    setSessionLimitSeconds(capSeconds);
    setPausedByTab(false);
    pendingHrefRef.current = null;
  }

  function requestEndSession() {
    if (elapsedRef.current > 0) {
      setIsRunning(false);
      pendingHrefRef.current = null;
      setCapDialogOpen(false);
      setLeaveDialogOpen(true);
      return;
    }
    clearSession();
  }

  function saveSession() {
    if (elapsedSeconds <= 0) {
      return;
    }

    const formData = buildTimerSessionFormData({
      elapsedSeconds,
      notes,
      startedAt,
      promptId: timerPromptId
    });

    // Allow navigation/redirect after save without another confirm.
    allowNavRef.current = true;
    setCapDialogOpen(false);
    setLeaveDialogOpen(false);
    startSaveTransition(() => {
      void logPrayerSessionAction(formData);
    });
  }

  function discardAndLeave() {
    const href = pendingHrefRef.current;
    allowNavRef.current = true;
    clearSession();
    if (href) {
      router.push(href);
    }
  }

  function keepPraying() {
    pendingHrefRef.current = null;
    setLeaveDialogOpen(false);
    setPausedByTab(false);
    if (!startedAt) {
      setStartedAt(new Date(Date.now() - elapsedSeconds * 1000));
    }
    // If already at/over the soft cap, open the cap dialog instead of running past it.
    if (elapsedSeconds >= sessionLimitSeconds) {
      setCapDialogOpen(true);
      setIsRunning(false);
      return;
    }
    setIsRunning(true);
  }

  function extendSessionCap() {
    setSessionLimitSeconds((current) => current + SESSION_EXTENSION_MINUTES * 60);
    setCapDialogOpen(false);
    setPausedByTab(false);
    if (!startedAt) {
      setStartedAt(new Date(Date.now() - elapsedSeconds * 1000));
    }
    setIsRunning(true);
  }

  function endWithoutSavingFromCap() {
    pendingHrefRef.current = null;
    clearSession();
  }

  function resetSessionTimer() {
    setIsRunning(false);
    setStartedAt(null);
    resetElapsed();
    setNotes("");
    setSessionLimitSeconds(capSeconds);
    setCapDialogOpen(false);
    setPausedByTab(false);
  }

  function resumeSession() {
    setPausedByTab(false);
    if (!startedAt) {
      setStartedAt(new Date(Date.now() - elapsedSeconds * 1000));
    }
    if (elapsedSeconds >= sessionLimitSeconds) {
      setCapDialogOpen(true);
      setIsRunning(false);
      if (!sessionActive) {
        setSessionActive(true);
      }
      return;
    }
    setIsRunning(true);
    if (!sessionActive) {
      setSessionActive(true);
    }
  }

  function applySupplication(next: {
    kind?: "request" | "prompt";
    id: string;
    title: string;
    body: string;
    category?: string | null;
    tags?: string[];
    scriptureReference: string | null;
    scriptureText: string | null;
    scriptureHref: string | null;
  } | null) {
    if (!next) {
      setPrompts((prev) => ({ ...prev, S: null }));
      setSupplicationFocus(null);
      return;
    }

    const tags = next.tags ?? (next.category ? [next.category] : []);

    setPrompts((prev) => ({
      ...prev,
      S: {
        id: next.id,
        title: next.title,
        body: next.body,
        scriptureReference: next.scriptureReference,
        scriptureText: next.scriptureText,
        scriptureHref: next.scriptureHref,
        tags
      }
    }));

    if (next.kind === "request") {
      setSupplicationFocus({
        kind: "request",
        id: next.id,
        title: next.title,
        body: next.body,
        category: next.category ?? null,
        tags
      });
      // Prayer sessions only link campaign prompts.
      setTimerPromptId(undefined);
    } else {
      setSupplicationFocus({
        kind: "prompt",
        id: next.id,
        title: next.title,
        body: next.body,
        category: next.category ?? null,
        tags,
        scriptureReference: next.scriptureReference,
        scriptureText: next.scriptureText,
        scriptureHref: next.scriptureHref
      });
      setTimerPromptId(next.id);
    }
    // After a weighted reload, allow refresh again.
    setLockS(false);
  }

  async function handlePrayedForThis() {
    const currentS = prompts.S;
    if (!currentS || isMarkingPrayed || !canSaveSessions) {
      return;
    }

    setIsMarkingPrayed(true);
    try {
      const markKind = supplicationFocus?.kind ?? "prompt";
      const markId = supplicationFocus?.id ?? currentS.id;
      const result = await markFocusPrayedAction({ kind: markKind, id: markId });
      if (result.error) {
        window.alert(result.error);
        return;
      }
      setLockS(false);

      const next = await refreshStepPromptAction("S", currentS.id, { includeRequests });
      applySupplication(next);
      setActive(3);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not record that prayer.");
    } finally {
      setIsMarkingPrayed(false);
    }
  }

  // Soft cap: auto-pause when elapsed hits the current session limit.
  useEffect(() => {
    if (!sessionActive || !isRunning || leaveDialogOpen || capDialogOpen) {
      return;
    }
    if (elapsedSeconds >= sessionLimitSeconds) {
      setIsRunning(false);
      setCapDialogOpen(true);
      setPausedByTab(false);
    }
  }, [elapsedSeconds, sessionActive, isRunning, sessionLimitSeconds, leaveDialogOpen, capDialogOpen]);

  // Pause while the tab/app is in the background so time doesn't accumulate unnoticed.
  useEffect(() => {
    if (!sessionActive) {
      return;
    }

    function onVisibilityChange() {
      if (document.hidden && isRunningRef.current) {
        setIsRunning(false);
        setPausedByTab(true);
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [sessionActive]);

  // Browser tab close / refresh.
  useEffect(() => {
    if (!sessionActive) {
      return;
    }

    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (allowNavRef.current || elapsedRef.current <= 0) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [sessionActive]);

  // In-app link clicks (nav, bottom bar, etc.).
  useEffect(() => {
    if (!sessionActive) {
      return;
    }

    function onDocumentClick(event: MouseEvent) {
      if (allowNavRef.current || elapsedRef.current <= 0) {
        return;
      }
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      // Same-page hash only.
      try {
        const url = new URL(href, window.location.href);
        if (url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search) {
          return;
        }
      } catch {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      pendingHrefRef.current = href;
      setIsRunning(false);
      setCapDialogOpen(false);
      setLeaveDialogOpen(true);
    }

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [sessionActive]);

  async function handleRefresh() {
    // Deep-linked focus stays until "I prayed for this"; other S reloads use weighted mix.
    if (lockS && letter === "S") {
      return;
    }
    if (refreshingLetter) {
      return;
    }

    const excludeId = prompts[letter]?.id ?? null;
    setRefreshingLetter(letter);
    try {
      const next = await refreshStepPromptAction(
        letter,
        excludeId,
        letter === "S"
          ? { includeRequests }
          : {
              focusKind: supplicationFocus?.kind ?? null,
              focusId: supplicationFocus?.id ?? null,
              preferredTagNames: supplicationFocus?.tags ?? null,
              preferredCategory: supplicationFocus?.category ?? null
            }
      );
      if (letter === "S") {
        applySupplication(next);
      } else if (next) {
        setPrompts((prev) => ({ ...prev, [letter]: next }));
      }
    } finally {
      setRefreshingLetter(null);
    }
  }

  return (
    <div className="space-y-6">
      {!sessionActive ? (
        <header className="plc-panel overflow-hidden p-6 text-center sm:p-8">
          <div className="mx-auto max-w-2xl space-y-4">
            <p className="plc-eyebrow">PRAY</p>
            <h1 className="brush-small text-5xl uppercase leading-none text-white sm:text-7xl">
              Start praying.
            </h1>
            <p className="plc-copy mx-auto max-w-xl">
              {supplicationFocus
                ? `Your optional guide is ready for: ${supplicationFocus.title}.`
                : includeRequests
                  ? "Start the timer first. If you want a little structure, the optional guide is below."
                  : "Guest prayer counts toward the church total. Sign in when you want personal history and pledges."}
            </p>
            <button
              type="button"
              onClick={startSession}
              className="inline-flex w-full max-w-sm items-center justify-center rounded-2xl bg-yellow px-8 py-6 text-2xl font-black uppercase text-black shadow-[0_18px_45px_rgba(255,211,0,0.28)] transition hover:-translate-y-0.5 sm:text-3xl"
            >
              Start Prayer
            </button>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">
              Guided prayer is optional
            </p>
          </div>
        </header>
      ) : (
        <div className="space-y-2">
          <SessionTimerBar
            promptId={timerPromptId}
            elapsedSeconds={elapsedSeconds}
            isRunning={isRunning}
            notes={notes}
            startedAt={startedAt}
            onNotesChange={setNotes}
            onPause={() => {
              setPausedByTab(false);
              setIsRunning(false);
            }}
            onResume={resumeSession}
            onReset={resetSessionTimer}
            onEnd={requestEndSession}
            onSave={saveSession}
            saving={isSaving}
          />
          {pausedByTab && !isRunning && !capDialogOpen ? (
            <p className="text-center text-xs font-black uppercase tracking-[0.14em] text-yellow/80">
              Paused while you were away — tap Resume when ready
            </p>
          ) : null}
        </div>
      )}

      <section className="plc-panel p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="plc-eyebrow">Optional guide</p>
            <h2 className="text-2xl font-black uppercase text-white">Use ACTS if it helps.</h2>
            <p className="plc-copy max-w-xl">
              You can simply pray with the timer, or open this guide for Adoration, Confession, Thanksgiving, and
              Supplication prompts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setGuideOpen((value) => !value)}
            className="plc-button-secondary"
            aria-expanded={guideOpen}
          >
            {guideOpen ? "Hide guide" : "Open guide"}
          </button>
        </div>

        {guideOpen ? (
          <div className="mt-6">
            <ActsStepContent
              active={active}
              setActive={setActive}
              prompts={prompts}
              refreshingLetter={refreshingLetter}
              onRefresh={() => {
                void handleRefresh();
              }}
              lockSupplication={lockS}
              supplicationKind={supplicationFocus?.kind ?? null}
              onPrayedForThis={
                canSaveSessions
                  ? () => {
                      void handlePrayedForThis();
                    }
                  : undefined
              }
              isMarkingPrayed={isMarkingPrayed}
              showTags={showActsTags}
            />
          </div>
        ) : null}
      </section>

      {!sessionActive && manualEntry ? (
        <ManualEntry
          promptId={timerPromptId}
          defaultMinutes={manualEntry.defaultMinutes}
          today={manualEntry.today}
        />
      ) : null}

      {leaveDialogOpen && hasUnsavedTime ? (
        <SaveLeaveDialog
          elapsedSeconds={elapsedSeconds}
          leaving={Boolean(pendingHrefRef.current)}
          isSaving={isSaving}
          onSave={saveSession}
          onDiscard={discardAndLeave}
          onKeep={keepPraying}
        />
      ) : null}

      {capDialogOpen && sessionActive && !leaveDialogOpen ? (
        <SoftCapDialog
          elapsedSeconds={elapsedSeconds}
          extensionMinutes={SESSION_EXTENSION_MINUTES}
          isSaving={isSaving}
          onContinue={extendSessionCap}
          onSave={saveSession}
          onEnd={endWithoutSavingFromCap}
        />
      ) : null}
    </div>
  );
}
