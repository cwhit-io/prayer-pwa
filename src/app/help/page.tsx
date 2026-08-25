import type { ReactNode } from "react";
import Link from "next/link";
import { ORG_ADDRESS, ORG_NAME } from "@/app/components/site-footer";
import { getCurrentCampaign } from "@/lib/campaign-model";

export const dynamic = "force-dynamic";

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function FaqItem({ question, children }: { question: string; children: ReactNode }) {
  return (
    <details className="group border-b border-white/10 last:border-b-0">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-black text-white transition hover:text-yellow">
        <span>{question}</span>
        <span className="text-xl text-yellow transition group-open:rotate-45" aria-hidden="true">+</span>
      </summary>
      <div className="pb-5 pr-8 text-base leading-7 text-white/70">{children}</div>
    </details>
  );
}

export default async function HelpPage() {
  const campaign = await getCurrentCampaign();

  return (
    <main className="plc-page">
      <div className="plc-shell max-w-4xl space-y-8">
        <header className="space-y-4">
          <p className="plc-eyebrow">Help and FAQ</p>
          <h1 className="plc-title">How Fort Wayne Prays works</h1>
          <p className="plc-copy max-w-3xl">
            Start praying in a few seconds, understand how minutes and commitments are counted, and learn how your
            account and prayer requests are protected.
          </p>
        </header>

        <nav aria-label="Help topics" className="plc-panel p-4">
          <div className="flex flex-wrap gap-2 text-sm font-black">
            <a href="#start" className="rounded-full border border-white/15 px-4 py-2 text-white/75 hover:border-yellow hover:text-yellow">Get started</a>
            <a href="#timer" className="rounded-full border border-white/15 px-4 py-2 text-white/75 hover:border-yellow hover:text-yellow">Timer and saving</a>
            <a href="#campaign" className="rounded-full border border-white/15 px-4 py-2 text-white/75 hover:border-yellow hover:text-yellow">Campaign progress</a>
            <a href="#privacy" className="rounded-full border border-white/15 px-4 py-2 text-white/75 hover:border-yellow hover:text-yellow">Privacy</a>
            <a href="#faq" className="rounded-full border border-white/15 px-4 py-2 text-white/75 hover:border-yellow hover:text-yellow">FAQ</a>
          </div>
        </nav>

        <section id="start" className="scroll-mt-24 space-y-4" aria-labelledby="start-title">
          <div>
            <p className="plc-eyebrow">Get started</p>
            <h2 id="start-title" className="mt-2 text-3xl font-black uppercase text-white">Choose how you want to pray</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="plc-panel p-5">
              <h3 className="text-xl font-black text-white">Pray with a timer</h3>
              <p className="mt-2 leading-7 text-white/70">Use the simple timer for prayer happening now. You can pray freely or choose a person, idea, or community request as your focus.</p>
              <Link href="/log" className="mt-4 inline-flex font-black text-yellow">Open the prayer timer</Link>
            </article>
            <article className="plc-panel p-5">
              <h3 className="text-xl font-black text-white">Use guided prayer</h3>
              <p className="mt-2 leading-7 text-white/70">Guided prayer follows ACTS: Adoration, Confession, Thanksgiving, and Supplication. The shared timer begins automatically.</p>
              <Link href="/guided-prayer" className="mt-4 inline-flex font-black text-yellow">Start guided prayer</Link>
            </article>
            <article className="plc-panel p-5">
              <h3 className="text-xl font-black text-white">Add prayer completed earlier</h3>
              <p className="mt-2 leading-7 text-white/70">Already prayed without the timer? Record the date and whole number of minutes without starting another session.</p>
              <Link href="/add-time" className="mt-4 inline-flex font-black text-yellow">Add completed time</Link>
            </article>
            <article className="plc-panel p-5">
              <h3 className="text-xl font-black text-white">Choose someone to pray for</h3>
              <p className="mt-2 leading-7 text-white/70">Select one of your Four Friends, your household, or your church family. Group focuses carry every listed name into the prayer experience.</p>
              <Link href="/people" className="mt-4 inline-flex font-black text-yellow">Choose a person or group</Link>
            </article>
          </div>
        </section>

        <section id="timer" className="plc-panel scroll-mt-24 p-6" aria-labelledby="timer-title">
          <p className="plc-eyebrow">Timer and saving</p>
          <h2 id="timer-title" className="mt-2 text-3xl font-black uppercase text-white">Reliable prayer time</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className="text-lg font-black text-white">Screen-off time counts</h3>
              <p className="mt-1 leading-7 text-white/70">The timer uses timestamps, so it continues accurately while your screen sleeps. A supported device may also keep the screen awake while prayer is active.</p>
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Interrupted sessions recover</h3>
              <p className="mt-1 leading-7 text-white/70">An active timer is stored for your signed-in account on that device. Refreshing the page or reopening the app restores the elapsed time, focus, and notes.</p>
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Saving is deliberate</h3>
              <p className="mt-1 leading-7 text-white/70">Pause or finish when you are ready, then save. If a network request fails, your unsaved prayer remains available so you can try again.</p>
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Session limits are safeguards</h3>
              <p className="mt-1 leading-7 text-white/70">The timer pauses at the configured session limit instead of running indefinitely. You can continue intentionally when the app offers an extension.</p>
            </div>
          </div>
          <p className="mt-5 rounded-xl border border-yellow/25 bg-yellow/10 px-4 py-3 text-sm leading-6 text-white/80">
            Timer sessions are saved as at least one minute and round up to the nearest whole minute. Earlier-prayer entries use the whole minutes you enter.
          </p>
        </section>

        <section id="campaign" className="plc-panel scroll-mt-24 p-6" aria-labelledby="campaign-title">
          <p className="plc-eyebrow">Campaign progress</p>
          <h2 id="campaign-title" className="mt-2 text-3xl font-black uppercase text-white">Commitment and completed prayer</h2>
          {campaign ? (
            <p className="mt-3 text-base leading-7 text-white/70">
              The current church campaign is working toward <span className="font-black text-white">{formatCount(campaign.goalMinutes)} minutes</span>.
              Prayer has been accepted for early credit since <span className="font-black text-white">{formatDate(campaign.prayerCreditStartsOn)}</span>.
              The {campaign.installmentCount} campaign weeks run from <span className="font-black text-white">{formatDate(campaign.startsOn)}</span> through <span className="font-black text-white">{formatDate(campaign.endsOn)}</span>.
            </p>
          ) : (
            <p className="mt-3 text-base leading-7 text-white/70">Campaign dates and totals will appear after the church configures the campaign.</p>
          )}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="plc-card-muted p-4">
              <h3 className="font-black text-white">Minutes committed</h3>
              <p className="mt-1 text-sm leading-6 text-white/65">A campaign pledge begins with a weekly pace. The app applies that pace across the campaign weeks to calculate a total commitment.</p>
            </div>
            <div className="plc-card-muted p-4">
              <h3 className="font-black text-white">Minutes credited</h3>
              <p className="mt-1 text-sm leading-6 text-white/65">These are minutes actually recorded and attributed to the campaign. Approved prayer before the official campaign-week schedule begins remains credited without changing its original date.</p>
            </div>
            <div className="plc-card-muted p-4">
              <h3 className="font-black text-white">Scheduled commitment to date</h3>
              <p className="mt-1 text-sm leading-6 text-white/65">This includes only completed seven-day campaign weeks. The current campaign week is not prorated.</p>
            </div>
            <div className="plc-card-muted p-4">
              <h3 className="font-black text-white">Weekly and lifetime prayer</h3>
              <p className="mt-1 text-sm leading-6 text-white/65">The Me page separately shows your Sunday–Saturday rhythm, campaign accounting, and lifetime saved prayer. These totals can be different because they cover different periods.</p>
            </div>
          </div>
        </section>

        <section id="privacy" className="scroll-mt-24 space-y-4" aria-labelledby="privacy-title">
          <div>
            <p className="plc-eyebrow">Privacy and accounts</p>
            <h2 id="privacy-title" className="mt-2 text-3xl font-black uppercase text-white">What other people can see</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="plc-panel p-5">
              <h3 className="text-xl font-black text-white">Guest prayer</h3>
              <p className="mt-2 leading-7 text-white/70">Eligible guest prayer counts toward the church campaign but is not attached to a person. Guests do not receive personal history, private notes, people lists, or pledge progress.</p>
            </article>
            <article className="plc-panel p-5">
              <h3 className="text-xl font-black text-white">Personal history and notes</h3>
              <p className="mt-2 leading-7 text-white/70">Signed-in prayer is saved to your profile. Session notes appear in your personal recent activity and are not posted to the public site or community board.</p>
            </article>
            <article className="plc-panel p-5">
              <h3 className="text-xl font-black text-white">Campaign pledges</h3>
              <p className="mt-2 leading-7 text-white/70">If you include your commitment in the church total, the public sees only aggregate committed minutes and participant counts, not your name or amount. Authorized staff systems may still retain individual accounting.</p>
            </article>
            <article className="plc-panel p-5">
              <h3 className="text-xl font-black text-white">Prayer requests</h3>
              <p className="mt-2 leading-7 text-white/70">Community requests are limited to signed-in directory-connected participants and may be reviewed before publication. Private requests stay off the community board and remain confidential between their owner and authorized church leaders.</p>
              <Link href="/requests/mine" className="mt-4 inline-flex font-black text-yellow">View or share my requests</Link>
            </article>
          </div>
        </section>

        <section id="faq" className="plc-panel scroll-mt-24 px-5 py-6 sm:px-6" aria-labelledby="faq-title">
          <p className="plc-eyebrow">Frequently asked questions</p>
          <h2 id="faq-title" className="mt-2 text-3xl font-black uppercase text-white">Questions and answers</h2>
          <div className="mt-5 border-t border-white/10">
            <FaqItem question="Do I need an account to pray?">
              No. You can use the timer as a guest. Sign in if you want prayer saved to your personal history, private notes, a campaign pledge, Four Friends, household and church-family lists, or access to protected prayer requests.
            </FaqItem>
            <FaqItem question="What prayer counts toward the campaign?">
              Prayer sessions attributed to the current campaign count toward its total. For this campaign, that includes approved early prayer credit as well as prayer during the official campaign dates. The original prayer date is preserved.
            </FaqItem>
            <FaqItem question="Will the timer keep counting if my screen turns off?">
              Yes. The elapsed time is based on timestamps rather than only an on-screen counter. If the browser suspends or closes the page, reopen the prayer page on the same device to restore an unsaved active timer.
            </FaqItem>
            <FaqItem question="What happens if saving fails?">
              The app pauses the timer and keeps the unsaved session available. Check your connection and try saving again. A unique session identifier prevents the same timer session from being added twice when a request is retried.
            </FaqItem>
            <FaqItem question="Why are my weekly rhythm and campaign weeks different?">
              Your personal weekly rhythm always runs Sunday through Saturday in Fort Wayne time. Campaign weeks are seven-day periods measured from the campaign’s official start date, so their boundaries may differ. The Me page labels them separately to make that distinction clear.
            </FaqItem>
            <FaqItem question="How is my campaign commitment calculated?">
              Your selected weekly pledge pace applies across the campaign weeks. Before launch, the same pace applies to all campaign weeks. After launch, changes apply only to future campaign weeks while earlier rates remain part of the commitment history.
            </FaqItem>
            <FaqItem question="Can I change or withdraw my pledge?">
              Yes, while future campaign weeks remain. Open Me, find Your campaign commitment, and choose Update campaign pledge. A withdrawal preserves your prayer history and prior accounting rather than deleting it.
            </FaqItem>
            <FaqItem question="Does early prayer reduce what remains on my pledge?">
              Yes. Early prayer credited to the campaign is completed prayer, so it reduces the remaining minutes shown for your campaign commitment even before the campaign weeks begin.
            </FaqItem>
            <FaqItem question="Who can see my prayer request?">
              You choose. A community request can be viewed by directory-connected participants. A private request remains confidential between you and authorized church leaders. Community requests can hide your name from other members, though authorized church leaders can identify the submitter when care or moderation requires it.
            </FaqItem>
            <FaqItem question="Why can’t I see the community board or church-family list?">
              Those features require your prayer account to be connected to the church directory. You can still pray, save personal history, manage Four Friends, and send a private request while the church office helps connect your profile.
            </FaqItem>
            <FaqItem question="Are people notified when I add them to Four Friends?">
              No. Four Friends is a private list in your signed-in prayer profile for intentionally praying that each friend will know Jesus. The people you enter are not notified.
            </FaqItem>
            <FaqItem question="Why does lifetime prayer differ from campaign prayer?">
              Lifetime prayer includes every saved session attached to your profile. Campaign prayer includes only sessions credited to the current campaign. Weekly prayer covers only the current Sunday–Saturday period.
            </FaqItem>
          </div>
        </section>

        <section className="plc-panel p-6">
          <p className="plc-eyebrow">Support</p>
          <h2 className="mt-2 text-2xl font-black uppercase text-white">Still need help?</h2>
          <p className="plc-copy mt-2">Contact {ORG_NAME} if your identity, household, church profile, or notification email is not connected correctly.</p>
          <p className="mt-3 text-base text-white">{ORG_ADDRESS}</p>
          <a href="https://blackhawkministries.org" className="mt-4 inline-flex font-black text-yellow" target="_blank" rel="noreferrer">Visit Blackhawk Ministries</a>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href="/log" className="plc-button">Start praying</Link>
          <Link href="/auth" className="plc-button-secondary">Open Me</Link>
          <Link href="/" className="plc-button-secondary">Return home</Link>
        </div>
      </div>
    </main>
  );
}
