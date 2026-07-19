"use client";

import { useEffect } from "react";

const REFRESH_KEY = "plc_auth_session_last_refresh";
const REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 12;

type AuthSessionRefreshProps = {
  enabled: boolean;
};

export function AuthSessionRefresh({ enabled }: AuthSessionRefreshProps) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    try {
      const lastRefresh = Number(window.localStorage.getItem(REFRESH_KEY) ?? 0);
      if (Date.now() - lastRefresh < REFRESH_INTERVAL_MS) {
        return;
      }
    } catch {
      // If storage is unavailable, still attempt the refresh for signed-in users.
    }

    const controller = new AbortController();

    fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal
    })
      .then(() => {
        try {
          window.localStorage.setItem(REFRESH_KEY, String(Date.now()));
        } catch {
          // Storage may be unavailable in strict privacy modes.
        }
      })
      .catch(() => {
        // Session refresh should never interrupt someone using the app.
      });

    return () => controller.abort();
  }, [enabled]);

  return null;
}
