"use client";

import { useEffect } from "react";

const RELOAD_KEY = "plc_chunk_reload_once";

/**
 * After a deploy, clients may still hold an old webpack runtime that requests
 * deleted `/_next/static/chunks/...` files (ChunkLoadError). Reload once to pick
 * up the new build; avoid infinite loops with sessionStorage.
 */
export function ChunkLoadRecovery() {
  useEffect(() => {
    function shouldReload(message: string) {
      return /ChunkLoadError|Loading chunk [\d]+ failed|Failed to fetch dynamically imported module/i.test(
        message
      );
    }

    function reloadOnce() {
      try {
        if (sessionStorage.getItem(RELOAD_KEY) === "1") {
          return;
        }
        sessionStorage.setItem(RELOAD_KEY, "1");
      } catch {
        // sessionStorage blocked — still try one reload
      }
      window.location.reload();
    }

    function onError(event: ErrorEvent) {
      const message = event.message || String(event.error ?? "");
      if (shouldReload(message)) {
        reloadOnce();
      }
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? `${reason.name} ${reason.message}`
          : String(reason ?? "");
      if (shouldReload(message)) {
        reloadOnce();
      }
    }

    // Clear the guard after a successful load so a later deploy can recover again.
    try {
      sessionStorage.removeItem(RELOAD_KEY);
    } catch {
      // ignore
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
