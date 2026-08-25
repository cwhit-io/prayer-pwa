import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { ManualEntry } from "@/app/log/manual-entry";

export const dynamic = "force-dynamic";

function fortWayneDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Indiana/Indianapolis",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const value = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export default async function AddPrayerTimePage() {
  const user = await getCurrentUser();

  return (
    <main className="plc-page">
      <div className="plc-shell max-w-2xl space-y-6">
        <header className="space-y-3 text-center">
          <p className="plc-eyebrow">Add time</p>
          <h1 className="plc-title">Log completed prayer</h1>
          <p className="plc-copy mx-auto max-w-xl">
            Use this only for prayer you completed without the timer.
            {user
              ? " It will be added to your history and credited to the church campaign when eligible."
              : " Eligible guest time is credited to the church campaign but not personal history."}
          </p>
        </header>

        <ManualEntry
          defaultMinutes={10}
          today={fortWayneDate()}
          canSaveToHistory={Boolean(user)}
          defaultOpen
          collapsible={false}
        />

        <p className="text-center text-base text-white/75">
          Praying now? <Link href="/log" className="font-black text-yellow">Start the timer instead</Link>.
        </p>
      </div>
    </main>
  );
}
