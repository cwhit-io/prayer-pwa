import Link from "next/link";
import { getCurrentUser, hasCapability } from "@/lib/auth";
import { getAdminDashboardSnapshot, getCampaignProgressSnapshot } from "@/lib/campaign";

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

  if (!hasCapability(user.role, "staff:access")) {
    return (
      <main className="plc-page">
        <section className="plc-panel mx-auto max-w-3xl p-6">
          <h1 className="text-3xl font-black uppercase text-white">Admin access needed</h1>
          <p className="plc-copy mt-2">This area is only for church admins.</p>
        </section>
      </main>
    );
  }

  const canViewDetailedProgress = hasCapability(user.role, "member-progress:read");
  const canModerate = hasCapability(user.role, "community-requests:moderate");
  const canManageSettings = hasCapability(user.role, "campaign-settings:manage");
  const canManageNotifications = hasCapability(user.role, "notifications:manage");

  if (!canViewDetailedProgress) {
    const { stats, minutesProgressPercent } = await getCampaignProgressSnapshot();
    return (
      <main className="plc-page">
        <div className="plc-shell-wide space-y-8">
          <header className="space-y-3">
            <p className="plc-eyebrow">Prayer Team tools</p>
            <h1 className="plc-title">Support the prayer campaign.</h1>
            <p className="plc-copy max-w-2xl">Manage prayer content or record a participant&apos;s reported pledge and prayer minutes. Detailed participant progress and moderation are restricted to admins.</p>
          </header>
          <section className="grid gap-4 sm:grid-cols-2">
            <article className="plc-panel p-5">
              <p className="text-sm font-black uppercase text-white/65">Public campaign progress</p>
              <p className="mt-2 text-3xl font-black text-white">{stats.totalMinutes.toLocaleString()} minutes</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-yellow">{minutesProgressPercent.toFixed(1)}% of the church goal</p>
            </article>
            <Link href="/auth" className="plc-panel block p-5 transition hover:border-yellow">
              <p className="text-sm font-black uppercase text-white/65">Your progress</p>
              <p className="mt-2 text-xl font-black uppercase text-white">Open My Profile</p>
              <p className="plc-copy mt-1">See your own pledge, prayer history, and progress.</p>
            </Link>
          </section>
          <section className="grid gap-4 md:grid-cols-2">
            <Link href="/admin/content" className="plc-panel block p-6 transition hover:border-yellow"><p className="plc-eyebrow">Prayer content</p><h2 className="mt-2 text-xl font-black uppercase text-white">Manage prompts</h2><p className="plc-copy mt-2">Create, edit, publish, import, and organize prayer prompts.</p></Link>
            <Link href="/admin/planning-center" className="plc-panel block p-6 transition hover:border-yellow"><p className="plc-eyebrow">Participant updates</p><h2 className="mt-2 text-xl font-black uppercase text-white">Record minutes or pledges</h2><p className="plc-copy mt-2">Search for a participant and record an update without viewing their prayer progress.</p></Link>
          </section>
        </div>
      </main>
    );
  }

  const [progress, dashboard] =
    await Promise.all([
      getCampaignProgressSnapshot(),
      getAdminDashboardSnapshot({
        includePrivateRequests: hasCapability(user.role, "private-requests:read")
      })
    ]);

  const { stats, settings, calendar, minutesProgressPercent, paceDelta, aheadOfPace } = progress;
  const attentionCount = dashboard.pendingReviewRequests;
  const weekDelta = dashboard.minutesThisWeek - dashboard.minutesLastWeek;
  const goalCoverage = dashboard.totalPeople > 0
    ? Math.round((dashboard.peopleWithGoals / dashboard.totalPeople) * 100)
    : 0;

  return (
    <main className="plc-page">
      <div className="plc-shell-wide space-y-8">
        <header className="space-y-3">
          <p className="plc-eyebrow">Staff admin</p>
          <h1 className="plc-title">Prayer campaign dashboard.</h1>
          <p className="plc-copy max-w-2xl">
            Start here to see what needs attention, check campaign progress, and choose the area you need to manage.
            You do not need to understand every tool on this page.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="plc-panel p-5">
            <p className="text-sm font-black uppercase text-white/65">Minutes prayed</p>
            <p className="mt-2 text-3xl font-black text-white">{stats.totalMinutes.toLocaleString()}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-yellow">
              {minutesProgressPercent.toFixed(1)}% of church goal
            </p>
          </article>
          <article className="plc-panel p-5">
            <p className="text-sm font-black uppercase text-white/65">People using the campaign</p>
            <p className="mt-2 text-3xl font-black text-white">{dashboard.totalPeople.toLocaleString()}</p>
            <p className="mt-1 text-xs text-white/65">{dashboard.activePeopleThisMonth} active in 30 days</p>
          </article>
          <article className="plc-panel p-5">
            <p className="text-sm font-black uppercase text-white/65">Progress pace</p>
            <p className="mt-2 text-3xl font-black text-yellow">
              {calendar.hasDates
                ? `${paceDelta >= 0 ? "+" : ""}${paceDelta.toLocaleString()}`
                : "—"}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-white/40">
               {calendar.hasDates
                 ? aheadOfPace
                   ? "Ahead of the planned pace"
                   : "Behind the planned pace"
                 : "Add campaign dates"}
            </p>
          </article>
          <Link
             href="/admin/requests"
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
                Needs your attention
              </p>
              {attentionCount > 0 ? (
                <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-night-deep">
                   Review now
                </span>
              ) : (
                <span className="rounded-full border border-success/40 bg-success/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-success">
                   Nothing waiting
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
                {attentionCount > 0 ? "Requests waiting for review" : "No requests waiting for review"} · {dashboard.delayedRequests} delayed
            </p>
          </Link>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="plc-panel p-5">
            <p className="text-sm font-black uppercase text-white/65">Minutes this week</p>
            <p className="mt-2 text-3xl font-black text-white">{dashboard.minutesThisWeek.toLocaleString()}</p>
            <p className={`mt-1 text-sm font-black ${weekDelta >= 0 ? "text-success" : "text-danger"}`}>
              {weekDelta >= 0 ? "+" : ""}{weekDelta.toLocaleString()} vs last week
            </p>
          </article>
          <article className="plc-panel p-5">
            <p className="text-sm font-black uppercase text-white/65">Prayer sessions this week</p>
            <p className="mt-2 text-3xl font-black text-white">{dashboard.sessionsThisWeek.toLocaleString()}</p>
            <p className="mt-1 text-sm text-white/65">{dashboard.averageSessionMinutesThisWeek} minutes average</p>
          </article>
          <article className="plc-panel p-5">
            <p className="text-sm font-black uppercase text-white/65">Campaign pledges</p>
            <p className="mt-2 text-3xl font-black text-white">{dashboard.peopleWithGoals.toLocaleString()}</p>
            <p className="mt-1 text-sm text-white/65">{goalCoverage}% of campaign accounts</p>
          </article>
          <article className="plc-panel p-5">
            <p className="text-sm font-black uppercase text-white/65">Open prayer requests</p>
            <p className="mt-2 text-3xl font-black text-white">{dashboard.openRequests.toLocaleString()}</p>
            <p className="mt-1 text-sm text-white/65">{dashboard.activePrompts} active prayer prompts</p>
          </article>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
           {canManageSettings ? <Link href="/admin/campaign" className="plc-panel block p-6 transition hover:border-yellow">
             <p className="text-xs font-black uppercase tracking-[0.16em] text-yellow">Start here</p>
              <h2 className="mt-2 text-xl font-black uppercase text-white">Settings</h2>
             <p className="plc-copy mt-2">
               Set the campaign dates, church-wide prayer goal, and timer limit.
               {settings.endDate ? ` The campaign ends ${settings.endDate}.` : " The campaign end date is not set yet."}
            </p>
           </Link> : null}

          <Link href="/admin/content" className="plc-panel block p-6 transition hover:border-yellow">
             <p className="text-xs font-black uppercase tracking-[0.16em] text-yellow">What people see</p>
             <h2 className="mt-2 text-xl font-black uppercase text-white">Prayer content</h2>
             <p className="plc-copy mt-2">
               Manage prayer prompts, the ACTS guide, and the topics people use to find prayer content.
            </p>
          </Link>

            {canModerate ? <Link href="/admin/requests" className="plc-panel block p-6 transition hover:border-yellow">
             <p className="text-xs font-black uppercase tracking-[0.16em] text-yellow">What people share</p>
             <h2 className="mt-2 text-xl font-black uppercase text-white">Community requests</h2>
             <p className="plc-copy mt-2">
                Review prayer requests, approve or hold posts, and archive old requests
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
           </Link> : null}

           {canManageNotifications ? <Link
            href="/admin/planning-center"
            className="plc-panel block p-6 transition hover:border-yellow"
          >
             <p className="text-xs font-black uppercase tracking-[0.16em] text-yellow">People using the campaign</p>
             <h2 className="mt-2 text-xl font-black uppercase text-white">People & accounts</h2>
             <p className="plc-copy mt-2">
               Review people using the campaign, update a person&apos;s minutes or goal, and sync household and friends lists.
            </p>
           </Link> : null}

          <Link
            href="/admin/notifications"
            className="plc-panel block p-6 transition hover:border-yellow"
          >
             <p className="text-xs font-black uppercase tracking-[0.16em] text-yellow">Email & text messages</p>
             <h2 className="mt-2 text-xl font-black uppercase text-white">Notifications</h2>
             <p className="plc-copy mt-2">
               Manage message templates, delivery settings, and the send history.
            </p>
          </Link>
        </section>
      </div>
    </main>
  );
}
