"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClockIcon, PersonIcon, PromptIcon, RefreshIcon, RequestIcon } from "@/app/components/icons";
import { ScriptureReference } from "@/app/components/scripture-reference";
import { AccessibleDialog } from "@/app/components/accessible-dialog";
import type { SessionFocus } from "@/lib/pray-links";
import { savePrayerSessionAction, refreshStepPromptAction } from "./actions";
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
    focus: "Praise God for who He is",
    fallbackPrompt: "Praise God for His character—His love, power, faithfulness, and presence with you right now."
  },
  {
    letter: "C" as const,
    name: "Confession",
    focus: "Confess honestly before God",
    fallbackPrompt: "Bring anything that weighs on you. Receive His forgiveness without shame—grace meets you here."
  },
  {
    letter: "T" as const,
    name: "Thanksgiving",
    focus: "Give thanks for His gifts",
    fallbackPrompt: "Thank God for specific people, mercies, and answered prayers. Gratitude softens the heart."
  },
  {
    letter: "S" as const,
    name: "Supplication",
    focus: "Ask God and pray for others",
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

function personalFocusBody(label: string, members: string[] = []) {
  if (label === "My Four Friends" || label === "My Friends") {
    return members.length > 0
      ? `Pray intentionally for each friend to know Jesus and receive salvation:\n${members.join("\n")}`
      : "Pray intentionally for your four friends to know Jesus and receive salvation.";
  }
  return members.length > 0
    ? `Pray for everyone in ${label}:\n${members.join("\n")}`
    : `Pray for ${label}. Ask God to guide, strengthen, protect, and meet every need.`;
}

/** Minutes added each time someone continues past the soft session cap. */
const SESSION_EXTENSION_MINUTES = 30;
const DEFAULT_MAX_SESSION_MINUTES = 60;
const LEGACY_TIMER_STORAGE_KEY = "plc-active-prayer-timer-v1";
const TIMER_STORAGE_KEY = "plc-active-prayer-timer-v2";

type StoredTimer = {
  sessionId?: string;
  elapsedSeconds: number;
  persistedAt: number;
  startedAt: string;
  isRunning: boolean;
  sessionLimitSeconds: number;
  notes?: string;
  promptId?: string | null;
  focus?: SessionFocus | null;
  focusLabel?: string | null;
  focusMembers?: string[];
};

function SaveLeaveDialog({
  elapsedSeconds,
  leaving,
  isSaving,
  savesToHistory,
  onSave,
  onDiscard,
  onKeep
}: {
  elapsedSeconds: number;
  leaving: boolean;
  isSaving: boolean;
  savesToHistory: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onKeep: () => void;
}) {
  return (
    <AccessibleDialog titleId="save-session-title" descriptionId="save-session-description" onEscape={onKeep}>
      <div className="plc-panel w-full max-w-md p-6 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
        <p className="plc-eyebrow">You have unsaved prayer time</p>
        <h2 id="save-session-title" className="mt-2 text-2xl font-black uppercase text-white">
          {formatElapsed(elapsedSeconds)} unsaved
        </h2>
        <p id="save-session-description" className="plc-copy mt-3">
          {leaving
            ? "You’re leaving with unsaved prayer time. Save it first, or leave without recording these minutes."
            : savesToHistory
              ? "Save this time to add these minutes to your prayer history, or finish without saving."
              : "Record this guest prayer time, or finish without recording it. Guest prayer does not create personal history."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={onSave} disabled={isSaving} className="plc-button disabled:opacity-60">
            {isSaving ? "Saving…" : savesToHistory ? "Save prayer time" : "Record prayer time"}
          </button>
          <button type="button" onClick={onDiscard} className="plc-button-secondary">
             {leaving ? "Leave without saving" : "Finish without saving"}
          </button>
          <button type="button" onClick={onKeep} className="plc-button-secondary" autoFocus>
            Keep praying
          </button>
        </div>
      </div>
    </AccessibleDialog>
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
    <AccessibleDialog titleId="soft-cap-title" descriptionId="soft-cap-description">
      <div className="plc-panel w-full max-w-md p-6 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
        <p className="plc-eyebrow">Session check-in</p>
        <h2 id="soft-cap-title" className="mt-2 text-2xl font-black uppercase text-white">
          {formatElapsed(elapsedSeconds)} so far
        </h2>
        <p id="soft-cap-description" className="plc-copy mt-3">
          The timer paused after {formatElapsed(elapsedSeconds)} so it does not keep running by accident. You can add
          another {extensionMinutes} minutes, save the time already recorded, or finish without saving.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={onContinue} className="plc-button" autoFocus>
            Continue for {extensionMinutes} more minutes
          </button>
          <button type="button" onClick={onSave} disabled={isSaving} className="plc-button-secondary disabled:opacity-60">
            {isSaving ? "Saving…" : "Save prayer time"}
          </button>
          <button type="button" onClick={onEnd} className="plc-button-secondary">
            Finish without saving
          </button>
        </div>
      </div>
    </AccessibleDialog>
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
            <span className="mt-1 block text-sm font-black leading-tight">{step.name}</span>
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
  showTags = false
}: {
  active: number;
  setActive: (index: number) => void;
  prompts: PromptMap;
  refreshingLetter: StepLetter | null;
  onRefresh: () => void;
  lockSupplication: boolean;
  supplicationKind?: "request" | "prompt" | null;
  showTags?: boolean;
}) {
  const current = defaultSteps[active];
  const letter = current.letter;
  const stepContent = prompts[letter] ?? null;
  const isRefreshing = refreshingLetter === letter;
  const canRefresh = !(lockSupplication && letter === "S");

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
                disabled={isRefreshing}
                title="Load another prompt"
                aria-label={`Load another ${current.name} prompt`}
                className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full border border-paper/15 bg-surface text-yellow transition hover:border-yellow/60 hover:bg-surface-raised disabled:cursor-wait disabled:opacity-60 sm:right-5 sm:top-5"
              >
                <RefreshIcon
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
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

          <p className="plc-reading mt-5 whitespace-pre-line text-base leading-relaxed sm:mt-6 sm:text-lg sm:leading-8">
            {stepContent.body}
          </p>

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
              className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full border border-paper/15 bg-surface text-yellow transition hover:border-yellow/60 hover:bg-surface-raised disabled:cursor-wait disabled:opacity-60 sm:right-5 sm:top-5"
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
  mode = "simple",
  guidedPrayerHref = "/guided-prayer?autostart=1",
  autoStart = false,
  promptId,
  actsPrompts,
  supplicationPrompt,
  focus = null,
  lockInitialFocus = false,
  includeRequests = true,
  canSaveSessions = true,
  showFocusBanner = Boolean(focus),
  personalFocus,
  maxSessionMinutes = DEFAULT_MAX_SESSION_MINUTES,
  showActsTags = false,
  timerStorageOwner = "guest"
}: {
  mode?: "simple" | "guided";
  guidedPrayerHref?: string;
  autoStart?: boolean;
  promptId?: string;
  actsPrompts?: {
    A?: StepPrompt | null;
    C?: StepPrompt | null;
    T?: StepPrompt | null;
  };
  supplicationPrompt?: StepPrompt | null;
  /** Current S focus (request or prompt) for labeling + prayer counts. */
  focus?: SessionFocus | null;
  /** When true (deep link from board/prompts), block S refresh until prayer starts. */
  lockInitialFocus?: boolean;
  /** Members: include community requests in S refresh. Guests: prompts only. */
  includeRequests?: boolean;
  /**
   * When false, focus prayer counts are not recorded. Eligible guest sessions count toward the campaign total.
   */
  canSaveSessions?: boolean;
  /** Show the selected-focus banner only when the user arrived from a prompt or request. */
  showFocusBanner?: boolean;
  /** A person or group selected from the profile. */
  personalFocus?: { kind: "person" | "group"; label: string; members?: string[] };
  /** Soft auto-pause cap for the PRAY timer (from campaign settings). */
  maxSessionMinutes?: number;
  /** Campaign setting: show shared tags on step cards. */
  showActsTags?: boolean;
  /** Keeps a restored timer from crossing between accounts on a shared device. */
  timerStorageOwner?: string;
}) {
  const router = useRouter();
  const capSeconds = Math.max(1, Math.round(maxSessionMinutes)) * 60;
  const timerStorageKey = `${TIMER_STORAGE_KEY}:${timerStorageOwner}`;
  const personalStepPrompt: StepPrompt | null = personalFocus
    ? {
        id: "personal-focus",
        title: personalFocus.label,
        body: personalFocusBody(personalFocus.label, personalFocus.members),
        scriptureReference: null,
        scriptureText: null,
        scriptureHref: null,
        tags: []
      }
    : null;
  const [supplicationFocus, setSupplicationFocus] = useState<SessionFocus | null>(focus);
  const [lockS, setLockS] = useState(Boolean(lockInitialFocus && focus));
  const [sessionActive, setSessionActive] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [notes, setNotes] = useState("");
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionFocus, setSessionFocus] = useState<SessionFocus | null>(null);
  const [sessionFocusLabel, setSessionFocusLabel] = useState<string | null>(null);
  const [sessionFocusMembers, setSessionFocusMembers] = useState<string[]>([]);
  // Always land on Adoration; focus still loads into Supplication for when they advance.
  const [active, setActive] = useState(0);
  const [prompts, setPrompts] = useState<PromptMap>({
    A: actsPrompts?.A ?? null,
    C: actsPrompts?.C ?? null,
    T: actsPrompts?.T ?? null,
    S: focus ? focusToStepPrompt(focus) : (personalStepPrompt ?? supplicationPrompt ?? null)
  });
  const [timerPromptId, setTimerPromptId] = useState(
    personalFocus ? undefined : (focus?.kind === "prompt" ? focus.id : promptId)
  );
  const [refreshingLetter, setRefreshingLetter] = useState<StepLetter | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [capDialogOpen, setCapDialogOpen] = useState(false);
  const [sessionLimitSeconds, setSessionLimitSeconds] = useState(capSeconds);
  const [clockHydrated, setClockHydrated] = useState(false);
  const [isSaving, startSaveTransition] = useTransition();
  const [saveMessage, setSaveMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [focusChooserOpen, setFocusChooserOpen] = useState(!showFocusBanner);
  const { elapsedSeconds, resetElapsed, restoreElapsed } = useSessionClock(
    sessionActive,
    isRunning,
    sessionLimitSeconds
  );
  const elapsedRef = useRef(0);
  const pendingHrefRef = useRef<string | null>(null);
  const allowNavRef = useRef(false);
  const saveStartedRef = useRef(false);
  const autoStartedRef = useRef(false);
  const startSessionRef = useRef<() => void>(() => undefined);

  const removeStoredTimer = useCallback(() => {
    try {
      window.localStorage.removeItem(timerStorageKey);
      window.localStorage.removeItem(LEGACY_TIMER_STORAGE_KEY);
    } catch {
      // Storage can be blocked in private browsing; the in-memory timer still works.
    }
  }, [timerStorageKey]);

  useEffect(() => {
    elapsedRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  const letter = defaultSteps[active].letter;
  const hasUnsavedTime = sessionActive && elapsedSeconds > 0;

  function startSession() {
    const now = new Date();
    const nextSessionId = window.crypto.randomUUID();
    setSessionActive(true);
    setIsRunning(true);
    setStartedAt(now);
    setSessionId(nextSessionId);
    setSessionFocus(supplicationFocus);
    setSessionFocusLabel(personalFocus?.label ?? (supplicationFocus?.kind === "request" ? supplicationFocus.title : null));
    setSessionFocusMembers(personalFocus?.members ?? []);
    saveStartedRef.current = false;
    allowNavRef.current = false;
    setSaveMessage(null);
    resetElapsed();
    setNotes("");
    setLeaveDialogOpen(false);
    setCapDialogOpen(false);
    setSessionLimitSeconds(capSeconds);
    pendingHrefRef.current = null;
    // Begin the session on Adoration; S already holds the loaded focus.
    setActive(0);
    setLockS(Boolean(lockInitialFocus || personalFocus));
  }
  startSessionRef.current = startSession;

  function clearSession() {
    removeStoredTimer();
    setLeaveDialogOpen(false);
    setCapDialogOpen(false);
    setSessionActive(false);
    setIsRunning(false);
    setStartedAt(null);
    setSessionId(null);
    setSessionFocus(null);
    setSessionFocusLabel(null);
    setSessionFocusMembers([]);
    setTimerPromptId(personalFocus ? undefined : (supplicationFocus?.kind === "prompt" ? supplicationFocus.id : undefined));
    saveStartedRef.current = false;
    resetElapsed();
    setNotes("");
    setSessionLimitSeconds(capSeconds);
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
    if (elapsedSeconds <= 0 || !sessionId || saveStartedRef.current) {
      return;
    }

    saveStartedRef.current = true;
    setSaveMessage(null);
    setIsRunning(false);

    const formData = buildTimerSessionFormData({
      clientSessionId: sessionId,
      elapsedSeconds,
      notes,
      startedAt,
      promptId: timerPromptId,
      requestId: sessionFocus?.kind === "request" ? sessionFocus.id : null,
      focusLabel: sessionFocusLabel
    });

    startSaveTransition(() => {
      void (async () => {
        let result: Awaited<ReturnType<typeof savePrayerSessionAction>>;
        try {
          result = await savePrayerSessionAction(formData);
        } catch {
          result = { ok: false, error: "The network connection was interrupted." };
        }
        if (!result.ok) {
          saveStartedRef.current = false;
          allowNavRef.current = false;
          setLeaveDialogOpen(false);
          setCapDialogOpen(false);
          setSaveMessage({ kind: "error", text: `${result.error} Your prayer time is still here. Try saving again.` });
          return;
        }

        const href = pendingHrefRef.current;
        allowNavRef.current = true;
        clearSession();
        setSaveMessage({
          kind: "success",
          text: result.signedIn
            ? `${result.minutes} prayer ${result.minutes === 1 ? "minute" : "minutes"} saved to your history.`
            : `${result.minutes} guest prayer ${result.minutes === 1 ? "minute" : "minutes"} recorded.`
        });
        if (href) {
          router.push(href);
        } else {
          allowNavRef.current = false;
        }
      })();
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
    if ((elapsedRef.current > 0 || notes.trim()) && !window.confirm(`Discard ${formatElapsed(elapsedRef.current)} of unsaved prayer time and start over?`)) {
      return;
    }
    removeStoredTimer();
    setIsRunning(false);
    setStartedAt(null);
    setSessionId(null);
    setSessionFocus(null);
    setSessionFocusLabel(null);
    setSessionFocusMembers([]);
    setTimerPromptId(personalFocus ? undefined : (supplicationFocus?.kind === "prompt" ? supplicationFocus.id : undefined));
    saveStartedRef.current = false;
    resetElapsed();
    setNotes("");
    setSessionLimitSeconds(capSeconds);
    setCapDialogOpen(false);
  }

  function resumeSession() {
    if (!sessionId) {
      setSessionId(window.crypto.randomUUID());
      setSessionFocus(supplicationFocus);
      setSessionFocusLabel(personalFocus?.label ?? (supplicationFocus?.kind === "request" ? supplicationFocus.title : null));
      setSessionFocusMembers(personalFocus?.members ?? []);
      saveStartedRef.current = false;
    }
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
      if (!sessionId) setTimerPromptId(undefined);
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
      if (!sessionId) setTimerPromptId(next.id);
    }
    // After a weighted reload, allow refresh again.
    setLockS(false);
  }

  // Soft cap: auto-pause when elapsed hits the current session limit.
  useEffect(() => {
    if (!sessionActive || !isRunning || leaveDialogOpen || capDialogOpen) {
      return;
    }
    if (elapsedSeconds >= sessionLimitSeconds) {
      setIsRunning(false);
      setCapDialogOpen(true);
    }
  }, [elapsedSeconds, sessionActive, isRunning, sessionLimitSeconds, leaveDialogOpen, capDialogOpen]);

  // Restore an interrupted timer. Background time counts, but never beyond the saved cap.
  useEffect(() => {
    try {
      const current = window.localStorage.getItem(timerStorageKey);
      const legacy = current ? null : window.localStorage.getItem(LEGACY_TIMER_STORAGE_KEY);
      const raw = current ?? legacy;
      if (raw) {
        const stored = JSON.parse(raw) as Partial<StoredTimer>;
        const savedElapsed = Number(stored.elapsedSeconds);
        const savedAt = Number(stored.persistedAt);
        const savedLimit = Number(stored.sessionLimitSeconds);
        const limit = Number.isFinite(savedLimit) && savedLimit > 0 ? savedLimit : capSeconds;
        const backgroundSeconds = stored.isRunning && Number.isFinite(savedAt)
          ? Math.max(0, Math.floor((Date.now() - savedAt) / 1000))
          : 0;
        const restored = Math.min(limit, Math.max(0, savedElapsed || 0) + backgroundSeconds);
        if (stored.startedAt && (restored > 0 || stored.isRunning)) {
          const restoredStart = new Date(stored.startedAt);
          const restoredSessionId = stored.sessionId || window.crypto.randomUUID();
          setSessionLimitSeconds(limit);
          setSessionActive(true);
          setStartedAt(Number.isNaN(restoredStart.getTime()) ? new Date(Date.now() - restored * 1000) : restoredStart);
          setSessionId(restoredSessionId);
          setNotes(typeof stored.notes === "string" ? stored.notes : "");
          setTimerPromptId(typeof stored.promptId === "string" ? stored.promptId : undefined);
          setSessionFocus(stored.focus ?? null);
          setSessionFocusLabel(typeof stored.focusLabel === "string" ? stored.focusLabel : null);
          const restoredMembers = Array.isArray(stored.focusMembers)
            ? stored.focusMembers.filter((name): name is string => typeof name === "string")
            : [];
          setSessionFocusMembers(restoredMembers);
          if (stored.focus) {
            setSupplicationFocus(stored.focus);
            setPrompts((previous) => ({ ...previous, S: focusToStepPrompt(stored.focus as SessionFocus) }));
          } else if (stored.focusLabel) {
            setPrompts((previous) => ({
              ...previous,
              S: {
                id: "personal-focus",
                title: stored.focusLabel as string,
                body: personalFocusBody(stored.focusLabel as string, restoredMembers),
                scriptureReference: null,
                scriptureText: null,
                scriptureHref: null,
                tags: []
              }
            }));
          }
          restoreElapsed(restored);
          if (restored >= limit) {
            setIsRunning(false);
            setCapDialogOpen(true);
          } else {
            setIsRunning(Boolean(stored.isRunning));
          }
          if (legacy) {
            window.localStorage.removeItem(LEGACY_TIMER_STORAGE_KEY);
          }
        }
      }
    } catch {
      removeStoredTimer();
    } finally {
      setClockHydrated(true);
    }
  }, [capSeconds, removeStoredTimer, restoreElapsed, timerStorageKey]);

  // Guided prayer starts with one tap from the simple prayer page, but never
  // overwrites a timer restored from storage.
  useEffect(() => {
    if (mode !== "guided" || !autoStart || !clockHydrated || sessionActive || autoStartedRef.current) return;
    autoStartedRef.current = true;
    startSessionRef.current();
  }, [autoStart, clockHydrated, mode, sessionActive]);

  // Persist enough clock state to recover from browser suspension, refresh, or app eviction.
  useEffect(() => {
    if (!clockHydrated) return;
    if (!sessionActive || !startedAt || !sessionId) {
      removeStoredTimer();
      return;
    }
    const stored: StoredTimer = {
      sessionId,
      elapsedSeconds,
      persistedAt: Date.now(),
      startedAt: startedAt.toISOString(),
      isRunning,
      sessionLimitSeconds,
      notes,
      promptId: timerPromptId ?? null,
      focus: sessionFocus,
      focusLabel: sessionFocusLabel,
      focusMembers: sessionFocusMembers
    };
    try {
      window.localStorage.setItem(timerStorageKey, JSON.stringify(stored));
    } catch {
      // The timestamp-based in-memory clock remains accurate while the page is alive.
    }
  }, [clockHydrated, elapsedSeconds, isRunning, notes, removeStoredTimer, sessionActive, sessionFocus, sessionFocusLabel, sessionFocusMembers, sessionId, sessionLimitSeconds, startedAt, timerPromptId, timerStorageKey]);

  // Persist at the mobile lifecycle boundary before the browser freezes or evicts the page.
  useEffect(() => {
    if (!clockHydrated || !sessionActive || !startedAt || !sessionId) return;

    function persistBeforeSleep() {
      const stored: StoredTimer = {
        sessionId: sessionId as string,
        elapsedSeconds,
        persistedAt: Date.now(),
        startedAt: (startedAt as Date).toISOString(),
        isRunning,
        sessionLimitSeconds,
        notes,
        promptId: timerPromptId ?? null,
        focus: sessionFocus,
        focusLabel: sessionFocusLabel,
        focusMembers: sessionFocusMembers
      };
      try {
        window.localStorage.setItem(timerStorageKey, JSON.stringify(stored));
      } catch {
        // Best effort only; some privacy modes disable storage.
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") persistBeforeSleep();
    }

    window.addEventListener("pagehide", persistBeforeSleep);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", persistBeforeSleep);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [clockHydrated, elapsedSeconds, isRunning, notes, sessionActive, sessionFocus, sessionFocusLabel, sessionFocusMembers, sessionId, sessionLimitSeconds, startedAt, timerPromptId, timerStorageKey]);

  // Best effort only: unsupported browsers still work because elapsed time is timestamp-based.
  useEffect(() => {
    let wakeLock: { released: boolean; release: () => Promise<void> } | null = null;
    let cancelled = false;

    async function requestWakeLock() {
      if (cancelled || !sessionActive || !isRunning || document.visibilityState !== "visible") return;
      if (!("wakeLock" in navigator)) return;
      if (wakeLock && !wakeLock.released) return;
      try {
        const requestedLock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void requestedLock.release();
          return;
        }
        wakeLock = requestedLock;
      } catch {
        wakeLock = null;
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible" && (!wakeLock || wakeLock.released)) void requestWakeLock();
    }

    void requestWakeLock();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (wakeLock && !wakeLock.released) void wakeLock.release();
    };
  }, [isRunning, sessionActive]);

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
    // Deep-linked focus stays until prayer starts; other S reloads use weighted mix.
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

  const visibleFocus = sessionActive ? sessionFocus : supplicationFocus;
  const visibleFocusMembers = sessionActive ? sessionFocusMembers : (personalFocus?.members ?? []);
  const visiblePersonalFocusLabel = sessionActive ? sessionFocusLabel : personalFocus?.label;
  const hasChosenFocus = showFocusBanner || Boolean(personalFocus);
  const showFocusChooser = mode === "simple" && !sessionActive && (!hasChosenFocus || focusChooserOpen);

  return (
    <div className="space-y-6">
      {saveMessage ? (
        <p
          className={`rounded-xl border px-4 py-3 text-base ${saveMessage.kind === "error" ? "border-red-400/50 bg-red-950/40 text-red-100" : "border-yellow/40 bg-yellow/10 text-yellow"}`}
          role={saveMessage.kind === "error" ? "alert" : "status"}
        >
          {saveMessage.text}
        </p>
      ) : null}
      {!sessionActive && mode === "simple" ? (
        <header className="plc-panel overflow-hidden p-5 text-center sm:p-6">
          <div className="mx-auto max-w-2xl space-y-4">
            <p className="plc-eyebrow">PRAY</p>
            <h1 className="brush-small text-4xl uppercase leading-none text-white sm:text-6xl">
              Start praying.
            </h1>
            <p className="mx-auto max-w-md text-sm text-white/75">
              Pray on your own or with a guide. Both start a timer. Screen-off time counts — save when you finish.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={startSession}
                className="plc-button min-h-14 w-full items-center gap-2"
              >
                <ClockIcon className="h-5 w-5" />
                Pray on your own
              </button>
              <Link
                href={guidedPrayerHref}
                className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full border border-yellow/70 px-5 py-3 text-sm font-black uppercase text-yellow transition hover:border-yellow hover:bg-yellow/10"
              >
                <PromptIcon className="h-5 w-5" />
                Start guided prayer
              </Link>
            </div>
            <Link href="/add-time?entry=1" className="plc-button-secondary min-h-14 w-full items-center gap-2">
              Log completed prayer
            </Link>
          </div>
        </header>
      ) : !sessionActive ? (
        <header className="plc-panel p-5 text-center sm:p-6">
          <p className="plc-eyebrow">Guided prayer</p>
          <h1 className="mt-2 text-3xl font-black text-white">Pray with ACTS</h1>
          <p className="mt-2 text-base text-white/75">Begin on Adoration and move through each step at your own pace.</p>
          <button type="button" onClick={startSession} className="plc-button mt-4">Start guided prayer</button>
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
            onPause={() => setIsRunning(false)}
            onResume={resumeSession}
            onReset={resetSessionTimer}
            onEnd={requestEndSession}
            onSave={saveSession}
            saving={isSaving}
            requestId={sessionFocus?.kind === "request" ? sessionFocus.id : undefined}
            focusLabel={sessionFocusLabel ?? undefined}
              saveLabel={canSaveSessions ? "Save prayer time" : "Record prayer time"}
             canSaveNotes={canSaveSessions}
          />
          <p className="text-center text-sm text-white/65">
            The timer keeps counting if your screen sleeps and pauses automatically at the session limit.
          </p>
        </div>
      )}

      {mode === "simple" && showFocusBanner && visibleFocus ? (
        <article className="plc-panel border border-yellow/30 p-5 sm:p-6">
          <p className="plc-eyebrow">Your prayer focus</p>
          <h2 className="mt-2 text-2xl font-black text-white">
            {visibleFocus.title}
          </h2>
          {visibleFocus.body ? (
            <p className="plc-reading mt-3 text-base leading-7">
              {visibleFocus.body}
            </p>
          ) : null}
        </article>
      ) : mode === "simple" && visiblePersonalFocusLabel && (showFocusBanner || sessionActive) ? (
        <article className="plc-panel border border-yellow/30 p-5 sm:p-6">
          <p className="plc-eyebrow">Your prayer focus</p>
          <h2 className="mt-2 text-2xl font-black text-white">{visiblePersonalFocusLabel}</h2>
          {visibleFocusMembers.length > 0 ? (
            <div className="mt-4 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-black/25 p-3">
              <ul className="space-y-2">
                {visibleFocusMembers.map((name) => (
                  <li key={name} className="rounded-lg bg-white/5 px-3 py-2 font-black text-white">{name}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      ) : null}

      {showFocusChooser ? (
      <section id="prayer-focus-options" className="scroll-mt-24 space-y-3" aria-labelledby="choose-prayer-focus-title">
        <div className="pb-1">
          <p className="plc-eyebrow">Optional</p>
          <h2 id="choose-prayer-focus-title" className="mt-1 text-2xl font-black text-white">Choose a prayer focus</h2>
        </div>

        <Link href="/prompts" className="plc-panel flex min-h-24 items-center gap-4 p-5 transition hover:border-yellow/50 sm:p-6">
          <PromptIcon className="h-9 w-9 shrink-0 text-yellow" />
          <span className="min-w-0 flex-1">
            <span className="block text-xl font-black text-white">Browse a prayer idea</span>
            <span className="mt-1 block text-base text-white/75">Find guidance by topic</span>
          </span>
          <span className="text-2xl text-yellow" aria-hidden="true">›</span>
        </Link>

        <Link href="/people" className="plc-panel flex min-h-24 items-center gap-4 p-5 transition hover:border-yellow/50 sm:p-6">
          <PersonIcon className="h-9 w-9 shrink-0 text-yellow" />
          <span className="min-w-0 flex-1">
            <span className="block text-xl font-black text-white">Pray for someone</span>
            <span className="mt-1 block text-base text-white/75">Four friends, household, or church family</span>
          </span>
          <span className="text-2xl text-yellow" aria-hidden="true">›</span>
        </Link>

        <Link href="/requests" className="plc-panel flex min-h-24 items-center gap-4 p-5 transition hover:border-yellow/50 sm:p-6">
          <RequestIcon className="h-9 w-9 shrink-0 text-yellow" />
          <span className="min-w-0 flex-1">
            <span className="block text-xl font-black text-white">Pray for a community need</span>
            <span className="mt-1 block text-base text-white/75">Requests shared by the church</span>
          </span>
          <span className="text-2xl text-yellow" aria-hidden="true">›</span>
        </Link>
      </section>
      ) : mode === "simple" && !sessionActive && hasChosenFocus ? (
        <div className="flex justify-center">
          <button type="button" onClick={() => setFocusChooserOpen(true)} className="plc-button-secondary">
            Choose a different focus
          </button>
        </div>
      ) : null}

      {mode === "guided" ? (
      <section className="plc-panel p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="plc-eyebrow">Guided prayer</p>
            <h2 className="text-2xl font-black uppercase text-white">Follow the ACTS steps</h2>
            <p className="plc-copy max-w-xl">
              ACTS stands for Adoration, Confession, Thanksgiving, and Supplication. Move through the steps in order or
              spend more time wherever it helps.
            </p>
          </div>
        </div>

          <div id="acts-guide-content" className="mt-6">
            <ActsStepContent
              active={active}
              setActive={setActive}
              prompts={prompts}
              refreshingLetter={refreshingLetter}
              onRefresh={() => {
                void handleRefresh();
              }}
              lockSupplication={lockS || Boolean(personalFocus)}
              supplicationKind={supplicationFocus?.kind ?? null}
              showTags={showActsTags}
            />
          </div>
      </section>
      ) : null}

      {leaveDialogOpen && hasUnsavedTime ? (
         <SaveLeaveDialog
          elapsedSeconds={elapsedSeconds}
          leaving={Boolean(pendingHrefRef.current)}
           isSaving={isSaving}
           savesToHistory={canSaveSessions}
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
