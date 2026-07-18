"use client";

import Link from "next/link";
import { prayHref, prayerCountLabel, type SessionFocus } from "@/lib/pray-links";

export { prayerCountLabel, type SessionFocus };

export function PrayButton({
  focus,
  signedIn,
  prayerCount = 0,
  className = "plc-button"
}: {
  focus: SessionFocus;
  signedIn: boolean;
  prayerCount?: number;
  className?: string;
}) {
  if (!signedIn) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/auth" className="plc-button-secondary">
          Sign in to pray
        </Link>
        <span className="text-xs uppercase tracking-[0.16em] text-white/40">{prayerCountLabel(prayerCount)}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href={prayHref(focus)} className={className}>
        Pray
      </Link>
      <span
        className={`text-xs uppercase tracking-[0.16em] ${
          prayerCount === 0 ? "text-yellow/70" : "text-white/40"
        }`}
      >
        {prayerCount === 0 ? "Be the first to pray" : prayerCountLabel(prayerCount)}
      </span>
    </div>
  );
}
