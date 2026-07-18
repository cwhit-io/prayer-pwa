"use client";

import { useActionState } from "react";
import type { ModerationPreview } from "@/lib/moderation";
import { testModerationAction, type TestModerationState } from "./actions";

function outcomeBadge(outcome: ModerationPreview["outcome"]) {
  switch (outcome) {
    case "block":
      return { label: "Hard block — not saved", className: "border-danger/40 bg-danger/15 text-danger" };
    case "pending_review":
      return {
        label: "Private review queue",
        className: "border-yellow/40 bg-yellow/10 text-yellow"
      };
    case "private_review":
      return {
        label: "Private + flagged for leadership",
        className: "border-yellow/40 bg-yellow/10 text-yellow"
      };
    case "delayed_publish":
      return {
        label: "Delayed community publish",
        className: "border-green-500/40 bg-green-500/10 text-green-400"
      };
    case "private_ok":
      return {
        label: "Private prayer (clean)",
        className: "border-green-500/40 bg-green-500/10 text-green-400"
      };
    default:
      return { label: outcome, className: "border-white/20 text-paper" };
  }
}

function tierLabel(action: string) {
  if (action === "block") {
    return "BLOCK";
  }
  if (action === "review") {
    return "REVIEW";
  }
  if (action === "skipped") {
    return "SKIPPED";
  }
  return "PASS";
}

function tierColor(action: string) {
  if (action === "block") {
    return "text-danger";
  }
  if (action === "review") {
    return "text-yellow";
  }
  if (action === "skipped") {
    return "text-muted";
  }
  return "text-green-400";
}

export function ModerationTester({
  defaultTitle = "",
  defaultBody = ""
}: {
  defaultTitle?: string;
  defaultBody?: string;
}) {
  const [state, formAction, pending] = useActionState<TestModerationState, FormData>(
    testModerationAction,
    null
  );

  const preview = state?.preview ?? null;
  const badge = preview ? outcomeBadge(preview.outcome) : null;

  return (
    <article className="plc-panel border-white/10 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-paper/50">Tester</p>
          <h2 className="mt-1 text-2xl font-black uppercase text-white">What would happen?</h2>
          <p className="plc-copy mt-2 max-w-2xl text-sm">
            Paste sample title/body (or a queue item) to dry-run the same three tiers used on submit.
            Nothing is saved.
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="plc-label block space-y-2">
            <span>Title</span>
            <input
              name="title"
              defaultValue={defaultTitle}
              placeholder="Prayer request title"
              className="plc-input w-full px-4 py-3 normal-case tracking-normal"
            />
          </label>
          <label className="plc-label block space-y-2">
            <span>Details</span>
            <textarea
              name="body"
              rows={6}
              defaultValue={defaultBody}
              placeholder="Paste the prayer request text…"
              className="plc-input min-h-[9rem] w-full px-4 py-3 font-mono text-sm normal-case tracking-normal"
              required
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="plc-label">Visibility</legend>
            <div className="flex flex-wrap gap-4 text-sm text-paper/80">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="visibility"
                  value="church_anonymous"
                  defaultChecked
                />
                Community board
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="visibility" value="prayer_team" />
                Private prayer
              </label>
            </div>
          </fieldset>
          <button className="plc-button" type="submit" disabled={pending}>
            {pending ? "Running pipeline…" : "Test moderation"}
          </button>
          {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        </div>

        <div className="space-y-4 rounded-xl border border-white/10 bg-black/25 p-4">
          {!preview && !pending ? (
            <p className="text-sm text-muted">Results appear here after you run a test.</p>
          ) : null}
          {pending ? <p className="text-sm text-muted">Checking block list, OpenAI, leadership…</p> : null}

          {preview && badge ? (
            <div className="space-y-4">
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${badge.className}`}>
                {badge.label}
              </div>
              <p className="text-base leading-7 text-paper/90">{preview.whatWouldHappen}</p>
              {preview.userMessage ? (
                <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  User message: “{preview.userMessage}”
                </p>
              ) : null}

              <div className="grid gap-3">
                <div className="rounded-lg border border-white/10 px-3 py-2">
                  <p className="text-xs font-black uppercase tracking-wide text-paper/50">
                    Tier 1 · Hard block{" "}
                    <span className={tierColor(preview.tiers.blocklist.action)}>
                      {tierLabel(preview.tiers.blocklist.action)}
                    </span>
                  </p>
                  {preview.tiers.blocklist.matched.length > 0 ? (
                    <p className="mt-1 font-mono text-xs text-danger">
                      {preview.tiers.blocklist.matched.join(", ")}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted">No blocklist matches</p>
                  )}
                </div>

                <div className="rounded-lg border border-white/10 px-3 py-2">
                  <p className="text-xs font-black uppercase tracking-wide text-paper/50">
                    Tier 2 · OpenAI{" "}
                    <span className={tierColor(preview.tiers.openai.action)}>
                      {tierLabel(preview.tiers.openai.action)}
                    </span>
                  </p>
                  {!preview.tiers.openai.configured ? (
                    <p className="mt-1 text-xs text-muted">API key not configured</p>
                  ) : null}
                  {preview.tiers.openai.error ? (
                    <p className="mt-1 text-xs text-danger">{preview.tiers.openai.error}</p>
                  ) : null}
                  {preview.tiers.openai.summary ? (
                    <p className="mt-1 text-xs text-paper/70">{preview.tiers.openai.summary}</p>
                  ) : null}
                  {preview.tiers.openai.urgent ? (
                    <p className="mt-1 text-xs font-black uppercase tracking-wide text-yellow">
                      Urgent care / restricted review
                    </p>
                  ) : null}
                  {preview.tiers.openai.ran && preview.tiers.openai.categories.length === 0 ? (
                    <p className="mt-1 text-xs text-muted">API ran but returned no category scores.</p>
                  ) : null}
                  {preview.tiers.openai.categories.length > 0 ? (
                    <div className="mt-2 max-h-64 overflow-y-auto">
                      <table className="w-full border-collapse text-left text-[11px]">
                        <thead>
                          <tr className="text-paper/40">
                            <th className="py-1 pr-2 font-normal">Category</th>
                            <th className="py-1 pr-2 font-normal">Score</th>
                            <th className="py-1 pr-2 font-normal">Review≥</th>
                            <th className="py-1 pr-2 font-normal">Block≥</th>
                            <th className="py-1 font-normal">Result</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono text-paper/65">
                          {preview.tiers.openai.categories.map((cat) => (
                            <tr key={cat.category} className="border-t border-white/5">
                              <td className="py-1 pr-2">{cat.category}</td>
                              <td className="py-1 pr-2">{cat.score.toFixed(4)}</td>
                              <td className="py-1 pr-2 text-paper/40">
                                {cat.reviewThreshold != null ? cat.reviewThreshold.toFixed(2) : "—"}
                              </td>
                              <td className="py-1 pr-2 text-paper/40">
                                {cat.blockThreshold != null ? cat.blockThreshold.toFixed(2) : "N/A"}
                              </td>
                              <td className={`py-1 ${tierColor(cat.action)}`}>
                                {tierLabel(cat.action)}
                                {cat.flagged ? " · flg" : ""}
                                {cat.urgent ? " · urg" : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {preview.tiers.openai.categories.some((c) => c.recommendedAction) ? (
                        <ul className="mt-2 space-y-1 text-[11px] text-paper/45">
                          {preview.tiers.openai.categories
                            .filter((c) => c.recommendedAction)
                            .map((cat) => (
                              <li key={`${cat.category}-tip`}>
                                <span className="font-mono text-paper/60">{cat.category}:</span>{" "}
                                {cat.recommendedAction}
                              </li>
                            ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : preview.tiers.openai.configured &&
                    !preview.tiers.openai.ran &&
                    !preview.tiers.openai.error &&
                    preview.tiers.openai.action === "skipped" ? (
                    <p className="mt-1 text-xs text-muted">OpenAI not run for this result.</p>
                  ) : null}
                </div>

                <div className="rounded-lg border border-white/10 px-3 py-2">
                  <p className="text-xs font-black uppercase tracking-wide text-paper/50">
                    Tier 3 · Leadership{" "}
                    <span className={tierColor(preview.tiers.leadership.action)}>
                      {tierLabel(preview.tiers.leadership.action)}
                    </span>
                  </p>
                  {preview.tiers.leadership.matched.length > 0 ? (
                    <p className="mt-1 font-mono text-xs text-yellow">
                      {preview.tiers.leadership.matched.join(", ")}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted">No leadership-list matches</p>
                  )}
                </div>
              </div>

              {preview.matchedKeywords.length > 0 ? (
                <p className="text-xs text-muted">
                  Stored match labels:{" "}
                  <span className="font-mono text-paper/60">{preview.matchedKeywords.join(", ")}</span>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </form>
    </article>
  );
}
