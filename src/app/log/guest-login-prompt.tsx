"use client";

import Link from "next/link";

/**
 * Reminds guests on the PRAY page that signing in attaches minutes to their account.
 * Shown once per browser tab session after dismiss (sessionStorage).
 */
export function GuestLoginPrompt() {
  return (
    <aside className="mx-auto mb-6 max-w-3xl rounded-2xl border border-yellow/30 bg-yellow/10 p-5" aria-label="Guest prayer information">
      <p className="font-black text-yellow">Praying as a guest</p>
      <p className="mt-2 text-base leading-7 text-white/80">
        Eligible prayer counts toward the church campaign. Sign in first if you want personal history or private notes.
      </p>
      <Link href="/auth?next=/log" className="plc-button-secondary mt-4">
        Sign in
      </Link>
    </aside>
  );
}
