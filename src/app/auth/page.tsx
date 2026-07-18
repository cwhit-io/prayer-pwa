import Link from "next/link";
import {
  choosePlanningCenterPersonAction,
  createUnlinkedAccountAction,
  requestLoginCodeAction,
  signOutAction,
  verifyLoginCodeAction
} from "@/app/auth/actions";
import { FormBanner } from "@/app/components/form-banner";
import { FamilyIcon, FriendsIcon } from "@/app/components/icons";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/campaign";
import { getPrayerFriendSlots } from "@/lib/prayer-friends";
import { getPrayerPeopleForUser } from "@/lib/pco-people";
import { getLatestPledge } from "@/lib/pledges";
import {
  getUserNotificationPreferences,
  getUserNotifyEmail
} from "@/lib/notification-preferences";
import { getPendingLoginChallenge, getVerifiedLoginChallenge } from "@/lib/planning-center-login";
import { FourFriendsList } from "./friends-list";
import { NotificationPreferencesForm } from "./notification-prefs";
import { PledgeSection, UpdatePledgeButton } from "./pledge-form";

export const dynamic = "force-dynamic";

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function ProfileDashboardPage({
  searchParams
}: {
  searchParams?: Promise<{
    challenge?: string;
    contact?: string;
    delivery?: string;
    debug_code?: string;
    verified?: string;
    prefs_saved?: string;
    pledge_saved?: string;
    friends_saved?: string;
    session_saved?: string;
    error?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const challengeId = params?.challenge;
  const pendingChallenge = !user && challengeId && !params?.verified
    ? await getPendingLoginChallenge(challengeId)
    : null;
  const verifiedChallenge = !user && challengeId && params?.verified
    ? await getVerifiedLoginChallenge(challengeId)
    : null;

  if (!user) {
    return (
      <main className="plc-page">
        <div className="plc-shell grid min-h-[72vh] place-items-center">
          <section className="plc-panel w-full max-w-2xl p-8">
            <p className="plc-eyebrow">Join the campaign</p>
            <h1 className="brush-small mt-3 text-5xl uppercase leading-none text-white">
              Sign in through your household.
            </h1>
            <p className="plc-copy mt-4">
              Enter an email or phone number. We send a one-time code. If we find you in the church directory, you can
              pick which household member you are. If not, you can still create a prayer account—we&apos;ll link
              Planning Center later if needed.
              You can also{" "}
              <Link href="/log" className="font-black uppercase text-yellow">
                PRAY as a guest
              </Link>
              —minutes still count toward the church total, just not on a personal profile.
            </p>

            <div className="mt-4">
              <FormBanner error={params?.error} />
            </div>

            {!pendingChallenge && !verifiedChallenge ? (
              <form action={requestLoginCodeAction} className="mt-8 space-y-4">
                <label className="block space-y-2">
                  <span className="plc-label">Email or phone</span>
                  <input
                    required
                    name="contact"
                    className="plc-input w-full px-4 py-3"
                    placeholder="you@example.com or 260-555-1212"
                  />
                </label>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button className="plc-button">Send code</button>
                  <Link href="/log" className="plc-button-secondary">
                    Guest PRAY
                  </Link>
                </div>
              </form>
            ) : null}

            {pendingChallenge ? (
              <form action={verifyLoginCodeAction} className="mt-8 space-y-4">
                <input type="hidden" name="challenge_id" value={pendingChallenge.challengeId} />
                <div className="plc-card-muted p-4">
                  <p className="font-black uppercase text-white">Code sent to {pendingChallenge.contact}</p>
                  <p className="mt-2 text-sm text-white/60">
                    Enter the six-digit code to unlock the household/person selection step.
                  </p>
                  {pendingChallenge.debugCode ? (
                    <p className="mt-3 rounded-lg border border-yellow/40 bg-yellow/10 px-3 py-2 text-sm font-black text-yellow">
                      Local test code: {pendingChallenge.debugCode}
                    </p>
                  ) : null}
                </div>
                <label className="block space-y-2">
                  <span className="plc-label">Authorization code</span>
                  <input required name="code" inputMode="numeric" className="plc-input w-full px-4 py-3" />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button className="plc-button">Verify code</button>
                  <Link href="/auth" className="plc-button-secondary">
                    Start over
                  </Link>
                </div>
              </form>
            ) : null}

            {verifiedChallenge && verifiedChallenge.candidates.length > 0 ? (
              <form action={choosePlanningCenterPersonAction} className="mt-8 space-y-4">
                <input type="hidden" name="challenge_id" value={verifiedChallenge.challengeId} />
                <div>
                  <p className="plc-eyebrow">Who are you?</p>
                  <p className="plc-copy mt-2">
                    This contact may match more than one household member. Choose your name so your prayer profile
                    links to the right Planning Center person.
                  </p>
                </div>
                <div className="grid gap-3">
                  {verifiedChallenge.candidates.map((candidate) => (
                    <label key={candidate.personId} className="plc-card-muted flex items-start gap-3 p-4">
                      <input
                        required
                        type="radio"
                        name="person_id"
                        value={candidate.personId}
                        className="plc-checkbox mt-1"
                      />
                      <span>
                        <span className="block text-lg font-black text-white">{candidate.name}</span>
                        <span className="text-sm text-white/55">
                          {candidate.householdName ?? "Planning Center profile"}
                          {candidate.email ? ` · ${candidate.email}` : ""}
                          {candidate.phone ? ` · ${candidate.phone}` : ""}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button className="plc-button">Continue as selected person</button>
                  <Link href="/auth" className="plc-button-secondary">
                    Start over
                  </Link>
                </div>
              </form>
            ) : null}

            {verifiedChallenge && verifiedChallenge.candidates.length === 0 ? (
              <form action={createUnlinkedAccountAction} className="mt-8 space-y-4">
                <input type="hidden" name="challenge_id" value={verifiedChallenge.challengeId} />
                <div>
                  <p className="plc-eyebrow">Create your account</p>
                  <h2 className="mt-2 text-2xl font-black uppercase text-white">We didn&apos;t find you in the directory</h2>
                  <p className="plc-copy mt-2">
                    That&apos;s okay. Enter your name to create a prayer account with{" "}
                    <span className="font-black text-white/80">{verifiedChallenge.contact}</span>. You can still log
                    minutes and pledges; the church can connect Planning Center later if needed.
                  </p>
                </div>
                <label className="block space-y-2">
                  <span className="plc-label">Your name</span>
                  <input
                    required
                    name="name"
                    className="plc-input w-full px-4 py-3"
                    placeholder="First and last name"
                    autoComplete="name"
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button className="plc-button">Create account &amp; continue</button>
                  <Link href="/auth" className="plc-button-secondary">
                    Start over
                  </Link>
                </div>
              </form>
            ) : null}
          </section>
        </div>
      </main>
    );
  }

  const [snapshot, family, churchFamily, fourFriends, pledge, notifyPrefs, notifyEmail] =
    await Promise.all([
      getDashboardSnapshot(user.id),
      getPrayerPeopleForUser(user.id, "family"),
      getPrayerPeopleForUser(user.id, "friends"),
      getPrayerFriendSlots(user.id),
      getLatestPledge(user.id),
      getUserNotificationPreferences(user.id),
      getUserNotifyEmail(user.id)
    ]);

  const pledgeProgress = snapshot.pledge?.totalPledgedMinutes
    ? Math.min(100, (snapshot.totalMinutes / snapshot.pledge.totalPledgedMinutes) * 100)
    : 0;

  return (
    <main className="plc-page">
      <div className="plc-shell-wide space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <p className="plc-eyebrow">My Profile</p>
            <h1 className="plc-title">Welcome, {user.name}.</h1>
            <p className="plc-copy">
              {user.email} · your prayer dashboard and pledge in one place.
            </p>
            <FormBanner
              error={params?.error}
              success={
                params?.prefs_saved === "1"
                  ? "Notification preferences saved."
                  : params?.pledge_saved === "1"
                    ? "Pledge saved."
                    : params?.friends_saved === "1"
                      ? "Friends list saved."
                      : params?.session_saved === "1"
                        ? "Prayer session saved."
                        : null
              }
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/log" className="plc-button">
              PRAY
            </Link>
            {user.role === "admin" ? (
              <Link href="/admin" className="plc-button-secondary">
                Admin
              </Link>
            ) : null}
            <form action={signOutAction}>
              <button className="plc-button-secondary">Sign out</button>
            </form>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="plc-panel p-6">
            <div className="text-sm font-black uppercase text-white/50">Total minutes prayed</div>
            <div className="mt-2 text-4xl font-black text-white">{formatCount(snapshot.totalMinutes)}</div>
            <p className="mt-2 text-sm text-white/55">
              <span className="font-black text-yellow">{formatCount(snapshot.thisWeekMinutes)}</span>
              {" "}this week
            </p>
            {pledge ? (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-white/45">
                  <span>Toward pledge</span>
                  <span>{pledgeProgress.toFixed(0)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40">
                  <div className="h-full rounded-full bg-yellow" style={{ width: `${pledgeProgress}%` }} />
                </div>
              </div>
            ) : null}
          </article>
          <article className="plc-panel p-6">
            <div className="text-sm font-black uppercase text-white/50">Pledged minutes</div>
            <div className="mt-2 text-4xl font-black text-white">{formatCount(snapshot.pledgedMinutes)}</div>
            {pledge ? (
              <>
                <p className="mt-2 text-sm text-white/50">
                  {pledge.minutesPerWeek} min/week
                  {pledge.isPublic ? " · public total" : " · private"}
                </p>
                <UpdatePledgeButton minutesPerWeek={pledge.minutesPerWeek} isPublic={pledge.isPublic} />
              </>
            ) : (
              <p className="mt-2 text-sm text-white/50">No pledge yet — set one below.</p>
            )}
          </article>
        </section>

        <PledgeSection
          hasPledge={Boolean(pledge)}
          minutesPerWeek={pledge?.minutesPerWeek ?? null}
          isPublic={pledge?.isPublic ?? true}
        />

        <NotificationPreferencesForm
          emailPrayerRequestUpdates={notifyPrefs.emailPrayerRequestUpdates}
          notifyEmail={notifyEmail}
        />

        <FourFriendsList initialSlots={fourFriends} />

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="plc-panel p-6">
            <div className="flex items-center gap-3">
              <FamilyIcon className="h-8 w-8 text-yellow" />
              <div>
                <p className="plc-eyebrow">Pray for</p>
                <h2 className="text-2xl font-black uppercase text-white">My Household</h2>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {family.length > 0 ? (
                family.map((person) => (
                  <div key={person.id} className="plc-card-muted flex items-center justify-between px-4 py-3">
                    <span className="font-black text-white">{person.name}</span>
                    {person.sourceGroupName ? (
                      <span className="text-xs uppercase tracking-wide text-white/40">{person.sourceGroupName}</span>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="plc-copy">
                  Household names appear here after the church team connects your account in Planning Center.
                </p>
              )}
            </div>
          </article>

          <article className="plc-panel p-6">
            <div className="flex items-center gap-3">
              <FriendsIcon className="h-8 w-8 text-yellow" />
              <div>
                <p className="plc-eyebrow">Pray for</p>
                <h2 className="text-2xl font-black uppercase text-white">My Church Family</h2>
              </div>
            </div>
            <div className="mt-5 max-h-72 space-y-2 overflow-y-auto overscroll-contain pr-1 sm:max-h-80">
              {churchFamily.length > 0 ? (
                churchFamily.map((person) => (
                  <div key={person.id} className="plc-card-muted flex items-center justify-between px-4 py-3">
                    <span className="font-black text-white">{person.name}</span>
                    {person.sourceGroupName ? (
                      <span className="text-xs uppercase tracking-wide text-white/40">{person.sourceGroupName}</span>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="plc-copy">
                  Small-group and church family names appear here after the church team connects your account in
                  Planning Center.
                </p>
              )}
            </div>
          </article>
        </section>

        <section className="plc-panel p-6">
          <h2 className="text-2xl font-black uppercase text-white">My Recent Prayer</h2>
          <div className="mt-5 space-y-3">
            {snapshot.recentSessions.length > 0 ? (
              snapshot.recentSessions.map((session) => (
                <div key={session.id} className="plc-card-muted px-4 py-4 text-white/75">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span>{new Date(session.startedAt).toLocaleDateString()}</span>
                      {session.promptTitle ? (
                        <p className="mt-1 text-sm font-black text-white">
                          {session.promptTitle}
                          {session.promptCategory ? (
                            <span className="font-normal text-white/45"> · {session.promptCategory}</span>
                          ) : null}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-white/45">Free prayer</p>
                      )}
                    </div>
                    <span className="font-black text-yellow">{formatCount(session.minutes)} min</span>
                  </div>
                  {session.notes ? <p className="mt-2 text-sm text-white/50">{session.notes}</p> : null}
                </div>
              ))
            ) : (
              <div className="plc-card-muted px-4 py-4 text-white/70">
                No prayer sessions yet.{" "}
                <Link href="/log" className="font-black uppercase text-yellow">
                  PRAY
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
