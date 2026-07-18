import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCampaignProgressSnapshot } from "@/lib/campaign";
import { getNotificationProviderStatus } from "@/lib/notifications";
import { listUsersForAdminLinking } from "@/lib/planning-center";
import {
  getDelayedBoardRequests,
  getPendingBoardReviewRequests
} from "@/lib/prayer-requests";
import { getPlanningCenterCredentials } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="plc-page">
        <section className="plc-panel mx-auto max-w-3xl p-6">
          <h1 className="text-3xl font-black uppercase text-white">Sign in required</h1>
          <Link href="/auth" className="plc-button mt-5">
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  if (user.role !== "admin") {
    return (
      <main className="plc-page">
        <section className="plc-panel mx-auto max-w-3xl p-6">
          <h1 className="text-3xl font-black uppercase text-white">Admin access needed</h1>
          <p className="plc-copy mt-2">This area is only for church admins.</p>
        </section>
      </main>
    );
  }

  const [progress, credentials, users, notificationStatus, pendingReview, delayed] =
    await Promise.all([
      getCampaignProgressSnapshot(),
      getPlanningCenterCredentials(),
      listUsersForAdminLinking(20),
      getNotificationProviderStatus(),
      getPendingBoardReviewRequests(),
      getDelayedBoardRequests()
    ]);

  const linkedCount = users.filter((entry) => entry.planningCenterPersonId).length;
  const { stats, settings, calendar, minutesProgressPercent, paceDelta, aheadOfPace } = progress;
  const attentionCount = pendingReview.length;

  return (
    <main className="plc-page">
      <div className="plc-shell-wide space-y-8">
        <header className="space-y-3">
          <p className="plc-eyebrow">Admin</p>
          <h1 className="plc-title">Campaign control room.</h1>
          <p className="plc-copy max-w-2xl">
            Work is grouped by job: campaign health, prayer content, community board, people (Planning Center), and
            messages.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <article className="plc-panel p-5">
            <p className="text-sm font-black uppercase text-white/50">Minutes logged</p>
            <p className="mt-2 text-3xl font-black text-white">{stats.totalMinutes.toLocaleString()}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-yellow">
              {minutesProgressPercent.toFixed(1)}% of goal
            </p>
          </article>
          <article className="plc-panel p-5">
            <p className="text-sm font-black uppercase text-white/50">Participants</p>
            <p className="mt-2 text-3xl font-black text-white">{stats.activeParticipants.toLocaleString()}</p>
          </article>
          <article className="plc-panel p-5">
            <p className="text-sm font-black uppercase text-white/50">Pace</p>
            <p className="mt-2 text-3xl font-black text-yellow">
              {calendar.hasDates
                ? `${paceDelta >= 0 ? "+" : ""}${paceDelta.toLocaleString()}`
                : "—"}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-white/40">
              {calendar.hasDates
                ? aheadOfPace
                  ? "Ahead of linear pace"
                  : "Behind linear pace"
                : "Set campaign end date"}
            </p>
          </article>
          <Link
            href="/admin/moderation"
            className={`block rounded-[0.85rem] border p-5 shadow-[0_20px_60px_rgba(0,0,0,0.3)] transition ${
              attentionCount > 0
                ? "border-danger/50 bg-gradient-to-br from-danger/25 via-danger/10 to-surface ring-1 ring-danger/40 hover:border-danger hover:from-danger/30"
                : "border-paper/10 bg-gradient-to-br from-surface-raised to-surface hover:border-success/40"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p
                className={`text-sm font-black uppercase tracking-wide ${
                  attentionCount > 0 ? "text-danger" : "text-muted"
                }`}
              >
                Needs attention
              </p>
              {attentionCount > 0 ? (
                <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-night-deep">
                  Action
                </span>
              ) : (
                <span className="rounded-full border border-success/40 bg-success/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-success">
                  Clear
                </span>
              )}
            </div>
            <p
              className={`mt-2 text-3xl font-black tabular-nums ${
                attentionCount > 0 ? "text-danger" : "text-paper"
              }`}
            >
              {attentionCount}
            </p>
            <p
              className={`mt-1 text-xs uppercase tracking-wide ${
                attentionCount > 0 ? "text-danger/80" : "text-muted"
              }`}
            >
              Keyword holds · {delayed.length} delayed
            </p>
          </Link>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Link href="/admin/campaign" className="plc-panel block p-6 transition hover:border-yellow">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-yellow">Campaign</p>
            <h2 className="mt-2 text-xl font-black uppercase text-white">Dates & goal</h2>
            <p className="plc-copy mt-2">
              End date, goal minutes, session soft cap, and pace metrics
              {settings.endDate ? ` · ends ${settings.endDate}` : " · end date not set"}.
            </p>
          </Link>

          <Link href="/admin/content" className="plc-panel block p-6 transition hover:border-yellow">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-yellow">Content</p>
            <h2 className="mt-2 text-xl font-black uppercase text-white">Prayer content</h2>
            <p className="plc-copy mt-2">
              Campaign prompts (Supplication), ACTS guide, and categories—plus CSV import/export.
            </p>
          </Link>

          <Link href="/admin/community" className="plc-panel block p-6 transition hover:border-yellow">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-yellow">Community</p>
            <h2 className="mt-2 text-xl font-black uppercase text-white">Board & requests</h2>
            <p className="plc-copy mt-2">
              Prayer requests, delayed publish, and board safety
              {attentionCount > 0 ? (
                <>
                  {" "}
                  · <span className="font-black text-danger">{attentionCount} need review</span>
                </>
              ) : (
                " · review queue clear"
              )}
              .
            </p>
          </Link>

          <Link
            href="/admin/planning-center"
            className="plc-panel block p-6 transition hover:border-yellow"
          >
            <p className="text-xs font-black uppercase tracking-[0.16em] text-yellow">People</p>
            <h2 className="mt-2 text-xl font-black uppercase text-white">Planning Center</h2>
            <p className="plc-copy mt-2">
              API {credentials.configured ? "ready" : "not set"} · {linkedCount} linked users · Family & Friends
              sync.
            </p>
          </Link>

          <Link
            href="/admin/notifications"
            className="plc-panel block p-6 transition hover:border-yellow"
          >
            <p className="text-xs font-black uppercase tracking-[0.16em] text-yellow">Messages</p>
            <h2 className="mt-2 text-xl font-black uppercase text-white">Notifications</h2>
            <p className="plc-copy mt-2">
              Elastic Email {notificationStatus.email.configured ? "ready" : "not set"} · Twilio{" "}
              {notificationStatus.sms.configured ? "ready" : "not set"} · templates, frequency, send log.
            </p>
          </Link>
        </section>
      </div>
    </main>
  );
}
