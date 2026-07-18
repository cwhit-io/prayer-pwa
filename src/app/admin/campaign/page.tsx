import Link from "next/link";
import { FormBanner } from "@/app/components/form-banner";
import {
  createApiTokenAction,
  revokeApiTokenAction,
  saveCampaignSettingsAction
} from "./actions";
import { listApiTokens } from "@/lib/api-tokens";
import { getCurrentUser } from "@/lib/auth";
import { getCampaignProgressSnapshot } from "@/lib/campaign";
import { SITE_URL } from "@/app/components/site-footer";

export const dynamic = "force-dynamic";

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDateLabel(value: string | null) {
  if (!value) {
    return "Not set";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export default async function AdminCampaignPage({
  searchParams
}: {
  searchParams?: Promise<{
    error?: string;
    saved?: string;
    token_created?: string;
    token_value?: string;
    token_name?: string;
    token_revoked?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;

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
        </section>
      </main>
    );
  }

  const [progress, tokens] = await Promise.all([
    getCampaignProgressSnapshot(),
    listApiTokens()
  ]);
  const { settings, stats, calendar, minutesProgressPercent, expectedMinutesByNow, paceDelta, aheadOfPace } =
    progress;

  const baseUrl = SITE_URL.replace(/\/$/, "");
  const activeTokens = tokens.filter((token) => !token.revokedAt);

  return (
    <main className="plc-page">
      <div className="plc-shell-wide space-y-8">
        <header className="space-y-3">
          <p className="plc-eyebrow">Admin · Campaign</p>
          <h1 className="plc-title">Campaign settings &amp; integrations</h1>
          <p className="plc-copy max-w-3xl">
            Dates and goal pacing, PRAY display options, and authenticated APIs for external services to push
            campaign and ACTS prompts.
          </p>
          <FormBanner
            error={params?.error}
            success={
              params?.saved === "1"
                ? "Campaign settings saved."
                : params?.token_revoked === "1"
                  ? "API token revoked."
                  : null
            }
          />
        </header>

        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="plc-panel p-6">
            <h2 className="text-2xl font-black uppercase text-paper">Campaign window</h2>
            <p className="plc-copy mt-2">
              Set the campaign window so pledge totals and pace metrics use the real timeline.
            </p>

            <form action={saveCampaignSettingsAction} className="mt-6 space-y-4">
              <label className="plc-label block space-y-2">
                <span>Start date</span>
                <input
                  name="start_date"
                  type="date"
                  defaultValue={settings.startDate ?? ""}
                  className="plc-input w-full px-4 py-3"
                />
              </label>
              <label className="plc-label block space-y-2">
                <span>End date</span>
                <input
                  name="end_date"
                  type="date"
                  defaultValue={settings.endDate ?? ""}
                  className="plc-input w-full px-4 py-3"
                />
              </label>
              <label className="plc-label block space-y-2">
                <span>Goal minutes</span>
                <input
                  required
                  name="goal_minutes"
                  type="number"
                  min="1"
                  defaultValue={settings.goalMinutes}
                  className="plc-input w-full px-4 py-3"
                />
              </label>
              <label className="plc-label block space-y-2">
                <span>Max session minutes (soft cap)</span>
                <input
                  required
                  name="max_session_minutes"
                  type="number"
                  min="5"
                  max="1440"
                  defaultValue={settings.maxSessionMinutes}
                  className="plc-input w-full px-4 py-3"
                />
                <span className="text-xs font-normal normal-case tracking-normal text-muted">
                  Timer auto-pauses at this length; the person can extend or save.
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-paper/10 bg-night-deep/40 p-4 text-sm text-paper/85">
                <input
                  name="show_acts_tags"
                  type="checkbox"
                  defaultChecked={settings.showActsTags}
                  className="plc-checkbox mt-0.5"
                />
                <span>
                  <span className="block font-black uppercase text-paper">
                    Show tags on A–C–T–S steps
                  </span>
                  <span className="mt-1 block text-xs normal-case tracking-normal text-muted">
                    When enabled, shared tags appear on each step card on the PRAY page (Adoration through
                    Supplication). Matching still works either way.
                  </span>
                </span>
              </label>

              <button className="plc-button">Save campaign settings</button>
            </form>
          </section>

          <section className="space-y-4">
            <article className="plc-panel p-6">
              <p className="plc-eyebrow">Progress snapshot</p>
              <h2 className="mt-2 text-2xl font-black uppercase text-white">Minutes vs calendar</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="plc-card-muted p-4">
                  <p className="text-xs font-black uppercase text-white/45">Minutes progress</p>
                  <p className="mt-2 text-3xl font-black text-yellow">{minutesProgressPercent.toFixed(1)}%</p>
                  <p className="mt-1 text-sm text-white/55">
                    {formatCount(stats.totalMinutes)} / {formatCount(settings.goalMinutes)}
                  </p>
                </div>
                <div className="plc-card-muted p-4">
                  <p className="text-xs font-black uppercase text-white/45">Calendar progress</p>
                  <p className="mt-2 text-3xl font-black text-white">
                    {calendar.hasDates ? `${calendar.calendarProgressPercent.toFixed(1)}%` : "—"}
                  </p>
                  <p className="mt-1 text-sm text-white/55">
                    {calendar.hasDates
                      ? `${calendar.elapsedDays} of ${calendar.totalDays} days · ${calendar.remainingDays} left`
                      : "Set start + end dates"}
                  </p>
                </div>
                <div className="plc-card-muted p-4">
                  <p className="text-xs font-black uppercase text-white/45">Expected by now</p>
                  <p className="mt-2 text-3xl font-black text-white">
                    {calendar.hasDates ? formatCount(expectedMinutesByNow) : "—"}
                  </p>
                  <p className="mt-1 text-sm text-white/55">Linear pace to the goal</p>
                </div>
                <div className="plc-card-muted p-4">
                  <p className="text-xs font-black uppercase text-white/45">Pace</p>
                  <p className={`mt-2 text-3xl font-black ${aheadOfPace ? "text-yellow" : "text-white"}`}>
                    {calendar.hasDates
                      ? `${paceDelta >= 0 ? "+" : ""}${formatCount(paceDelta)}`
                      : "—"}
                  </p>
                  <p className="mt-1 text-sm text-white/55">
                    {calendar.hasDates
                      ? aheadOfPace
                        ? "Minutes ahead of pace"
                        : "Minutes behind pace"
                      : "Needs campaign dates"}
                  </p>
                </div>
              </div>
            </article>

            <article className="plc-panel p-6">
              <p className="plc-eyebrow">Window</p>
              <div className="mt-3 space-y-2 text-sm text-white/70">
                <p>
                  <span className="font-black uppercase text-white/45">Start · </span>
                  {formatDateLabel(settings.startDate)}
                </p>
                <p>
                  <span className="font-black uppercase text-white/45">End · </span>
                  {formatDateLabel(settings.endDate)}
                </p>
                <p>
                  <span className="font-black uppercase text-white/45">Goal · </span>
                  {formatCount(settings.goalMinutes)} minutes
                </p>
                <p>
                  <span className="font-black uppercase text-white/45">Session soft cap · </span>
                  {settings.maxSessionMinutes} minutes
                </p>
                <p>
                  <span className="font-black uppercase text-white/45">ACTS tags on PRAY · </span>
                  {settings.showActsTags ? "Shown" : "Hidden"}
                </p>
              </div>
            </article>
          </section>
        </div>

        {/* API tokens + docs */}
        <section className="grid gap-8 lg:grid-cols-2">
          <article className="plc-panel p-6">
            <h2 className="text-2xl font-black uppercase text-paper">API tokens</h2>
            <p className="plc-copy mt-2">
              External services authenticate with{" "}
              <code className="text-yellow">Authorization: Bearer &lt;token&gt;</code>. Tokens are stored hashed;
              the full secret is shown only once when created.
            </p>

            {params?.token_created === "1" && params.token_value ? (
              <div className="mt-4 rounded-xl border border-yellow/40 bg-yellow/10 p-4">
                <p className="text-sm font-black uppercase text-yellow">Copy this token now</p>
                <p className="mt-1 text-xs text-muted">
                  {params.token_name ? `“${params.token_name}” · ` : ""}
                  It will not be shown again.
                </p>
                <code className="mt-3 block break-all rounded-lg bg-night-deep p-3 font-mono text-sm text-paper">
                  {params.token_value}
                </code>
              </div>
            ) : null}

            <form action={createApiTokenAction} className="mt-5 flex flex-wrap items-end gap-3">
              <label className="plc-label min-w-[12rem] flex-1 space-y-2">
                <span>Token name</span>
                <input
                  name="token_name"
                  placeholder="Zapier · Content team"
                  className="plc-input w-full px-4 py-3"
                />
              </label>
              <button className="plc-button" type="submit">
                Generate token
              </button>
            </form>

            <div className="mt-6 space-y-3">
              {tokens.length === 0 ? (
                <p className="text-sm text-muted">No API tokens yet.</p>
              ) : (
                tokens.map((token) => (
                  <div
                    key={token.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-paper/10 bg-night-deep/50 px-4 py-3"
                  >
                    <div>
                      <p className="font-black text-paper">{token.name}</p>
                      <p className="mt-1 font-mono text-xs text-muted">
                        {token.tokenPrefix}… · created {formatDateTime(token.createdAt)}
                        {token.lastUsedAt ? ` · last used ${formatDateTime(token.lastUsedAt)}` : ""}
                        {token.revokedAt ? " · revoked" : ""}
                      </p>
                    </div>
                    {!token.revokedAt ? (
                      <form action={revokeApiTokenAction}>
                        <input type="hidden" name="token_id" value={token.id} />
                        <button type="submit" className="plc-button-secondary">
                          Revoke
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs font-black uppercase text-danger">Revoked</span>
                    )}
                  </div>
                ))
              )}
            </div>
            <p className="mt-4 text-xs text-muted">
              {activeTokens.length} active token{activeTokens.length === 1 ? "" : "s"}
            </p>
          </article>

          <article className="plc-panel p-6">
            <h2 className="text-2xl font-black uppercase text-paper">API documentation</h2>
            <p className="plc-copy mt-2">
              Base URL:{" "}
              <code className="break-all text-yellow">{baseUrl}</code>
            </p>

            <div className="mt-5 space-y-5 text-sm text-paper/85">
              <div>
                <p className="font-black uppercase text-yellow">Authentication</p>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-night-deep p-3 font-mono text-xs text-muted">
{`Authorization: Bearer plc_…your_token…`}
                </pre>
              </div>

              <div>
                <p className="font-black uppercase text-yellow">Create campaign prompt</p>
                <p className="mt-1 text-muted">POST /api/v1/campaign-prompts</p>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-night-deep p-3 font-mono text-xs leading-5 text-muted">
{`curl -X POST ${baseUrl}/api/v1/campaign-prompts \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Pray for families",
    "body": "Ask God to strengthen homes…",
    "tags": ["Family", "Friends"],
    "scriptureReference": "Joshua 24:15",
    "scriptureText": "…",
    "publishDate": "2026-07-12",
    "isActive": true
  }'`}
                </pre>
                <p className="mt-2 text-xs text-muted">
                  Required: <code className="text-paper/70">title</code>,{" "}
                  <code className="text-paper/70">body</code>,{" "}
                  <code className="text-paper/70">tags</code> (array, ≥1 topical tags). Do not use Adoration,
                  Confession, Thanksgiving, or Supplication as tags — those are ACTS steps only. Optional: scripture
                  fields, publishDate (YYYY-MM-DD), isActive (default true).
                </p>
              </div>

              <div>
                <p className="font-black uppercase text-yellow">Create ACTS prompt</p>
                <p className="mt-1 text-muted">POST /api/v1/acts-prompts</p>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-night-deep p-3 font-mono text-xs leading-5 text-muted">
{`curl -X POST ${baseUrl}/api/v1/acts-prompts \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "step": "A",
    "title": "The Lord is good",
    "body": "Adore God for His goodness…",
    "tags": ["Family"],
    "scriptureReference": "Nahum 1:7",
    "scriptureText": "The Lord is good…",
    "isActive": true
  }'`}
                </pre>
                <p className="mt-2 text-xs text-muted">
                  Required: <code className="text-paper/70">step</code> (A/C/T or Adoration/Confession/Thanksgiving),{" "}
                  <code className="text-paper/70">title</code>, <code className="text-paper/70">body</code>. Optional:{" "}
                  topical <code className="text-paper/70">tags</code> (not step names), scripture fields, isActive.
                </p>
              </div>

              <div>
                <p className="font-black uppercase text-yellow">Responses</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
                  <li>
                    <code className="text-paper/70">201</code> — created; body includes{" "}
                    <code className="text-paper/70">id</code>
                  </li>
                  <li>
                    <code className="text-paper/70">401</code> — missing/invalid token
                  </li>
                  <li>
                    <code className="text-paper/70">400</code> — validation error
                  </li>
                </ul>
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
