import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ChartIcon,
  ClockIcon,
  CrownIcon,
  FamilyIcon,
  FlameIcon,
  FriendsIcon,
  PersonIcon,
  PlayIcon,
  PromptIcon
} from "@/app/components/icons";
import { getCurrentUser } from "@/lib/auth";
import { getCampaignProgressSnapshot, getPublicRecentActivity } from "@/lib/campaign";

export const dynamic = "force-dynamic";

const prayerCircles = [
  {
    label: "Future",
    title: "Seasons, transitions, surrender",
    subtitle: "We don’t pray for the past—we align our hearts with God’s purposes ahead.",
    Icon: PersonIcon,
    image: "/focus-future.svg"
  },
  {
    label: "Family",
    title: "Households shaped by prayer",
    subtitle: "Honor parents, cover the people in your home, and pray for church family.",
    Icon: FamilyIcon,
    image: "/focus-family.svg"
  },
  {
    label: "Finances",
    title: "Debt, giving, and blessing",
    subtitle: "Ask God to form wise, generous, free hearts with money.",
    Icon: ChartIcon,
    image: "/focus-finances.svg"
  },
  {
    label: "Friends",
    title: "Names carried with love",
    subtitle: "Pray for community, invitation, and four friends by name this year.",
    Icon: FriendsIcon,
    image: "/focus-friends.svg"
  }
];

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function HomePage() {
  const [user, progress, activity] = await Promise.all([
    getCurrentUser(),
    getCampaignProgressSnapshot(),
    getPublicRecentActivity()
  ]);
  const stats = progress.stats;
  const progressPercent = progress.minutesProgressPercent;
  const goalMinutes = progress.settings.goalMinutes;

  return (
    <main className="min-h-screen overflow-hidden bg-night pb-8 text-paper md:pb-0">
      <section className="hero-grit relative">
        <div className="hero-skyline" aria-hidden="true" />
        <div className="mx-auto grid min-h-[650px] max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="relative z-10 space-y-8">
            <div>
              <CrownIcon className="crown-mark" />
              <h1 className="brush-title max-w-2xl text-[5.6rem] uppercase leading-[0.78] sm:text-[7.4rem] lg:text-[8.5rem]">
                Pray <span>Like</span> Crazy!
              </h1>
            </div>
            <div className="max-w-xl text-center uppercase sm:text-left">
              <p className="text-2xl font-black text-paper">1 million minutes of prayer</p>
              <p className="mt-1 text-2xl font-black text-yellow">
                Your Kingdom come in Fort Wayne as it is in heaven.
              </p>
              <p className="mt-5 max-w-lg font-sans text-base normal-case leading-7 text-muted">
                Let&apos;s raise 1 million minutes of prayer this year—for our Future, Family, Finances, and Friends.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/log"
                className="inline-flex items-center gap-3 rounded-lg bg-yellow px-7 py-4 text-sm font-black uppercase text-black shadow-[0_12px_30px_rgba(255,211,0,0.22)] transition hover:-translate-y-0.5"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-night-deep text-yellow">
                  <PlayIcon className="h-5 w-5" />
                </span>
                PRAY
              </Link>
              {user ? (
                <Link
                  href="/prompts"
                  className="inline-flex items-center gap-3 rounded-lg border border-paper/30 bg-surface/80 px-7 py-4 text-sm font-black uppercase text-paper transition hover:-translate-y-0.5 hover:border-yellow"
                >
                  <PromptIcon className="h-7 w-7 text-yellow" />
                  Prayer Prompts
                </Link>
              ) : null}
            </div>
          </div>

          <aside className="relative z-10 ml-auto w-full max-w-md">
            <div className="goal-ring-card text-center">
              <p className="text-sm font-black uppercase text-yellow">Church Goal</p>
              <h2 className="mt-2 text-5xl font-black italic leading-none text-paper">
                {formatCount(goalMinutes)}
              </h2>
              <p className="mt-2 text-lg font-black uppercase italic text-paper/90">minutes offered to the King</p>
              <div className="progress-ring mx-auto mt-6 grid h-56 w-56 place-items-center rounded-full" style={{ "--progress": `${progressPercent}%` } as CSSProperties}>
                <div className="grid h-40 w-40 place-items-center rounded-full bg-night-deep/90 text-center shadow-[inset_0_0_40px_rgba(242,240,235,0.05)]">
                  <div>
                    <span className="skyline-ring-mark mx-auto" aria-hidden="true" />
                    <div className="mt-2 text-3xl font-black text-paper">{formatCount(stats.totalMinutes)}</div>
                    <div className="text-xs font-black uppercase text-muted">Fort Wayne prayer</div>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-2xl font-black text-yellow">{progressPercent.toFixed(0)}% of commitment</p>
              {progress.calendar.hasDates ? (
                <p className="mt-2 text-sm text-muted">
                  {progress.calendar.remainingDays} days left · calendar {progress.calendar.calendarProgressPercent.toFixed(0)}%
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5">
        <div className="dark-panel mt-10 grid gap-6 p-6 md:grid-cols-4">
          <div className="stat-cell">
            <ClockIcon className="stat-icon" />
            <div>
              <p>Church Minutes</p>
              <strong>{formatCount(stats.totalMinutes)}</strong>
              <span>Offered to the King</span>
            </div>
          </div>
          <div className="stat-cell">
            <FlameIcon className="stat-icon" />
            <div>
              <p>This Week</p>
              <strong>{formatCount(stats.minutesThisWeek)}</strong>
              <span>Minutes</span>
            </div>
          </div>
          <div className="stat-cell">
            <PersonIcon className="stat-icon" />
            <div>
              <p>Praying Together</p>
              <strong>{formatCount(stats.activeParticipants)}</strong>
              <span>Participants</span>
            </div>
          </div>
          <div className="stat-cell border-r-0">
            <ChartIcon className="stat-icon" />
            <div>
              <p>Pledged</p>
              <strong>{formatCount(stats.pledgedMinutes)}</strong>
              <span>{formatCount(stats.totalPledges)} Commitments</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase text-yellow">Pray Like Crazy for your…</p>
            <h2 className="text-2xl font-black uppercase">Four areas of focus</h2>
          </div>
          {user ? (
            <Link href="/prompts" className="hidden text-sm font-black uppercase text-yellow sm:inline-flex">
              View prompts
            </Link>
          ) : null}
        </div>
        <div className="grid gap-5 md:grid-cols-4">
          {prayerCircles.map((circle) => (
            <article key={circle.label} className="focus-card overflow-hidden rounded-lg border border-paper/10 bg-surface">
              <div
                className="focus-art"
                style={{ "--focus-image": `url(${circle.image})` } as CSSProperties}
              >
                <div className="kingdom-card-shade" />
              </div>
              <div className="relative px-5 pb-6 pt-8 text-center">
                <span className="focus-icon">
                  <circle.Icon className="h-9 w-9" />
                </span>
                <p className="mt-2 text-lg text-paper/90">Pray Like Crazy for your</p>
                <h3 className="brush-small mt-1 text-4xl uppercase text-paper">{circle.label}</h3>
                <p className="mt-2 text-sm font-black uppercase text-yellow">{circle.title}</p>
                <p className="mt-3 text-sm font-bold uppercase leading-6 text-muted">{circle.subtitle}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-10">
        <article className="dark-panel p-6">
          <h2 className="text-2xl font-black uppercase">Recent Activity</h2>
          <div className="mt-5 divide-y divide-paper/10">
            {activity.length > 0 ? activity.map((item) => {
              const ActivityIcon = item.kind === "session" ? ClockIcon : item.kind === "request" ? FriendsIcon : PromptIcon;

              return (
                <Link key={item.id} href={item.href} className="grid grid-cols-[3rem_1fr_auto] items-center gap-4 py-4 transition hover:bg-paper/[0.03]">
                  <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-yellow text-yellow">
                    <ActivityIcon className="h-7 w-7" />
                  </span>
                  <div>
                    <p className="font-semibold text-paper">{item.title}</p>
                    {item.detail ? <p className="text-sm text-muted">{item.detail}</p> : null}
                  </div>
                  {item.metric ? (
                    <span className="text-sm font-black uppercase text-yellow">{item.metric}</span>
                  ) : null}
                </Link>
              );
            }) : (
              <div className="grid grid-cols-[3rem_1fr] items-center gap-4 py-4">
                <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-yellow text-yellow">
                  <ClockIcon className="h-7 w-7" />
                </span>
                <div>
                  <p className="font-semibold text-paper">The first public activity will appear here.</p>
                  <p className="text-sm text-muted">PRAY, add prompts, or share a community prayer.</p>
                </div>
              </div>
            )}
          </div>
          <Link href="/auth" className="mt-3 inline-flex text-sm font-black uppercase text-yellow">
            View your profile
          </Link>
        </article>
      </section>
    </main>
  );
}
