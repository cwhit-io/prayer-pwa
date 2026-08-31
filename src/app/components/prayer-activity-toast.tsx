"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const POLL_MS = 25_000;
const SHOW_MS = 3_200;
const SEEN_KEY = "plc_seen_prayer_pulse_ids";
const ALLOWED = new Set(["/", "/requests", "/requests/mine", "/add-time", "/auth"]);

type PulseSession = {
  id: string;
  title: string;
};

function pathAllowed(pathname: string) {
  return ALLOWED.has(pathname);
}

function readSeen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed.filter((id) => typeof id === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function writeSeen(ids: Set<string>) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(0, 40)));
  } catch {
    // sessionStorage may be unavailable
  }
}

export function PrayerActivityToast() {
  const pathname = usePathname();
  const [message, setMessage] = useState<string | null>(null);
  const hideTimer = useRef<number | null>(null);
  const enabled = pathAllowed(pathname);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    let seeded = false;

    async function poll() {
      if (document.visibilityState === "hidden") {
        return;
      }
      try {
        const response = await fetch("/api/activity/recent", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { sessions?: PulseSession[] };
        const sessions = data.sessions ?? [];
        if (cancelled || sessions.length === 0) {
          return;
        }

        const seen = readSeen();
        if (!seeded && seen.size === 0) {
          writeSeen(new Set(sessions.map((session) => session.id)));
          seeded = true;
          return;
        }
        seeded = true;

        const fresh = sessions.filter((session) => !seen.has(session.id));
        if (fresh.length === 0) {
          return;
        }

        for (const session of sessions) {
          seen.add(session.id);
        }
        writeSeen(seen);

        const text =
          fresh.length === 1 ? fresh[0].title : `${fresh.length} people just logged prayer`;
        setMessage(text);
        if (hideTimer.current) {
          window.clearTimeout(hideTimer.current);
        }
        hideTimer.current = window.setTimeout(() => {
          setMessage(null);
        }, SHOW_MS);
      } catch {
        // Toast polling should never interrupt the page.
      }
    }

    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      if (hideTimer.current) {
        window.clearTimeout(hideTimer.current);
      }
    };
  }, [enabled]);

  if (!enabled || !message) {
    return null;
  }

  return (
    <div className="prayer-activity-toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}
