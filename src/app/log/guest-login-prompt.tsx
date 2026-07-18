"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "plc_guest_pray_login_prompt_dismissed";

/**
 * Reminds guests on the PRAY page that signing in attaches minutes to their account.
 * Shown once per browser tab session after dismiss (sessionStorage).
 */
export function GuestLoginPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") {
        return;
      }
    } catch {
      // sessionStorage may be unavailable; still show once this mount.
    }
    setOpen(true);
  }, []);

  function dismiss() {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-login-prompt-title"
    >
      <div className="plc-panel w-full max-w-md p-6 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
        <p className="plc-eyebrow">Save your prayer time</p>
        <h2 id="guest-login-prompt-title" className="mt-2 text-2xl font-black uppercase text-white">
          Sign in to record minutes to your account
        </h2>
        <p className="plc-copy mt-3">
          You can pray as a guest — minutes still count toward the church total. Sign in so this session is saved
          to your personal history, pledge progress, and profile.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/auth?next=/log" className="plc-button" onClick={dismiss}>
            Sign in
          </Link>
          <button type="button" onClick={dismiss} className="plc-button-secondary">
            Continue as guest
          </button>
        </div>
      </div>
    </div>
  );
}
