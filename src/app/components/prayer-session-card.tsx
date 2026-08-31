import type { PrayerSessionEntry } from "@/lib/campaign";

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function PrayerSessionCard({ session }: { session: PrayerSessionEntry }) {
  const focus = session.focusLabel || session.requestTitle || session.promptTitle;
  return (
    <article className="plc-card-muted px-4 py-4 text-white/75">
      <div className="flex items-center justify-between gap-3">
        <div>
          {focus ? (
            <p className="text-sm font-black text-white">
              {focus}
              {!session.focusLabel && !session.requestTitle && session.promptCategory ? (
                <span className="font-normal text-white/70"> · {session.promptCategory}</span>
              ) : null}
            </p>
          ) : (
            <p className="text-sm text-white/70">On your own</p>
          )}
        </div>
        <span className="shrink-0 font-black text-yellow">{formatCount(session.minutes)} min</span>
      </div>
      {session.notes ? <p className="mt-2 text-sm leading-6 text-white/70">{session.notes}</p> : null}
    </article>
  );
}
