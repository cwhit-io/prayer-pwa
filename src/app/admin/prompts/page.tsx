import Link from "next/link";
import { FormBanner } from "@/app/components/form-banner";
import { FormSubmitButton } from "@/app/components/form-submit-button";
import { getCurrentUser, hasCapability } from "@/lib/auth";
import { getAdminPrompts } from "@/lib/prompts";
import { getActivePromptTagNames } from "@/lib/tags";
import {
  createPromptAction,
  importCampaignPromptsCsvAction,
  setPromptStatusAction,
  updatePromptAction
} from "./actions";
import { ScripturePicker } from "./scripture-picker";

export const dynamic = "force-dynamic";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default async function AdminPromptsPage({
  searchParams
}: {
  searchParams?: Promise<{
    edit?: string;
    error?: string;
    saved?: string;
    imported?: string;
    count?: string;
    mode?: string;
    cats_new?: string;
    cats_on?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;

  if (!user) {
    return (
      <main className="plc-page">
        <section className="plc-panel mx-auto max-w-3xl p-6">
          <h1 className="text-3xl font-black uppercase text-white">Sign in required</h1>
          <p className="plc-copy mt-2">Prompt management is available to admin users.</p>
          <Link href="/auth" className="plc-button mt-5">
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  if (!hasCapability(user.role, "prayer-content:manage")) {
    return (
      <main className="plc-page">
        <section className="plc-panel mx-auto max-w-3xl p-6">
          <h1 className="text-3xl font-black uppercase text-white">Admin access needed</h1>
          <p className="plc-copy mt-2">
            Your account is signed in as {user.email}, but it does not have the admin role yet.
          </p>
        </section>
      </main>
    );
  }

  const [prompts, tagNames] = await Promise.all([getAdminPrompts(), getActivePromptTagNames()]);
  const editing = params?.edit ? prompts.find((prompt) => prompt.id === params.edit) : null;
  const editingTags = new Set(editing?.tags ?? []);
  const tagOptions = Array.from(new Set([...tagNames, ...editingTags])).sort((a, b) =>
    a.localeCompare(b)
  );

  return (
    <main className="plc-page">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="plc-panel p-6">
           <p className="plc-eyebrow">Staff admin · Prayer content · Prayer prompts</p>
           <h1 className="mt-2 text-4xl font-black uppercase text-white">
             {editing ? "Edit prayer prompt" : "Manage prayer prompts"}
           </h1>
           <p className="plc-copy mt-2">
             Create and update the prayer ideas people can choose from. Each prompt should give someone a clear,
             encouraging place to begin praying.
           </p>
          <div className="mt-3">
            <FormBanner
              error={params?.error}
              success={
                params?.saved === "1"
                  ? "Prompt saved."
                  : params?.imported === "1"
                    ? `CSV import complete — ${params.count ?? "0"} prompts ${
                        params.mode === "append" ? "appended" : "replaced"
                      }` +
                      (Number(params.cats_new ?? 0) > 0
                        ? ` · ${params.cats_new} new tags`
                        : "") +
                      (Number(params.cats_on ?? 0) > 0
                        ? ` · ${params.cats_on} tags reactivated`
                        : "") +
                      "."
                    : null
              }
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="/admin/prompts/export" className="plc-button-secondary">
              Download CSV
            </a>
            {editing ? (
              <Link href="/admin/prompts" className="plc-button-secondary">
                Cancel edit
              </Link>
            ) : null}
          </div>

          <form action={importCampaignPromptsCsvAction} className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/25 p-4">
             <p className="text-sm font-black uppercase text-white/65">Advanced: import prompts from a file</p>
             <p className="text-xs text-muted">
               Use this only when loading many prompts at once. The file must include: title, body, <span className="text-paper/80">topics</span> (multiple with{" "}
              <span className="text-paper/80">|</span> or <span className="text-paper/80">;</span>), optional
              scripture_reference, scripture_text, publish_date, is_active. Legacy{" "}
              <span className="text-paper/80">category</span> still works and merges with tags. New tag names are
              created automatically.
            </p>
            <fieldset className="space-y-2">
               <legend className="plc-label">What should happen to existing prompts?</legend>
              <label className="flex items-start gap-3 rounded-xl border border-paper/10 bg-night-deep/50 p-3 text-sm text-paper/80">
                <input
                  type="radio"
                  name="import_mode"
                  value="append"
                  defaultChecked
                  className="plc-checkbox mt-0.5"
                />
                <span>
                   <span className="block font-black uppercase text-paper">Add these prompts</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Add these rows; keep existing prompts and their tags.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-xl border border-paper/10 bg-night-deep/50 p-3 text-sm text-paper/80">
                <input type="radio" name="import_mode" value="replace" className="plc-checkbox mt-0.5" />
                <span>
                   <span className="block font-black uppercase text-paper">Replace all prompts</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Delete every campaign prompt, then import only this file.
                  </span>
                </span>
              </label>
            </fieldset>
            <label className="plc-label block space-y-2">
               <span>Prompt file (.csv)</span>
              <input
                required
                name="csv_file"
                type="file"
                accept=".csv,text/csv"
                className="block w-full text-sm text-white/70 file:mr-4 file:rounded-full file:border-0 file:bg-yellow file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:text-black"
              />
            </label>
            <button className="plc-button-secondary" type="submit">
               Upload prompt file
            </button>
          </form>

          <form
            key={editing?.id ?? "new-prompt"}
            action={editing ? updatePromptAction : createPromptAction}
            className="mt-6 space-y-4"
          >
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <label className="plc-label block space-y-2">
              <span>Title</span>
              <input required name="title" defaultValue={editing?.title ?? ""} className="plc-input w-full px-4 py-3" />
            </label>
            <fieldset className="space-y-2">
               <legend className="plc-label">Topics (select one or more)</legend>
              <div className="grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-paper/10 bg-night-deep/40 p-3 sm:grid-cols-2">
                {tagOptions.length === 0 ? (
                  <p className="text-sm text-muted">Add tags under Content → Tags first.</p>
                ) : (
                  tagOptions.map((tag) => (
                    <label
                      key={`${editing?.id ?? "new"}-${tag}`}
                      className="flex items-center gap-2 text-sm text-paper/85"
                    >
                      <input
                        type="checkbox"
                        name="tags"
                        value={tag}
                        defaultChecked={editingTags.has(tag)}
                        className="plc-checkbox"
                      />
                      <span>{tag}</span>
                    </label>
                  ))
                )}
              </div>
              <label className="plc-label block space-y-2">
                <span className="normal-case tracking-normal text-muted">Add extra tags (comma or | separated)</span>
                <input
                  name="tags_extra"
                  placeholder="Marriage, Next Generation"
                  className="plc-input w-full px-4 py-3"
                />
              </label>
              <p className="text-xs text-muted">
                Shared with ACTS prompts. Manage under{" "}
                <Link href="/admin/categories" className="text-yellow">
                  Content → Tags
                </Link>
                .
              </p>
            </fieldset>
            <label className="plc-label block space-y-2">
              <span>Publish date</span>
              <input
                required
                name="publish_date"
                type="date"
                defaultValue={editing?.publishDate ?? todayIso()}
                className="plc-input w-full px-4 py-3"
              />
            </label>
            <ScripturePicker
              key={editing?.id ?? "new-prompt"}
              initialReference={editing?.scriptureReference}
              initialText={editing?.scriptureText}
            />
            <label className="plc-label block space-y-2">
              <span>Prayer focus</span>
              <textarea
                required
                name="body"
                defaultValue={editing?.body ?? ""}
                className="plc-input min-h-32 w-full px-4 py-3"
              />
            </label>
            <label className="plc-card-muted flex items-center gap-3 px-4 py-3 text-sm text-white/75">
              <input
                name="is_active"
                type="checkbox"
                defaultChecked={editing ? editing.isActive : true}
                className="plc-checkbox"
              />
              Publish this prompt
            </label>
             <FormSubmitButton pendingLabel={editing ? "Updating prompt…" : "Saving prompt…"}>
               {editing ? "Update prompt" : "Save prompt"}
             </FormSubmitButton>
          </form>
        </section>

        <section className="space-y-4">
          {prompts.length > 0 ? (
            prompts.map((prompt) => (
              <article key={prompt.id} className="plc-panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black uppercase text-yellow">
                      {(prompt.tags.length > 0 ? prompt.tags : [prompt.category]).join(" · ")}
                    </p>
                    <h2 className="mt-1 text-xl font-black text-white">{prompt.title}</h2>
                    <p className="mt-1 text-sm text-white/50">
                      {prompt.publishDate} · {prompt.isActive ? "Active" : "Hidden"}
                      {prompt.scriptureReference ? ` · ${prompt.scriptureReference}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/admin/prompts?edit=${prompt.id}`} className="plc-button-secondary">
                      Edit
                    </Link>
                    <form action={setPromptStatusAction}>
                      <input type="hidden" name="id" value={prompt.id} />
                      <input type="hidden" name="is_active" value={String(!prompt.isActive)} />
                      <button className="plc-button-secondary">{prompt.isActive ? "Hide" : "Publish"}</button>
                    </form>
                  </div>
                </div>
                {prompt.scriptureReference ? (
                  <p className="mt-2 text-xs font-black uppercase tracking-wide text-yellow/80">
                    Scripture opens as ESV on YouVersion for members
                  </p>
                ) : null}
                <p className="mt-3 text-sm leading-6 text-white/70">{prompt.body}</p>
              </article>
            ))
          ) : (
            <article className="plc-panel p-6">
              <h2 className="text-2xl font-black uppercase text-white">No prompts yet</h2>
              <p className="plc-copy mt-2">
                Create a prompt above, or download CSV / upload a full library to replace all prompts.
              </p>
            </article>
          )}
        </section>
      </div>
    </main>
  );
}
