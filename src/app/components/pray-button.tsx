"use client";

import Link from "next/link";
import { prayHref, prayerCountLabel, type SessionFocus } from "@/lib/pray-links";

export { prayerCountLabel, type SessionFocus };

export function PrayButton({
  focus,
  signedIn,
  prayerCount = 0,
  showPrayerCount = true,
  className = "plc-button"
}: {
  focus: SessionFocus;
  signedIn: boolean;
  prayerCount?: number;
  showPrayerCount?: boolean;
  className?: string;
}) {
  if (!signedIn) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/auth" className="plc-button-secondary">
           Sign in to pray for this
        </Link>
        {showPrayerCount ? (
          <span className="text-xs uppercase tracking-[0.16em] text-white/60">{prayerCountLabel(prayerCount)}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href={prayHref(focus)} className={className}>
         {focus.kind === "request" ? "Pray for this request" : "Pray with this prompt"}
      </Link>
      {showPrayerCount ? (
        <span
          className={`text-xs uppercase tracking-[0.16em] ${
            prayerCount === 0 ? "text-yellow" : "text-white/60"
          }`}
        >
          {prayerCount === 0 ? "Be the first to pray" : prayerCountLabel(prayerCount)}
        </span>
      ) : null}
    </div>
  );
}
