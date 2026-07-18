import Link from "next/link";
import { FormBanner } from "@/app/components/form-banner";
import { getCurrentUser } from "@/lib/auth";
import {
  BOARD_DELAY_MAX_MINUTES,
  BOARD_DELAY_MIN_MINUTES,
  listModerationBlocklist,
  listModerationKeywords
} from "@/lib/moderation";
import {
  DEFAULT_CATEGORY_THRESHOLDS,
  getOpenAIModerationThresholds
} from "@/lib/openai-moderation";
import { getPendingBoardReviewRequests } from "@/lib/prayer-requests";
import { getOpenAICredentials } from "@/lib/settings";
import {
  approveBoardRequestAction,
  rejectBoardRequestAction,
  saveBlocklistAction,
  saveKeywordListAction,
  saveOpenAIKeyAction,
  saveOpenAIThresholdsAction
} from "./actions";
import { ModerationTester } from "./moderation-tester";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function maskKey(key: string | null) {
  if (!key) {
    return null;
  }
  if (key.length <= 8) {
    return "••••••••";
  }
  return `${key.slice(0, 3)}…${key.slice(-4)}`;
}

export default async function AdminModerationPage({
  searchParams
}: {
  searchParams?: Promise<{
    error?: string;
    approved?: string;
    rejected?: string;
    keyword_saved?: string;
    blocklist_saved?: string;
    openai_saved?: string;
    thresholds_saved?: string;
    reset?: string;
    count?: string;
    test_title?: string;
    test_body?: string;
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

  const [pending, keywords, blocklist, openai, thresholds] = await Promise.all([
    getPendingBoardReviewRequests(),
    listModerationKeywords(),
    listModerationBlocklist(),
    getOpenAICredentials(),
    getOpenAIModerationThresholds()
  ]);

  const keywordListText = keywords
    .filter((item) => item.isActive)
    .map((item) => item.keyword)
    .join(", ");
  const blocklistText = blocklist
    .filter((item) => item.isActive)
    .map((item) => item.keyword)
    .join(", ");

  return (
    <main className="plc-page">
      <div className="plc-shell-wide space-y-8">
        <header className="space-y-3">
          <p className="plc-eyebrow">Admin</p>
          <h1 className="plc-title">Request moderation.</h1>
          <p className="plc-copy max-w-3xl">
            Three layers run on every new prayer request, in order:
          </p>
          <ol className="plc-copy max-w-3xl list-decimal space-y-1 pl-5">
            <li>
              <strong className="text-paper/80">Hard block list</strong> — profanity / vulgar /
              spam → not saved; “Please reword this before submitting.”
            </li>
            <li>
              <strong className="text-paper/80">OpenAI Moderation</strong> — score-based routing
              (self-harm, sexual, minors, violence, harassment, hate…) → block or private review.
            </li>
            <li>
              <strong className="text-paper/80">Leadership list</strong> — pastor / staff / lawsuit
              / allegation terms → private review queue (request is saved).
            </li>
          </ol>
          <p className="plc-copy max-w-3xl text-sm text-muted">
            Clean community posts are scheduled randomly ({BOARD_DELAY_MIN_MINUTES}–
            {Math.round(BOARD_DELAY_MAX_MINUTES / 60)} hours) before they appear on the board.
          </p>
          <FormBanner
            error={params?.error}
            success={
              params?.approved === "1"
                ? "Request approved."
                : params?.rejected === "1"
                  ? "Request rejected."
                  : params?.keyword_saved === "1"
                    ? `Leadership list saved${params.count != null ? ` (${params.count} terms)` : ""}.`
                    : params?.blocklist_saved === "1"
                      ? `Block list saved${params.count != null ? ` (${params.count} terms)` : ""}.`
                      : params?.openai_saved === "1"
                        ? "OpenAI API key settings saved."
                        : params?.thresholds_saved === "1"
                          ? params?.reset === "1"
                            ? "Score thresholds reset to defaults."
                            : "OpenAI score thresholds saved."
                          : null
            }
          />
          <div className="flex flex-wrap gap-2">
            <a href="/admin/moderation/export" className="plc-button-secondary">
              Download leadership list CSV
            </a>
            <Link href="/admin/requests" className="plc-button-secondary">
              All requests
            </Link>
          </div>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-black uppercase text-white">
            Private review queue {pending.length > 0 ? `(${pending.length})` : ""}
          </h2>
          <p className="plc-copy max-w-3xl text-sm">
            Community posts held by OpenAI scores or the leadership list. Approve to publish now,
            or keep off the board (request stays for the prayer team as private). Use{" "}
            <strong className="text-paper/80">Retest</strong> to dry-run the pipeline on a queue
            item’s text.
          </p>
          {pending.length > 0 ? (
            pending.map((request) => {
              const retestHref = `/admin/moderation?test_title=${encodeURIComponent(request.title)}&test_body=${encodeURIComponent(request.body)}#moderation-tester`;
              return (
                <article key={request.id} className="plc-panel border-yellow/25 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black uppercase text-yellow">{request.category}</p>
                      <h3 className="mt-1 text-xl font-black text-white">{request.title}</h3>
                      <p className="mt-1 text-sm text-white/50">
                        {request.isAnonymous ? "Anonymous" : request.requesterName ?? "Unknown"} ·{" "}
                        {formatDate(request.createdAt)}
                      </p>
                      {request.matchedKeywords ? (
                        <p className="mt-2 text-xs font-black uppercase tracking-wide text-yellow">
                          Matched: {request.matchedKeywords}
                        </p>
                      ) : null}
                      {request.moderationNotes ? (
                        <p className="mt-1 text-xs text-white/45">{request.moderationNotes}</p>
                      ) : null}
                    </div>
                    <span className="plc-status">Needs attention</span>
                  </div>
                  <p className="mt-4 leading-7 text-white/75">{request.body}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <form action={approveBoardRequestAction}>
                      <input type="hidden" name="id" value={request.id} />
                      <button className="plc-button">Approve to board now</button>
                    </form>
                    <form action={rejectBoardRequestAction}>
                      <input type="hidden" name="id" value={request.id} />
                      <button className="plc-button-secondary">Keep off board</button>
                    </form>
                    <a href={retestHref} className="plc-button-secondary">
                      Retest pipeline
                    </a>
                  </div>
                </article>
              );
            })
          ) : (
            <article className="plc-panel p-6">
              <p className="plc-copy">No posts waiting in the private review queue.</p>
            </article>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <article className="plc-panel border-danger/30 p-6">
            <p className="text-xs font-black uppercase tracking-widest text-danger">Tier 1</p>
            <h2 className="mt-1 text-xl font-black uppercase text-danger">Hard block list</h2>
            <p className="plc-copy mt-2 text-sm">
              Profanity, vulgar sexual language, spam. Request is{" "}
              <strong className="text-paper/80">not saved</strong>. User sees: “Please reword this
              before submitting.”
            </p>
            <form action={saveBlocklistAction} className="mt-5 space-y-4">
              <label className="plc-label block space-y-2">
                <span>Blocked terms</span>
                <textarea
                  name="blocklist"
                  rows={10}
                  defaultValue={blocklistText}
                  placeholder="profanity, spam phrases, …"
                  className="plc-input min-h-[12rem] w-full px-4 py-3 font-mono text-sm normal-case tracking-normal"
                />
              </label>
              <p className="text-xs text-muted">
                {blocklist.filter((k) => k.isActive).length} active · empty disables hard blocks
              </p>
              <button className="plc-button" type="submit">
                Save block list
              </button>
            </form>
          </article>

          <article className="plc-panel border-yellow/30 p-6">
            <p className="text-xs font-black uppercase tracking-widest text-yellow">Tier 2</p>
            <h2 className="mt-1 text-xl font-black uppercase text-yellow">OpenAI Moderation</h2>
            <p className="plc-copy mt-2 text-sm">
              Score-based routing via <code className="text-paper/70">omni-moderation-latest</code>
              : sexual/minors → block; self-harm / violence / harassment / hate / illicit → private
              review. Fail-open if the API is down (lists still apply).
            </p>
            <div className="mt-4 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm">
              <p className="font-black uppercase tracking-wide text-paper/80">
                Status:{" "}
                {openai.configured ? (
                  <span className="text-green-400">Configured</span>
                ) : (
                  <span className="text-danger">Not configured</span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted">
                Source: {openai.source}
                {openai.apiKey ? ` · ${maskKey(openai.apiKey)}` : ""}
              </p>
            </div>
            <form action={saveOpenAIKeyAction} className="mt-5 space-y-4">
              <label className="plc-label block space-y-2">
                <span>OpenAI API key</span>
                <input
                  type="password"
                  name="openai_api_key"
                  autoComplete="off"
                  placeholder={openai.configured ? "•••• leave blank to keep" : "sk-…"}
                  className="plc-input w-full px-4 py-3 font-mono text-sm normal-case tracking-normal"
                />
              </label>
              {openai.source === "database" ? (
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" name="clear_openai_key" value="true" />
                  Clear stored key (fall back to env if set)
                </label>
              ) : null}
              <p className="text-xs text-muted">
                Also accepted via <code className="text-paper/60">OPENAI_API_KEY</code> env. Free
                Moderations endpoint only — not chat completions.
              </p>
              <button className="plc-button" type="submit">
                Save OpenAI key
              </button>
            </form>
          </article>

          <article className="plc-panel p-6">
            <p className="text-xs font-black uppercase tracking-widest text-paper/60">Tier 3</p>
            <h2 className="mt-1 text-xl font-black uppercase text-paper">Leadership list</h2>
            <p className="plc-copy mt-2 text-sm">
              Church-specific terms (Blackhawk, pastor, elder, staff, lawsuit, abuse allegation…).
              Request is <strong className="text-paper/80">saved</strong> and held in the private
              review queue above.
            </p>
            <form action={saveKeywordListAction} className="mt-5 space-y-4">
              <label className="plc-label block space-y-2">
                <span>Leadership / supplemental terms</span>
                <textarea
                  name="keywords"
                  rows={10}
                  defaultValue={keywordListText}
                  placeholder="blackhawk, pastor, elder, staff, lawsuit, …"
                  className="plc-input min-h-[12rem] w-full px-4 py-3 font-mono text-sm normal-case tracking-normal"
                />
              </label>
              <p className="text-xs text-muted">
                {keywords.filter((k) => k.isActive).length} active · empty disables this layer
              </p>
              <button className="plc-button" type="submit">
                Save leadership list
              </button>
            </form>
          </article>
        </section>

        <section className="plc-panel border-yellow/20 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-yellow">Tier 2 · scores</p>
              <h2 className="mt-1 text-2xl font-black uppercase text-white">OpenAI score thresholds</h2>
              <p className="plc-copy mt-2 max-w-3xl text-sm">
                Each OpenAI category has a <strong className="text-paper/80">review</strong> score
                (save + hold) and optional <strong className="text-paper/80">block</strong> score
                (reject / reword). Leave block empty for categories that must never auto-discard
                (e.g. sexual/minors, self-harm). Scores are 0–1; lower = more sensitive.
              </p>
            </div>
          </div>

          <form action={saveOpenAIThresholdsAction} className="mt-6 space-y-5">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/15 text-xs font-black uppercase tracking-wide text-paper/55">
                    <th className="py-2 pr-3">OpenAI category</th>
                    <th className="py-2 pr-3">Review ≥</th>
                    <th className="py-2 pr-3">Block ≥</th>
                    <th className="py-2 pr-3">Urgent</th>
                    <th className="py-2">Recommended action</th>
                  </tr>
                </thead>
                <tbody>
                  {thresholds.categories.map((row) => {
                    const def = DEFAULT_CATEGORY_THRESHOLDS.find((d) => d.category === row.category);
                    const neverBlock = def?.block === null;
                    return (
                      <tr key={row.category} className="border-b border-white/10 align-top">
                        <td className="py-3 pr-3">
                          <span className="font-mono text-xs text-paper/90">{row.category}</span>
                          {neverBlock ? (
                            <p className="mt-1 text-[11px] text-muted">Never auto-block</p>
                          ) : null}
                        </td>
                        <td className="py-3 pr-3">
                          <input
                            type="number"
                            name={`review__${row.category}`}
                            min={0}
                            max={1}
                            step={0.01}
                            defaultValue={row.review ?? ""}
                            placeholder={def?.review != null ? String(def.review) : "—"}
                            className="plc-input w-24 px-2 py-1.5 font-mono text-sm normal-case tracking-normal"
                          />
                        </td>
                        <td className="py-3 pr-3">
                          {neverBlock ? (
                            <>
                              <input type="hidden" name={`block__${row.category}`} value="" />
                              <span className="text-xs text-muted">N/A</span>
                            </>
                          ) : (
                            <input
                              type="number"
                              name={`block__${row.category}`}
                              min={0}
                              max={1}
                              step={0.01}
                              defaultValue={row.block ?? ""}
                              placeholder={def?.block != null ? String(def.block) : "N/A"}
                              className="plc-input w-24 px-2 py-1.5 font-mono text-sm normal-case tracking-normal"
                            />
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <input
                            type="checkbox"
                            name={`urgent__${row.category}`}
                            value="true"
                            defaultChecked={row.urgent}
                            aria-label={`${row.category} urgent`}
                          />
                        </td>
                        <td className="py-3">
                          <input
                            type="text"
                            name={`action__${row.category}`}
                            defaultValue={row.recommendedAction}
                            className="plc-input w-full min-w-[14rem] px-2 py-1.5 text-sm normal-case tracking-normal"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <label className="flex items-start gap-3 text-sm text-paper/80">
              <input
                type="checkbox"
                name="flagged_means_review"
                value="true"
                defaultChecked={thresholds.flaggedMeansReview}
                className="mt-1"
              />
              <span>
                If OpenAI marks overall <strong className="text-paper">flagged</strong> but no
                category crosses a threshold, still hold for private review.
              </span>
            </label>

            <div className="flex flex-wrap gap-2">
              <button className="plc-button" type="submit">
                Save score thresholds
              </button>
              <button
                className="plc-button-secondary"
                type="submit"
                name="reset_defaults"
                value="1"
              >
                Reset to defaults
              </button>
            </div>
          </form>
        </section>

        <section id="moderation-tester" className="scroll-mt-8">
          <ModerationTester
            defaultTitle={params?.test_title ?? ""}
            defaultBody={params?.test_body ?? ""}
          />
        </section>
      </div>
    </main>
  );
}
