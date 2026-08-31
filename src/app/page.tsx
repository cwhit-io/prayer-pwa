import type { CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { PrayerPulse } from "@/app/components/prayer-pulse";
import {
  ChartIcon,
  ClockIcon,
  DownloadIcon,
  FamilyIcon,
  FlameIcon,
  FriendsIcon,
  PersonIcon,
  PlayIcon,
  PromptIcon
} from "@/app/components/icons";
import { getCurrentUser } from "@/lib/auth";
import { getCampaignProgressSnapshot, getPublicRecentActivity, type PublicActivityItem } from "@/lib/campaign";

export const dynamic = "force-dynamic";

const prayerCircles = [
  {
    label: "Future",
    title: "Seasons, transitions, surrender",
    subtitle: "We don’t pray for the past—we align our hearts with God’s purposes ahead.",
    Icon: PersonIcon,
    image: "/homepage-prayer-cards/01-future.webp"
  },
  {
    label: "Family",
    title: "Households shaped by prayer",
    subtitle: "Honor parents, cover the people in your home, and pray for church family.",
    Icon: FamilyIcon,
    image: "/homepage-prayer-cards/02-family.webp"
  },
  {
    label: "Finances",
    title: "Debt, giving, and blessing",
    subtitle: "Ask God to form wise, generous, free hearts with money.",
    Icon: ChartIcon,
    image: "/homepage-prayer-cards/03-finances.webp"
  },
  {
    label: "Friends",
    title: "Names carried with love",
    subtitle: "Pray intentionally for four friends to know Jesus and receive salvation.",
    Icon: FriendsIcon,
    image: "/homepage-prayer-cards/04-friends.webp"
  }
];

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

const ACTIVITY_TZ = "America/Indiana/Indianapolis";

function formatActivityWhen(iso: string, now = new Date()) {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  let relative = "Just now";
  if (minutes >= 1 && minutes < 60) {
    relative = `${minutes} min ago`;
  } else if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      relative = hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    } else {
      const days = Math.floor(hours / 24);
      relative = days === 1 ? "Yesterday" : days < 7 ? `${days} days ago` : then.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: ACTIVITY_TZ
      });
    }
  }

  const exact = then.toLocaleString("en-US", {
    timeZone: ACTIVITY_TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });

  return { relative, exact };
}

const HAPPENING_NOW_MS = 75 * 60 * 1000;

function isSameFortWayneDay(iso: string, now: Date) {
  const options: Intl.DateTimeFormatOptions = { timeZone: ACTIVITY_TZ, year: "numeric", month: "2-digit", day: "2-digit" };
  return new Date(iso).toLocaleDateString("en-US", options) === now.toLocaleDateString("en-US", options);
}

function ActivityFeedItem({ item }: { item: PublicActivityItem }) {
  const ActivityIcon = item.kind === "session" ? ClockIcon : item.kind === "request" ? FriendsIcon : PromptIcon;
  const when = formatActivityWhen(item.occurredAt);

  return (
    <Link href={item.href} className="grid grid-cols-[3rem_1fr_auto] items-center gap-4 py-3.5 transition hover:bg-paper/[0.03]">
      <span className="activity-stream-node grid h-12 w-12 place-items-center rounded-full border-2 border-yellow text-yellow">
        <ActivityIcon className="h-7 w-7" />
      </span>
      <div>
        <p className="font-semibold text-paper">{item.title}</p>
        {item.detail ? <p className="text-sm text-muted">{item.detail}</p> : null}
      </div>
      <time
        dateTime={item.occurredAt}
        title={when.exact}
        className="shrink-0 text-right text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-yellow/55"
      >
        {when.relative}
      </time>
    </Link>
  );
}

export default async function HomePage() {
  const [user, progress, activity] = await Promise.all([
    getCurrentUser(),
    getCampaignProgressSnapshot(),
    getPublicRecentActivity()
  ]);
  const stats = progress.stats;
  const goalMinutes = progress.settings.goalMinutes;
  const now = new Date();
  const happeningNow = activity.filter((item) => now.getTime() - new Date(item.occurredAt).getTime() <= HAPPENING_NOW_MS);
  const earlier = activity.filter((item) => now.getTime() - new Date(item.occurredAt).getTime() > HAPPENING_NOW_MS);
  const earlierLabel = earlier.length > 0 && earlier.every((item) => isSameFortWayneDay(item.occurredAt, now))
    ? "Earlier today"
    : "Earlier";

  return (
    <main className="min-h-screen overflow-hidden bg-night pb-8 text-paper md:pb-0">
      <h1 className="sr-only">Pray Like Crazy: one million minutes of prayer for Fort Wayne</h1>
      <section className="hero-home relative overflow-hidden">
        <Image
          src="/hero-pray-like-crazy-web.webp"
          alt="A person looking over Fort Wayne at sunrise"
          fill
          priority
          sizes="100vw"
          className="hero-home-image"
        />
        <div className="hero-home-overlay" aria-hidden="true" />
        <div className="relative z-10 mx-auto flex min-h-[680px] max-w-7xl items-center px-5 py-12 lg:py-16">
          <div className="hero-home-copy space-y-7">
            <Image
              src="/header-logo@web.png"
              alt="Pray Like Crazy"
              width={800}
              height={226}
              priority
              className="h-auto w-full max-w-[34rem]"
            />
            <div className="max-w-xl uppercase">
              <p className="text-2xl font-black text-paper sm:text-3xl">1 million minutes of prayer</p>
              <p className="mt-2 text-xl font-black text-yellow sm:text-2xl">
                Your Kingdom come in Fort Wayne as it is in heaven.
              </p>
              <p className="mt-5 max-w-lg font-sans text-base normal-case leading-7 text-paper/75">
                Fort Wayne Prays is a church-wide prayer campaign. Start praying with a timer or guided prayer. You can
                pray as a guest, or sign in to save your prayer history, make a campaign pledge, and share prayer requests.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/log"
                className="inline-flex items-center gap-3 rounded-lg bg-yellow px-7 py-4 text-sm font-black uppercase text-black shadow-[0_12px_30px_rgba(255,211,0,0.22)] transition hover:-translate-y-0.5"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-black text-yellow">
                  <PlayIcon className="h-5 w-5" />
                </span>
                Start praying
              </Link>
              {user ? (
                <Link
                   href="/prompts"
                  className="inline-flex items-center gap-3 rounded-lg border border-paper/30 bg-surface/80 px-7 py-4 text-sm font-black uppercase text-paper transition hover:-translate-y-0.5 hover:border-yellow"
                >
                  <PromptIcon className="h-7 w-7 text-yellow" />
                 Prayer ideas
                </Link>
              ) : null}
            </div>
          </div>

        </div>
      </section>

      <PrayerPulse
        currentMinutes={stats.totalMinutes}
        committedMinutes={stats.committedMinutes}
        goalMinutes={goalMinutes}
        logPrayerUrl="/log"
        joinMovementUrl="/pledge"
      />

      <section className="mx-auto max-w-7xl px-5 pt-10">
        <article className="field-guide-panel overflow-hidden">
          <div className="field-guide-content flex flex-col justify-center gap-4 p-6 md:p-10">
            <p className="text-sm font-black uppercase text-yellow">Featured resource</p>
            <h2 className="text-2xl font-black uppercase">Prayer Field Guide</h2>
            <p className="font-sans text-base leading-7 text-paper/75">
              A practical, downloadable companion for the campaign. Use it to guide your own prayer,
              lead your family, and keep the heart of Pray Like Crazy close at hand.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/prayer-field-guide.pdf"
                download="Prayer Field Guide.pdf"
                className="inline-flex items-center gap-3 rounded-lg bg-yellow px-7 py-4 text-sm font-black uppercase text-black shadow-[0_12px_30px_rgba(255,211,0,0.22)] transition hover:-translate-y-0.5"
              >
                <DownloadIcon className="h-5 w-5" />
                Download the guide
              </a>
              <a
                href="/prayer-field-guide.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 rounded-lg border border-paper/30 bg-surface/80 px-7 py-4 text-sm font-black uppercase text-paper transition hover:-translate-y-0.5 hover:border-yellow"
              >
                <PromptIcon className="h-5 w-5 text-yellow" />
                Open in browser
              </a>
            </div>
          </div>
        </article>
      </section>

      <section className="mx-auto max-w-7xl px-5">
        <div className="dark-panel mt-10 grid gap-6 p-6 md:grid-cols-4">
          <div className="stat-cell">
            <ClockIcon className="stat-icon" />
            <div>
               <p>Minutes prayed</p>
              <strong>{formatCount(stats.totalMinutes)}</strong>
               <span>Church-wide total</span>
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
                <p>Signed-in people praying</p>
              <strong>{formatCount(stats.activeParticipants)}</strong>
                <span>Guest minutes still count</span>
            </div>
          </div>
          <div className="stat-cell border-r-0">
            <ChartIcon className="stat-icon" />
            <div>
               <p>Minutes committed</p>
              <strong>{formatCount(stats.committedMinutes)}</strong>
               <span>{formatCount(stats.totalPledges)} people have made commitments</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
             <p className="text-sm font-black uppercase text-yellow">Prayer topics</p>
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
            <Link
              key={circle.label}
              href={user ? `/prompts?tag=${encodeURIComponent(circle.label)}` : `/auth?next=${encodeURIComponent(`/prompts?tag=${circle.label}`)}`}
              className="focus-card overflow-hidden rounded-lg border border-paper/10 bg-surface transition hover:border-yellow/50"
            >
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
              <span className="sr-only">View {circle.label} prayer ideas</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-10">
        <article className="dark-panel p-6">
          <h2 className="text-2xl font-black uppercase">Recent Activity</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">Anonymous snapshots from the church, so you can see prayer happening in real time.</p>
          <div className="mt-5">
            {activity.length > 0 ? (
              <div className="space-y-5">
                {happeningNow.length > 0 ? (
                  <div>
                    <p className="text-[0.7rem] font-black uppercase tracking-[0.22em] text-yellow/85">Happening now</p>
                    <div className="activity-stream mt-1">
                      {happeningNow.map((item) => (
                        <ActivityFeedItem key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                ) : null}
                {earlier.length > 0 ? (
                  <details className="group" open={happeningNow.length === 0}>
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-1 text-[0.7rem] font-black uppercase tracking-[0.22em] text-white/45">
                      <span>{earlierLabel}</span>
                      <span className="font-black text-yellow/70 group-open:hidden">Show</span>
                      <span className="hidden font-black text-yellow/70 group-open:inline">Hide</span>
                    </summary>
                    <div className="activity-stream">
                      {earlier.map((item) => (
                        <ActivityFeedItem key={item.id} item={item} />
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : (
              <div className="grid grid-cols-[3rem_1fr] items-center gap-4 py-4">
                <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-yellow text-yellow">
                  <ClockIcon className="h-7 w-7" />
                </span>
                <div>
                   <p className="font-semibold text-paper">No community activity has been shared yet.</p>
                   <p className="text-sm text-muted">You can start praying or share the first community prayer request.</p>
                   <div className="mt-3 flex flex-wrap gap-4">
                     <Link href="/log" className="font-black text-yellow">Start praying</Link>
                     <Link href={user ? "/requests/mine#submit" : "/auth?next=/requests/mine%23submit"} className="font-black text-yellow">Share a request</Link>
                   </div>
                </div>
              </div>
            )}
          </div>
           <div className="mt-4 flex flex-wrap gap-4">
           <Link href="/auth" className="inline-flex text-sm font-black uppercase text-yellow">
             {user ? "View my profile" : "Sign in to view your profile"}
           </Link>
           <Link href="/help" className="inline-flex text-sm font-black uppercase text-yellow">How totals work</Link>
           </div>
        </article>
      </section>
    </main>
  );
}
