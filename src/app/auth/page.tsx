import { Suspense } from "react";
import Link from "next/link";
import {
  choosePlanningCenterPersonAction,
  createUnlinkedAccountAction,
  requestLoginCodeAction,
  signOutAction,
  verifyLoginCodeAction
} from "@/app/auth/actions";
import { AuthChallengeRestore, ClearStoredLoginChallenge, StartOverLink } from "@/app/auth/login-challenge-state";
import { FormBanner } from "@/app/components/form-banner";
import { FormSubmitButton } from "@/app/components/form-submit-button";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/campaign";
import { getUserCampaignOverview } from "@/lib/campaign-model";
import { getPrayerFriendSlots } from "@/lib/prayer-friends";
import { getLatestPledge } from "@/lib/pledges";
import {
  getUserNotificationPreferences,
  getUserNotifyEmail
} from "@/lib/notification-preferences";
import { getPendingLoginChallenge, getVerifiedLoginChallenge } from "@/lib/planning-center-login";
import { ContactInput } from "./contact-input";
import { FourFriendsList } from "./friends-list";
import { authHref, getSafeAuthNextPath } from "./next-path";
import { NotificationPreferencesForm } from "./notification-prefs";
import { PledgeSection, UpdatePledgeButton } from "./pledge-form";

export const dynamic = "force-dynamic";

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCampaignDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function maskContact(type: "email" | "phone", contact: string) {
  if (type === "phone") {
    return `mobile ending in ${contact.replace(/\D/g, "").slice(-4)}`;
  }
  const [local, domain] = contact.split("@");
  return `${local.slice(0, 1)}${local.length > 1 ? "***" : ""}@${domain}`;
}

function isSyntheticEmail(email: string) {
  return email.endsWith("@planningcenter.local") || email.endsWith("@unlinked.local");
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
    pledge_removed?: string;
    friends_saved?: string;
    session_saved?: string;
    section?: string;
    error?: string;
    next?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const next = getSafeAuthNextPath(params?.next);
  const challengeId = params?.challenge;
  const pendingChallenge = !user && challengeId && !params?.verified
    ? await getPendingLoginChallenge(challengeId)
    : null;
  const verifiedChallenge = !user && challengeId && params?.verified
    ? await getVerifiedLoginChallenge(challengeId)
    : null;
  const challengeExpired = Boolean(challengeId) && !user && !pendingChallenge && !verifiedChallenge;
  const signInError = params?.error
    || (challengeExpired
      ? "That sign-in expired or was already used. Request a new code."
      : null);

  if (!user) {
    return (
      <main className="plc-page">
        {challengeExpired ? (
          <ClearStoredLoginChallenge />
        ) : (
          <Suspense fallback={null}>
            <AuthChallengeRestore />
          </Suspense>
        )}
        <div className="plc-shell grid min-h-[72vh] place-items-center">
          <section className="plc-panel w-full max-w-2xl p-8">
            <p className="plc-eyebrow">Your prayer profile</p>
            <h1 className="brush-small mt-3 text-5xl uppercase leading-none text-white">
              Sign in or create your prayer profile.
            </h1>
            <p className="plc-copy mt-4">
              Enter your email address or phone number. We&apos;ll send you a six-digit sign-in code. If your information
              matches a church record, we&apos;ll help connect your profile to the right person. If it does not, you can
              still create an account. You can also{" "}
              <Link href="/log" className="font-black uppercase text-yellow">
                start praying as a guest
              </Link>
              . Eligible guest prayer counts toward the church campaign but is not saved to personal history.
            </p>

            <div className="mt-4">
              <FormBanner error={signInError} />
            </div>

            {!pendingChallenge && !verifiedChallenge ? (
              <form action={requestLoginCodeAction} className="mt-8 space-y-4">
                {next ? <input type="hidden" name="next" value={next} /> : null}
                <ContactInput />

                <div className="flex flex-wrap gap-3 pt-2">
                  <FormSubmitButton pendingLabel="Sending sign-in code…">Send sign-in code</FormSubmitButton>
                  <Link href="/log" className="plc-button-secondary">
                    Start as a guest
                  </Link>
                </div>
              </form>
            ) : null}

            {pendingChallenge ? (
              <>
                <form action={verifyLoginCodeAction} className="mt-8 space-y-4">
                  <input type="hidden" name="challenge_id" value={pendingChallenge.challengeId} />
                  {next ? <input type="hidden" name="next" value={next} /> : null}
                  <div className="plc-card-muted p-4">
                    <p className="font-black uppercase text-white">Check your email or phone</p>
                    <p className="mt-2 text-sm text-white/75">
                      We sent a six-digit sign-in code to{" "}
                      {maskContact(pendingChallenge.contactType, pendingChallenge.contact)}. The code expires in 10
                      minutes. It may take a few minutes to arrive; check your spam or junk folder if you do not see it.
                    </p>
                    {pendingChallenge.debugCode ? (
                      <p className="mt-3 rounded-lg border border-yellow/40 bg-yellow/10 px-3 py-2 text-sm font-black text-yellow">
                        Local test code: {pendingChallenge.debugCode}
                      </p>
                    ) : null}
                  </div>
                  <label className="block space-y-2">
                    <span className="plc-label">Six-digit sign-in code</span>
                    <input
                      required
                      name="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      className="plc-input w-full px-4 py-3"
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <FormSubmitButton pendingLabel="Signing you in…">Sign me in</FormSubmitButton>
                    <StartOverLink href={authHref(next)} className="plc-button-secondary">
                      Use a different email or mobile
                    </StartOverLink>
                  </div>
                </form>
                <form action={requestLoginCodeAction} className="mt-3">
                  <input type="hidden" name="contact" value={pendingChallenge.contact} />
                  {next ? <input type="hidden" name="next" value={next} /> : null}
                  <FormSubmitButton pendingLabel="Sending a new code…" className="plc-button-secondary">
                    Resend code
                  </FormSubmitButton>
                </form>
              </>
            ) : null}

            {verifiedChallenge && verifiedChallenge.candidates.length > 0 ? (
              <form action={choosePlanningCenterPersonAction} className="mt-8 space-y-4">
                <input type="hidden" name="challenge_id" value={verifiedChallenge.challengeId} />
                {next ? <input type="hidden" name="next" value={next} /> : null}
                <div>
                  <p className="plc-eyebrow">Who are you?</p>
                  <p className="plc-copy mt-2">
                    This {verifiedChallenge.contactType === "email" ? "email address" : "mobile number"} is shared by
                    this household. You may choose any household member who uses it. Select the person whose prayer
                    profile you are opening.
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
                        <span className="text-sm text-white/55">{candidate.householdName ?? "Church profile"}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <FormSubmitButton pendingLabel="Connecting your profile…">Continue with this profile</FormSubmitButton>
                  <StartOverLink href={authHref(next)} className="plc-button-secondary">
                    Use a different email or phone
                  </StartOverLink>
                </div>
              </form>
            ) : null}

            {verifiedChallenge && verifiedChallenge.candidates.length === 0 ? (
              <form action={createUnlinkedAccountAction} className="mt-8 space-y-4">
                <input type="hidden" name="challenge_id" value={verifiedChallenge.challengeId} />
                {next ? <input type="hidden" name="next" value={next} /> : null}
                <div>
                  <p className="plc-eyebrow">Create your account</p>
                  <h2 className="mt-2 text-2xl font-black uppercase text-white">We could not find a matching church record</h2>
                  <p className="plc-copy mt-2">
                    That&apos;s okay. Enter your name to create a prayer profile with{" "}
                    <span className="font-black text-white/80">{maskContact(verifiedChallenge.contactType, verifiedChallenge.contact)}</span>. You can still log
                    minutes and make a campaign prayer pledge. The church team can connect your profile to its church record
                    later if needed.
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
                  <FormSubmitButton pendingLabel="Creating your profile…">Create account &amp; continue</FormSubmitButton>
                  <StartOverLink href={authHref(next)} className="plc-button-secondary">
                    Start over
                  </StartOverLink>
                </div>
              </form>
            ) : null}
          </section>
        </div>
      </main>
    );
  }

  const [snapshot, campaign, fourFriends, pledge, notifyPrefs, notifyEmail] =
    await Promise.all([
      getDashboardSnapshot(user.id),
      getUserCampaignOverview(user.id),
      getPrayerFriendSlots(user.id),
      getLatestPledge(user.id),
      getUserNotificationPreferences(user.id),
      getUserNotifyEmail(user.id)
    ]);

  const pledgeProgress = pledge?.minutesPerWeek
    ? Math.min(100, (snapshot.thisWeekMinutes / pledge.minutesPerWeek) * 100)
    : 0;
  const remainingMinutes = pledge ? Math.max(0, pledge.minutesPerWeek - snapshot.thisWeekMinutes) : 0;
  const minutesBeyondGoal = pledge ? Math.max(0, snapshot.thisWeekMinutes - pledge.minutesPerWeek) : 0;
  const campaignPrayedMinutes = campaign?.totalMinutes ?? 0;
  const preCampaignCreditMinutes = campaign?.preCampaignCreditMinutes ?? 0;
  const campaignRemaining = pledge ? Math.max(0, pledge.committedMinutes - campaignPrayedMinutes) : 0;
  const campaignBeyondCommitment = pledge ? Math.max(0, campaignPrayedMinutes - pledge.committedMinutes) : 0;
  const campaignProgress = pledge?.committedMinutes
    ? Math.min(100, (campaignPrayedMinutes / pledge.committedMinutes) * 100)
    : 0;
  const expectedProgress = pledge?.committedMinutes
    ? Math.min(100, (pledge.expectedMinutes / pledge.committedMinutes) * 100)
    : 0;
  const ringRadius = 62;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - pledgeProgress / 100);
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <main className="plc-page">
      <div className="plc-shell max-w-4xl space-y-7 pb-8">
        <header className="space-y-3">
          <p className="plc-eyebrow">Me</p>
          <h1 className="plc-title">Welcome, {user.name}.</h1>
          {!isSyntheticEmail(user.email) ? <p className="text-base text-white/75">{user.email}</p> : null}
          <FormBanner
            error={!params?.section ? params?.error : null}
            success={params?.session_saved === "1" ? "Prayer session saved." : null}
          />
        </header>

        <section id="progress" className="scroll-mt-24 space-y-4">
          <div>
            <p className="plc-eyebrow">Prayer overview</p>
            <h2 className="mt-2 text-3xl font-black uppercase text-white">Your prayer</h2>
          </div>
          <FormBanner
            error={params?.section === "progress" ? params.error : null}
            success={
              params?.pledge_saved === "1"
                ? "Campaign prayer pledge saved."
                : params?.pledge_removed === "1"
                  ? "Campaign prayer pledge withdrawn. Your prayer history was not changed."
                  : null
            }
          />

          <article className="plc-panel overflow-hidden p-5 sm:p-6">
            <div className="grid items-center gap-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <div
                className="relative mx-auto h-40 w-40 shrink-0"
                role={pledge ? "progressbar" : "img"}
                aria-label={pledge ? `${snapshot.thisWeekMinutes} of ${pledge.minutesPerWeek} minutes toward your weekly pace` : `${snapshot.thisWeekMinutes} prayer minutes this week`}
                aria-valuemin={pledge ? 0 : undefined}
                aria-valuemax={pledge?.minutesPerWeek}
                aria-valuenow={pledge ? Math.min(snapshot.thisWeekMinutes, pledge.minutesPerWeek) : undefined}
              >
                <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" aria-hidden="true">
                  <circle cx="80" cy="80" r={ringRadius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="12" />
                  {pledgeProgress > 0 ? (
                    <circle cx="80" cy="80" r={ringRadius} fill="none" stroke="var(--yellow)" strokeWidth="12" strokeLinecap="round" strokeDasharray={ringCircumference} strokeDashoffset={ringOffset} />
                  ) : null}
                </svg>
                <div className="absolute inset-0 grid place-content-center text-center">
                  <strong className="text-4xl font-black text-white">{formatCount(snapshot.thisWeekMinutes)}</strong>
                  <span className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-white/60">minutes</span>
                </div>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-sm font-black uppercase tracking-[0.12em] text-yellow">This week</p>
                <h3 className="mt-2 text-2xl font-black text-white">
                  {pledge ? `${formatCount(snapshot.thisWeekMinutes)} of ${formatCount(pledge.minutesPerWeek)} minutes` : "Your Sunday–Saturday rhythm"}
                </h3>
                <p className="mt-2 text-sm text-white/60">Sunday–Saturday · Fort Wayne time</p>
                <p className="mt-4 text-base font-black leading-7 text-white">
                  {pledge
                    ? snapshot.thisWeekMinutes >= pledge.minutesPerWeek
                      ? minutesBeyondGoal > 0
                        ? `Weekly pace reached · ${formatCount(minutesBeyondGoal)} extra minutes.`
                        : "Weekly pace reached."
                      : `${formatCount(remainingMinutes)} minutes to your weekly pace.`
                    : "No weekly pace set. Every minute still matters."}
                </p>
              </div>
            </div>

            <ol className="mt-6 grid grid-cols-7 gap-1 border-t border-white/10 pt-5 tabular-nums" aria-label="Prayer minutes by day">
              {snapshot.weekDays.map((day) => {
                const label = dayLabels[day.dayIndex] ?? "Day";
                const isToday = day.dayIndex === snapshot.currentWeekday;
                const isFuture = day.dayIndex > snapshot.currentWeekday;
                return (
                  <li key={day.dayIndex} className="min-w-0 text-center" aria-label={`${label}: ${day.minutes} prayer ${day.minutes === 1 ? "minute" : "minutes"}${isToday ? ", today" : isFuture ? ", upcoming" : ""}`}>
                    <span className={`block text-[0.65rem] font-black uppercase ${isToday ? "text-yellow" : isFuture ? "text-white/30" : "text-white/55"}`}>{label}</span>
                    <span className={`mx-auto mt-2 block h-3 w-3 rounded-full ${day.minutes > 0 ? "bg-yellow shadow-[0_0_14px_rgba(255,211,0,0.45)]" : isToday ? "border-2 border-yellow/70" : isFuture ? "bg-white/5" : "bg-white/10"}`} aria-hidden="true" />
                    <span className={`mt-2 block truncate text-[0.7rem] font-black ${day.minutes > 0 ? "text-white" : "text-white/30"}`} aria-hidden="true">
                      {day.minutes > 999 ? `${(day.minutes / 1000).toFixed(1)}k` : day.minutes > 0 ? formatCount(day.minutes) : "–"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </article>

          <article className="plc-panel p-5 sm:p-6">
            {campaign ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="plc-eyebrow">{campaign.name}</p>
                    <h3 className="mt-2 text-2xl font-black uppercase text-white">{pledge ? "Your campaign commitment" : "Campaign prayer"}</h3>
                  </div>
                  <span className="plc-status">
                    {campaign.campaignEnded
                      ? "Campaign complete"
                      : !campaign.campaignStarted
                        ? `Starts ${formatCampaignDate(campaign.startsOn)}`
                        : campaign.completedInstallments >= campaign.installmentCount
                          ? "Final campaign days"
                          : `Campaign week ${campaign.completedInstallments + 1} of ${campaign.installmentCount}`}
                  </span>
                </div>

                <div className="mt-5">
                  <p className="text-4xl font-black text-yellow">{formatCount(campaignPrayedMinutes)}</p>
                  <p className="mt-1 text-base text-white/75">
                    minutes credited{pledge ? <> toward your <span className="font-black text-white">{formatCount(pledge.committedMinutes)}-minute commitment</span></> : " to this campaign"}
                  </p>
                </div>

                {pledge ? (
                  <>
                    <div className="relative mt-5 h-3 overflow-visible rounded-full bg-black/40" role="progressbar" aria-label={`${campaignPrayedMinutes} of ${pledge.committedMinutes} campaign commitment minutes credited`} aria-valuemin={0} aria-valuemax={pledge.committedMinutes} aria-valuenow={Math.min(campaignPrayedMinutes, pledge.committedMinutes)}>
                      <div className="h-full rounded-full bg-yellow" style={{ width: `${campaignProgress}%` }} />
                      {pledge.campaignStarted && !pledge.campaignEnded ? (
                        <span className="absolute top-[-4px] h-5 w-0.5 bg-white" style={{ left: `${expectedProgress}%` }} title="Scheduled commitment to date" />
                      ) : null}
                    </div>

                    <dl className="mt-6 grid gap-4 sm:grid-cols-3">
                      <div className="plc-card-muted p-4">
                        <dt className="text-xs font-black uppercase tracking-[0.1em] text-white/55">Total commitment</dt>
                        <dd className="mt-2 text-2xl font-black text-white">{formatCount(pledge.committedMinutes)}</dd>
                        <dd className="mt-1 text-xs text-white/50">{pledge.campaignInstallments} campaign weeks</dd>
                      </div>
                      <div className="plc-card-muted p-4">
                        <dt className="text-xs font-black uppercase tracking-[0.1em] text-white/55">
                          Scheduled commitment to date
                        </dt>
                        <dd className="mt-2 text-2xl font-black text-white">{formatCount(pledge.expectedMinutes)}</dd>
                        <dd className="mt-1 text-xs text-white/50">{pledge.completedInstallments} of {pledge.campaignInstallments} campaign weeks complete</dd>
                      </div>
                      <div className="plc-card-muted p-4">
                        <dt className="text-xs font-black uppercase tracking-[0.1em] text-white/55">
                          {pledge.campaignEnded ? "Final result" : campaignBeyondCommitment > 0 ? "Beyond commitment" : "Remaining to fulfill"}
                        </dt>
                        <dd className="mt-2 text-2xl font-black text-white">
                          {formatCount(campaignBeyondCommitment > 0 ? campaignBeyondCommitment : campaignRemaining)}
                        </dd>
                        <dd className="mt-1 text-xs text-white/50">minutes</dd>
                      </div>
                    </dl>

                    <p className="mt-5 text-sm leading-6 text-white/70">
                      {!pledge.campaignStarted
                        ? preCampaignCreditMinutes > 0
                          ? `Your ${formatCount(preCampaignCreditMinutes)} early prayer minutes already count. The ${pledge.campaignInstallments} campaign weeks begin ${formatCampaignDate(pledge.campaignStartsOn)}.`
                          : `The ${pledge.campaignInstallments} campaign weeks begin ${formatCampaignDate(pledge.campaignStartsOn)}.`
                        : pledge.campaignEnded
                          ? campaignBeyondCommitment > 0
                            ? `You prayed ${formatCount(campaignBeyondCommitment)} minutes beyond your campaign commitment.`
                            : campaignRemaining === 0
                              ? "You fulfilled your campaign commitment."
                              : `The campaign closed ${formatCount(campaignRemaining)} minutes below your commitment.`
                          : pledge.expectedMinutes === 0
                            ? `No campaign weeks are complete yet. Your scheduled commitment begins after the first campaign week ends.${preCampaignCreditMinutes > 0 ? ` Includes ${formatCount(preCampaignCreditMinutes)} early prayer minutes.` : ""}`
                            : `${formatCount(Math.abs(campaignPrayedMinutes - pledge.expectedMinutes))} ${campaignPrayedMinutes >= pledge.expectedMinutes ? "more credited minutes than" : "minutes to match"} your scheduled commitment to date.${preCampaignCreditMinutes > 0 ? ` Includes ${formatCount(preCampaignCreditMinutes)} early prayer minutes.` : ""}`}
                    </p>

                    {!pledge.campaignEnded && pledge.futureInstallments > 0 ? (
                      <div className="mt-5 border-t border-white/10 pt-4">
                        <p className="text-sm text-white/65">Current weekly pledge pace: <span className="font-black text-white">{formatCount(pledge.minutesPerWeek)} minutes</span>. Changes apply to future campaign weeks.</p>
                        <UpdatePledgeButton
                          minutesPerWeek={pledge.minutesPerWeek}
                          installmentCount={pledge.campaignInstallments}
                          campaignStarted={pledge.campaignStarted}
                          committedBeforeNextRate={pledge.committedBeforeNextRate}
                          futureInstallments={pledge.futureInstallments}
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70">
                    Your prayer still counts toward the campaign. Make an optional campaign commitment if you want a weekly pace and scheduled commitment comparison.
                  </p>
                )}
              </>
            ) : (
              <p className="text-white/70">Campaign progress is unavailable until campaign dates are configured.</p>
            )}
          </article>
        </section>

        {!campaign?.campaignEnded ? (
          <PledgeSection
            hasPledge={Boolean(pledge)}
            minutesPerWeek={pledge?.minutesPerWeek ?? null}
            installmentCount={campaign?.installmentCount ?? 52}
          />
        ) : null}

        <section id="people" className="scroll-mt-24 space-y-4">
          <FormBanner
            error={params?.section === "people" ? params.error : null}
            success={params?.friends_saved === "1" ? "Four Friends list saved." : null}
          />
          <FourFriendsList initialSlots={fourFriends} />
        </section>

        <section id="settings" className="scroll-mt-24 space-y-4">
          <div>
            <p className="plc-eyebrow">Settings</p>
            <h2 className="mt-2 text-3xl font-black uppercase text-white">Email notifications</h2>
          </div>
          <FormBanner
            error={params?.section === "settings" ? params.error : null}
            success={params?.prefs_saved === "1" ? "Notification preferences saved." : null}
          />
          <NotificationPreferencesForm
            emailPrayerRequestUpdates={notifyPrefs.emailPrayerRequestUpdates}
            emailPledgeInvitations={notifyPrefs.emailPledgeInvitations}
            emailProgressUpdates={notifyPrefs.emailProgressUpdates}
            notifyEmail={notifyEmail}
            hasPledge={Boolean(pledge)}
          />
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 px-4 py-4" aria-label="Church profile status">
          <p className={`font-black ${user.planningCenterPersonId ? "text-yellow" : "text-white"}`}>
            {user.planningCenterPersonId ? "Church profile connected" : "Church profile not connected"}
          </p>
          {!user.planningCenterPersonId ? (
            <p className="mt-1 text-sm leading-6 text-white/70">
              Contact the church office for help connecting your household and church-family prayer lists.
            </p>
          ) : null}
        </section>

        <form action={signOutAction} className="flex justify-center">
          <button type="submit" className="plc-button-secondary min-h-11">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
