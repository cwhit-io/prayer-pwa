import Link from "next/link";
import type { HeaderWeeklyPace } from "@/lib/campaign";

export function WeeklyPaceRing({ thisWeekMinutes, goalMinutes }: HeaderWeeklyPace) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const progress = goalMinutes && goalMinutes > 0 ? Math.min(1, thisWeekMinutes / goalMinutes) : 0;
  const offset = circumference * (1 - progress);
  const label = goalMinutes
    ? `${thisWeekMinutes} of ${goalMinutes} minutes toward your weekly pace`
    : `${thisWeekMinutes} prayer minutes this week`;
  const display = thisWeekMinutes >= 1000 ? `${Math.round(thisWeekMinutes / 1000)}k` : String(thisWeekMinutes);

  return (
    <Link
      href="/auth#progress"
      className="weekly-pace-ring"
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="3.5"
        />
        {progress > 0 ? (
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke="var(--yellow)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        ) : null}
      </svg>
      <span className="weekly-pace-ring-value">{display}</span>
    </Link>
  );
}
