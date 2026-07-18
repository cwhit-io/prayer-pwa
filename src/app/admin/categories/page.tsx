import Link from "next/link";
import { FormBanner } from "@/app/components/form-banner";
import { getCurrentUser } from "@/lib/auth";
import { listPromptTags } from "@/lib/tags";
import { createCategoryAction, setCategoryStatusAction, updateCategoryAction } from "./actions";

export const dynamic = "force-dynamic";

function CoverageCell({
  label,
  count,
  href
}: {
  label: string;
  count: number;
  href?: string;
}) {
  const ok = count > 0;
  const inner = (
    <span
      className={`inline-flex min-w-[2.75rem] flex-col items-center rounded-lg border px-2 py-1.5 ${
        ok
          ? "border-success/40 bg-success/10 text-success"
          : "border-danger/40 bg-danger/10 text-danger"
      }`}
    >
      <span className="text-[10px] font-black uppercase tracking-wide opacity-80">{label}</span>
      <span className="text-sm font-black tabular-nums">{count}</span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="transition hover:opacity-90" title={`Open ${label} admin`}>
        {inner}
      </Link>
    );
  }
  return inner;
}

export default async function AdminCategoriesPage({
  searchParams
}: {
  searchParams?: Promise<{ edit?: string; error?: string; saved?: string }>;
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

  const tags = await listPromptTags({ includeInactive: true });
  const editing = params?.edit ? tags.find((tag) => tag.id === params.edit) : null;
  const activeTags = tags.filter((tag) => tag.isActive);
  const completeCount = activeTags.filter((tag) => tag.coverageComplete).length;
  const incomplete = activeTags.filter((tag) => !tag.coverageComplete);

  return (
    <main className="plc-page">
      <div className="plc-shell-wide space-y-8">
        <header className="space-y-3">
          <p className="plc-eyebrow">Admin · Content</p>
          <h1 className="plc-title">Shared tags</h1>
          <p className="plc-copy max-w-3xl">
            Topic tags only (not Adoration / Confession / Thanksgiving / Supplication — those are steps). Ideal
            coverage for each tag: at least one <strong className="text-paper/80">campaign (S)</strong> prompt and one
            each of <strong className="text-paper/80">A</strong>, <strong className="text-paper/80">C</strong>, and{" "}
            <strong className="text-paper/80">T</strong> so PRAY can link steps by tag.
          </p>
          <FormBanner
            error={params?.error}
            success={params?.saved === "1" ? "Tag saved." : null}
          />
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <article className="plc-panel p-5">
            <p className="text-xs font-black uppercase text-muted">Active tags</p>
            <p className="mt-2 text-3xl font-black text-paper">{activeTags.length}</p>
          </article>
          <article className="plc-panel p-5">
            <p className="text-xs font-black uppercase text-muted">Full coverage (S+A+C+T)</p>
            <p className="mt-2 text-3xl font-black text-success">
              {completeCount}
              <span className="text-lg text-muted"> / {activeTags.length}</span>
            </p>
          </article>
          <article className="plc-panel p-5">
            <p className="text-xs font-black uppercase text-muted">Gaps to fill</p>
            <p className="mt-2 text-3xl font-black text-danger">{incomplete.length}</p>
            <p className="mt-1 text-xs text-muted">Use prompts/ACTS admin — we don’t auto-create content.</p>
          </article>
        </section>

        {incomplete.length > 0 ? (
          <section className="plc-panel p-5">
            <h2 className="text-lg font-black uppercase text-paper">Incomplete tags</h2>
            <p className="mt-1 text-sm text-muted">
              Missing slots are listed after each name. Add or retag existing prompts — no new library content is
              created here.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {incomplete.map((tag) => (
                <li
                  key={tag.id}
                  className="rounded-full border border-danger/30 bg-danger/10 px-3 py-1 text-xs font-black uppercase text-danger"
                >
                  {tag.name}
                  <span className="ml-1 font-normal normal-case tracking-normal text-paper/70">
                    needs {(tag.coverageGaps ?? []).join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="plc-panel p-6">
            <h2 className="text-2xl font-black uppercase text-paper">
              {editing ? "Edit tag" : "Add tag"}
            </h2>
            {editing ? (
              <div className="mt-4">
                <Link href="/admin/categories" className="plc-button-secondary">
                  Cancel edit
                </Link>
              </div>
            ) : null}

            <form
              action={editing ? updateCategoryAction : createCategoryAction}
              className="mt-6 space-y-4"
            >
              {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
              <label className="plc-label block space-y-2">
                <span>Name</span>
                <input
                  required
                  name="name"
                  defaultValue={editing?.name ?? ""}
                  placeholder="Future"
                  className="plc-input w-full px-4 py-3"
                />
              </label>
              <label className="plc-label block space-y-2">
                <span>Sort order</span>
                <input
                  name="sort_order"
                  type="number"
                  defaultValue={editing?.sortOrder ?? ""}
                  placeholder="Auto if blank"
                  className="plc-input w-full px-4 py-3"
                />
                <span className="text-xs font-normal normal-case tracking-normal text-muted">
                  Lower numbers appear first in filters and dropdowns.
                </span>
              </label>
              {editing ? (
                <label className="plc-card-muted flex items-center gap-3 px-4 py-3 text-sm text-paper/80">
                  <input
                    name="is_active"
                    type="checkbox"
                    defaultChecked={editing.isActive}
                    className="plc-checkbox"
                  />
                  Active (shown in prompt/ACTS forms and archive filters)
                </label>
              ) : null}
              <button className="plc-button">{editing ? "Update tag" : "Add tag"}</button>
            </form>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-2xl font-black uppercase text-paper">Coverage by tag</h2>
                <p className="mt-1 text-sm text-muted">
                  Green = at least one prompt · Red = missing · S = campaign · A/C/T = ACTS steps
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Link href="/admin/prompts" className="plc-button-secondary">
                  Campaign prompts
                </Link>
                <Link href="/admin/acts" className="plc-button-secondary">
                  ACTS prompts
                </Link>
              </div>
            </div>

            {tags.length > 0 ? (
              tags.map((tag) => {
                const s = tag.promptCount ?? 0;
                const a = tag.actsACount ?? 0;
                const c = tag.actsCCount ?? 0;
                const t = tag.actsTCount ?? 0;
                return (
                  <article
                    key={tag.id}
                    className={`plc-panel p-4 sm:p-5 ${
                      !tag.isActive
                        ? "opacity-60"
                        : tag.coverageComplete
                          ? "border-success/20"
                          : "border-danger/20"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-black text-paper">{tag.name}</h3>
                          {!tag.isActive ? (
                            <span className="rounded-full border border-paper/20 px-2 py-0.5 text-[10px] font-black uppercase text-muted">
                              Hidden
                            </span>
                          ) : tag.coverageComplete ? (
                            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-black uppercase text-success">
                              Complete
                            </span>
                          ) : (
                            <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-black uppercase text-danger">
                              Gaps: {(tag.coverageGaps ?? []).join(" · ")}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted">Sort {tag.sortOrder}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <CoverageCell label="S" count={s} href="/admin/prompts" />
                          <CoverageCell label="A" count={a} href="/admin/acts" />
                          <CoverageCell label="C" count={c} href="/admin/acts" />
                          <CoverageCell label="T" count={t} href="/admin/acts" />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/categories?edit=${tag.id}`}
                          className="plc-button-secondary"
                        >
                          Edit
                        </Link>
                        <form action={setCategoryStatusAction}>
                          <input type="hidden" name="id" value={tag.id} />
                          <input type="hidden" name="is_active" value={String(!tag.isActive)} />
                          <button className="plc-button-secondary">
                            {tag.isActive ? "Hide" : "Activate"}
                          </button>
                        </form>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <article className="plc-panel p-6">
                <h2 className="text-2xl font-black uppercase text-white">No tags yet</h2>
                <p className="plc-copy mt-2">Add your first topical tag to organize prompts.</p>
              </article>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
