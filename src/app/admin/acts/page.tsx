import Link from "next/link";
import { FormBanner } from "@/app/components/form-banner";
import { getCurrentUser } from "@/lib/auth";
import { actsSteps, listActsPrompts } from "@/lib/acts-prompts";
import { getActivePromptTagNames } from "@/lib/tags";
import {
  createActsPromptAction,
  importActsPromptsCsvAction,
  setActsPromptStatusAction,
  updateActsPromptAction
} from "./actions";

export const dynamic = "force-dynamic";

const stepLabels: Record<string, string> = {
  A: "Adoration",
  C: "Confession",
  T: "Thanksgiving"
};

export default async function AdminActsPage({
  searchParams
}: {
  searchParams?: Promise<{
    edit?: string;
    step?: string;
    error?: string;
    saved?: string;
    imported?: string;
    count?: string;
    mode?: string;
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

  const [prompts, tagNames] = await Promise.all([listActsPrompts(), getActivePromptTagNames()]);
  const editing = params?.edit ? prompts.find((prompt) => prompt.id === params.edit) : null;
  const defaultStep = params?.step === "C" || params?.step === "T" || params?.step === "A" ? params.step : "A";
  const editingTags = new Set(editing?.tags ?? []);
  const tagOptions = Array.from(new Set([...tagNames, ...editingTags])).sort((a, b) =>
    a.localeCompare(b)
  );

  return (
    <main className="plc-page">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="plc-panel p-6">
          <p className="plc-eyebrow">Admin · ACTS</p>
          <h1 className="mt-2 text-4xl font-black uppercase text-white">
            {editing ? "Edit ACTS prompt" : "ACTS prompts"}
          </h1>
          <p className="plc-copy mt-2">
            These appear randomly on the PRAY page under Adoration, Confession, and Thanksgiving. Supplication still
            uses campaign prompts from the main prompt manager.
          </p>
          <div className="mt-3">
            <FormBanner
              error={params?.error}
              success={
                params?.saved === "1"
                  ? "ACTS prompt saved."
                  : params?.imported === "1"
                    ? `CSV import complete — ${params.count ?? "0"} prompts ${
                        params.mode === "append" ? "appended" : "replaced"
                      }.`
                    : null
              }
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="/admin/acts/export" className="plc-button-secondary">
              Download CSV
            </a>
            {editing ? (
              <Link href="/admin/acts" className="plc-button-secondary">
                Cancel edit
              </Link>
            ) : null}
          </div>

          <form action={importActsPromptsCsvAction} className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/25 p-4">
            <p className="text-sm font-black uppercase text-white/50">Import from CSV</p>
            <p className="text-xs text-muted">
              Columns: <span className="text-paper/80">step</span> (A/C/T or Adoration/Confession/Thanksgiving), title,
              body, optional <span className="text-paper/80">tags</span> (multiple with | or ; — shared with campaign
              prompts), scripture_reference, scripture_text, is_active. Download first for a template.
            </p>
            <fieldset className="space-y-2">
              <legend className="plc-label">Import mode</legend>
              <label className="flex items-start gap-3 rounded-xl border border-paper/10 bg-night-deep/50 p-3 text-sm text-paper/80">
                <input
                  type="radio"
                  name="import_mode"
                  value="append"
                  defaultChecked
                  className="plc-checkbox mt-0.5"
                />
                <span>
                  <span className="block font-black uppercase text-paper">Append</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Add these rows to the existing library (keeps current prompts).
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-paper/10 bg-night-deep/50 p-3 text-sm text-paper/80">
                <input type="radio" name="import_mode" value="replace" className="plc-checkbox mt-0.5" />
                <span>
                  <span className="block font-black uppercase text-paper">Replace all</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Delete every ACTS prompt, then import only this file.
                  </span>
                </span>
              </label>
            </fieldset>
            <label className="plc-label block space-y-2">
              <span>CSV file</span>
              <input
                required
                name="csv_file"
                type="file"
                accept=".csv,text/csv"
                className="block w-full text-sm text-white/70 file:mr-4 file:rounded-full file:border-0 file:bg-yellow file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:text-black"
              />
            </label>
            <button className="plc-button-secondary" type="submit">
              Upload CSV
            </button>
          </form>

          <form
            key={editing?.id ?? `new-${defaultStep}`}
            action={editing ? updateActsPromptAction : createActsPromptAction}
            className="mt-6 space-y-4"
          >
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <label className="plc-label block space-y-2">
              <span>ACTS step</span>
              <select
                required
                name="step"
                defaultValue={editing?.step ?? defaultStep}
                className="plc-input w-full px-4 py-3"
              >
                {actsSteps.map((step) => (
                  <option key={step.step} value={step.step}>
                    {step.step} · {step.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="plc-label block space-y-2">
              <span>Title</span>
              <input required name="title" defaultValue={editing?.title ?? ""} className="plc-input w-full px-4 py-3" />
            </label>
            <label className="plc-label block space-y-2">
              <span>Scripture reference</span>
              <input
                name="scripture_reference"
                defaultValue={editing?.scriptureReference ?? ""}
                placeholder="Psalm 46:10"
                className="plc-input w-full px-4 py-3"
              />
            </label>
            <label className="plc-label block space-y-2">
              <span>Scripture text</span>
              <textarea
                name="scripture_text"
                defaultValue={editing?.scriptureText ?? ""}
                className="plc-input min-h-20 w-full px-4 py-3"
              />
            </label>
            <label className="plc-label block space-y-2">
              <span>Prayer focus</span>
              <textarea
                required
                name="body"
                defaultValue={editing?.body ?? ""}
                className="plc-input min-h-28 w-full px-4 py-3"
              />
            </label>
            <fieldset className="space-y-2">
              <legend className="plc-label">Tags (optional, shared with campaign prompts)</legend>
              <p className="text-xs text-muted">
                Topic tags only — Adoration, Confession, Thanksgiving, and Supplication are steps, not tags.
              </p>
              <div className="grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-paper/10 bg-night-deep/40 p-3 sm:grid-cols-2">
                {tagOptions.map((tag) => (
                  <label key={`${editing?.id ?? "new"}-${tag}`} className="flex items-center gap-2 text-sm text-paper/85">
                    <input
                      type="checkbox"
                      name="tags"
                      value={tag}
                      defaultChecked={editingTags.has(tag)}
                      className="plc-checkbox"
                    />
                    <span>{tag}</span>
                  </label>
                ))}
              </div>
              <label className="plc-label block space-y-2">
                <span className="normal-case tracking-normal text-muted">Extra tags (comma or |)</span>
                <input name="tags_extra" className="plc-input w-full px-4 py-3" placeholder="Family, Prayer" />
              </label>
            </fieldset>
            <label className="plc-card-muted flex items-center gap-3 px-4 py-3 text-sm text-white/75">
              <input
                name="is_active"
                type="checkbox"
                defaultChecked={editing ? editing.isActive : true}
                className="plc-checkbox"
              />
              Active (can appear randomly on PRAY)
            </label>
            <button className="plc-button">{editing ? "Update ACTS prompt" : "Save ACTS prompt"}</button>
          </form>
        </section>

        <section className="space-y-6">
          {actsSteps.map((step) => {
            const stepPrompts = prompts.filter((prompt) => prompt.step === step.step);
            return (
              <div key={step.step} className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-2 border-b border-white/10 pb-2">
                  <div>
                    <p className="text-sm font-black uppercase text-yellow">
                      {step.step} · {step.name}
                    </p>
                    <p className="text-xs text-white/45">{stepPrompts.length} prompt{stepPrompts.length === 1 ? "" : "s"}</p>
                  </div>
                  <Link href={`/admin/acts?step=${step.step}`} className="text-xs font-black uppercase text-yellow">
                    Add {step.name}
                  </Link>
                </div>
                {stepPrompts.length > 0 ? (
                  stepPrompts.map((prompt) => (
                    <article key={prompt.id} className="plc-panel p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black text-white">{prompt.title}</h3>
                          {prompt.tags.length > 0 ? (
                            <p className="mt-1 text-xs font-black uppercase tracking-wide text-yellow/80">
                              {prompt.tags.join(" · ")}
                            </p>
                          ) : null}
                          {prompt.scriptureReference ? (
                            <p className="mt-1 text-xs font-black uppercase text-yellow">{prompt.scriptureReference}</p>
                          ) : null}
                          <p className="mt-2 text-sm leading-6 text-white/70">{prompt.body}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="plc-status">{prompt.isActive ? "Active" : "Hidden"}</span>
                          <Link href={`/admin/acts?edit=${prompt.id}`} className="plc-button-secondary">
                            Edit
                          </Link>
                          <form action={setActsPromptStatusAction}>
                            <input type="hidden" name="id" value={prompt.id} />
                            <input type="hidden" name="is_active" value={String(!prompt.isActive)} />
                            <button className="plc-button-secondary">{prompt.isActive ? "Hide" : "Show"}</button>
                          </form>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-white/50">No {stepLabels[step.step]} prompts yet.</p>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
