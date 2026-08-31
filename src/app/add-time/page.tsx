import Link from "next/link";
import { PrayerSessionCard } from "@/app/components/prayer-session-card";
import { getCurrentUser } from "@/lib/auth";
import { getRecentPrayerSessions, type PrayerSessionEntry } from "@/lib/campaign";
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

function journalDayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Indiana/Indianapolis"
  });
}

function groupSessionsByDay(sessions: PrayerSessionEntry[]) {
  const groups: Array<{ label: string; sessions: PrayerSessionEntry[] }> = [];
  for (const session of sessions) {
    const label = journalDayLabel(session.startedAt);
    const last = groups.at(-1);
    if (last && last.label === label) {
      last.sessions.push(session);
    } else {
      groups.push({ label, sessions: [session] });
    }
  }
  return groups;
}

export default async function PrayerLogPage({
  searchParams
}: {
  searchParams?: Promise<{ entry?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const sessions = user ? await getRecentPrayerSessions(user.id) : [];
  const days = groupSessionsByDay(sessions);
  const expandEntry = params?.entry === "1" || !user || sessions.length === 0;

  return (
    <main className="plc-page">
      <div className="plc-shell max-w-2xl space-y-6">
        <header className="space-y-3 text-center">
          <p className="plc-eyebrow">Prayer log</p>
          <h1 className="plc-title">Your prayer journal</h1>
          <p className="plc-copy mx-auto max-w-xl">
            {user
              ? "Look back on what you prayed and add minutes from earlier if you did not use the timer."
              : "Record prayer you completed without the timer. Sign in to keep a personal journal."}
          </p>
        </header>

        <div>
          <ManualEntry
            defaultMinutes={10}
            today={fortWayneDate()}
            canSaveToHistory={Boolean(user)}
            defaultOpen={expandEntry}
            collapsible={Boolean(user && sessions.length > 0)}
          />
        </div>

        {user ? (
          <section className="space-y-5" aria-labelledby="journal-title">
            <h2 id="journal-title" className="text-2xl font-black uppercase text-white">
              Recent prayer
            </h2>
            {days.length > 0 ? (
              days.map((day) => (
                <section key={day.label} className="space-y-3">
                  <h3 className="text-sm font-black uppercase tracking-[0.12em] text-yellow">{day.label}</h3>
                  {day.sessions.map((session) => (
                    <PrayerSessionCard key={session.id} session={session} />
                  ))}
                </section>
              ))
            ) : (
              <div className="plc-card-muted px-4 py-4 text-white/70">
                No prayer in your journal yet.{" "}
                <Link href="/log" className="font-black text-yellow">
                  Start praying
                </Link>{" "}
                or log completed prayer above.
              </div>
            )}
          </section>
        ) : null}

        <p className="text-center text-base text-white/75">
          Praying now?{" "}
          <Link href="/log" className="font-black text-yellow">
            Start the timer instead
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
