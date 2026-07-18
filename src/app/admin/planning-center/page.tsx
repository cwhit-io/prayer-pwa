import Link from "next/link";
import { FormBanner } from "@/app/components/form-banner";
import { getCurrentUser } from "@/lib/auth";
import { listUsersForAdminLinking } from "@/lib/planning-center";
import {
  getSyncQueueStats,
  listPlanningCenterFieldMap
} from "@/lib/planning-center-writeback";
import { getPlanningCenterCredentials } from "@/lib/settings";
import {
  bulkSyncPlanningCenterAction,
  manualPersonOverrideAction,
  processSyncQueueAction,
  refreshUserAction,
  saveFieldMapAction,
  savePcoCredentialsAction,
  setUserRoleAction,
  syncUserAction,
  unlinkUserAction
} from "./actions";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
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

export default async function AdminPlanningCenterPage({
  searchParams
}: {
  searchParams?: Promise<{
    saved?: string;
    synced?: string;
    override?: string;
    bulk?: string;
    linked?: string;
    linked_err?: string;
    unlinked?: string;
    unlinked_err?: string;
    field_map?: string;
    queue?: string;
    done?: string;
    skipped?: string;
    errored?: string;
    role?: string;
    error?: string;
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

  const [credentials, users, fieldMap, queueStats] = await Promise.all([
    getPlanningCenterCredentials(),
    listUsersForAdminLinking(),
    listPlanningCenterFieldMap(),
    getSyncQueueStats()
  ]);

  return (
    <main className="plc-page">
      <div className="plc-shell-wide space-y-8">
        <header className="space-y-3">
          <p className="plc-eyebrow">Admin · Planning Center</p>
          <h1 className="plc-title">Connect people, not IDs for members.</h1>
          <p className="plc-copy max-w-3xl">
            Store API credentials, look up each app user in Planning Center by email, and pull household members
            (Family) and small-group members (Friends). Members never see or enter Planning Center IDs. Manual ID
            override is admin-only.
          </p>
          {params?.saved === "1" ? (
            <p className="text-sm font-black uppercase text-yellow">API credentials saved and verified.</p>
          ) : null}
          {params?.synced === "1" ? (
            <p className="text-sm font-black uppercase text-yellow">User synced from Planning Center.</p>
          ) : null}
          {params?.override === "1" ? (
            <p className="text-sm font-black uppercase text-yellow">Manual person ID override saved.</p>
          ) : null}
          {params?.bulk === "1" ? (
            <p className="text-sm font-black uppercase text-yellow">
              Bulk sync finished · linked refreshed {params.linked ?? "0"}
              {params.linked_err && params.linked_err !== "0" ? ` (${params.linked_err} errors)` : ""}
              {" · "}
              unlinked synced {params.unlinked ?? "0"}
              {params.unlinked_err && params.unlinked_err !== "0" ? ` (${params.unlinked_err} skipped/errors)` : ""}
            </p>
          ) : null}
          {params?.field_map === "1" ? (
            <p className="text-sm font-black uppercase text-yellow">Field map saved.</p>
          ) : null}
          {params?.role === "1" ? (
            <p className="text-sm font-black uppercase text-yellow">User role updated.</p>
          ) : null}
          {params?.queue === "1" ? (
            <p className="text-sm font-black uppercase text-yellow">
              Queue processed · done {params.done ?? "0"} · skipped {params.skipped ?? "0"} · errors{" "}
              {params.errored ?? "0"}
            </p>
          ) : null}
          <FormBanner error={params?.error} />
        </header>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="plc-panel p-6">
            <h2 className="text-2xl font-black uppercase text-white">API credentials</h2>
            <p className="plc-copy mt-2">
              Personal Access Token Application ID and Secret from Planning Center. Status:{" "}
              <span className="text-yellow">{credentials.configured ? "configured" : "missing"}</span>
              {credentials.source !== "none" ? ` (${credentials.source})` : ""}.
            </p>
            <form action={savePcoCredentialsAction} className="mt-5 space-y-4">
              <label className="plc-label block space-y-2">
                <span>Application ID</span>
                <input
                  required
                  name="app_id"
                  defaultValue={credentials.appId ?? ""}
                  className="plc-input w-full px-4 py-3 font-mono text-sm"
                  autoComplete="off"
                />
              </label>
              <label className="plc-label block space-y-2">
                <span>Secret</span>
                <input
                  required
                  name="secret"
                  type="password"
                  defaultValue={credentials.secret ?? ""}
                  className="plc-input w-full px-4 py-3 font-mono text-sm"
                  autoComplete="off"
                />
              </label>
              <button className="plc-button">Save & test connection</button>
            </form>
          </article>

          <article className="plc-panel p-6">
            <h2 className="text-2xl font-black uppercase text-white">How sync works</h2>
            <ol className="plc-copy mt-4 list-decimal space-y-3 pl-5">
              <li>Save valid Planning Center API credentials.</li>
              <li>
                Click <strong className="text-white">Sync user</strong> to look up that person by email in Planning
                Center.
              </li>
              <li>
                Household members land under Family. Friends come from groups whose group type id is
                428832, 428831, or 428830 (
                <code className="text-white/70">/groups/v2/people/&#123;id&#125;/groups</code>
                ), using the same API credentials.
              </li>
              <li>Use manual ID override only when email lookup fails.</li>
              <li>Members only see names to pray for—never Planning Center IDs.</li>
            </ol>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="plc-panel p-6">
            <h2 className="text-2xl font-black uppercase text-white">Bulk sync</h2>
            <p className="plc-copy mt-2">
              Refresh Family/Friends for every linked person, then try email lookup for unlinked accounts (skips guest
              emails).
            </p>
            <form action={bulkSyncPlanningCenterAction} className="mt-5">
              <button className="plc-button" disabled={!credentials.configured}>
                Sync all users
              </button>
            </form>
          </article>

          <article className="plc-panel p-6">
            <h2 className="text-2xl font-black uppercase text-white">Writeback queue</h2>
            <p className="plc-copy mt-2">
              Prayer sessions enqueue last-prayed / progress jobs. Nothing is sent to Planning Center until a field map
              row has a field definition ID and is enabled.
            </p>
            <p className="mt-3 text-sm text-white/55">
              Pending {queueStats.pending} · Done {queueStats.done} · Skipped {queueStats.skipped} · Errors{" "}
              {queueStats.error}
            </p>
            <form action={processSyncQueueAction} className="mt-5">
              <button className="plc-button-secondary" disabled={!credentials.configured}>
                Process pending jobs
              </button>
            </form>
          </article>
        </section>

        <section className="plc-panel p-6 space-y-5">
          <div>
            <h2 className="text-2xl font-black uppercase text-white">Custom field map</h2>
            <p className="plc-copy mt-2">
              Optional writeback to Planning Center person custom fields. Leave disabled until the church confirms field
              definition IDs in People.
            </p>
          </div>
          <div className="space-y-4">
            {fieldMap.map((field) => (
              <form
                key={field.fieldKey}
                action={saveFieldMapAction}
                className="grid gap-3 rounded-xl border border-white/10 bg-black/25 p-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end"
              >
                <input type="hidden" name="field_key" value={field.fieldKey} />
                <div>
                  <p className="text-sm font-black uppercase text-white">{field.label}</p>
                  <p className="mt-1 font-mono text-xs text-white/40">{field.fieldKey}</p>
                </div>
                <label className="plc-label block space-y-2">
                  <span>PCO field definition ID</span>
                  <input
                    name="planning_center_field_id"
                    defaultValue={field.planningCenterFieldId ?? ""}
                    placeholder="FieldDefinition id"
                    className="plc-input w-full px-3 py-2 font-mono text-sm"
                  />
                </label>
                <label className="flex items-center gap-2 pb-2 text-sm text-white/70">
                  <input
                    name="enabled"
                    type="checkbox"
                    defaultChecked={field.enabled}
                    className="plc-checkbox"
                  />
                  Enabled
                </label>
                <button className="plc-button-secondary">Save</button>
              </form>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-black uppercase text-white">Users</h2>
            <p className="plc-copy mt-1 max-w-2xl">
              Grant admin access for church staff (or remove it).{" "}
              <span className="text-paper/80">@blackhawkministries.org</span> emails are also auto-promoted on sign-in.
            </p>
          </div>
          {users.map((entry) => (
            <article key={entry.id} className="plc-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-black text-paper">{entry.name}</h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                        entry.role === "admin"
                          ? "bg-yellow/20 text-yellow"
                          : entry.role === "prayer_team"
                            ? "border border-yellow/40 text-yellow"
                            : "border border-paper/15 text-muted"
                      }`}
                    >
                      {entry.role.replace(/_/g, " ")}
                    </span>
                    {entry.id === user.id ? (
                      <span className="text-[10px] font-black uppercase tracking-wide text-muted">You</span>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted">{entry.email}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/40">
                    {entry.planningCenterPersonId
                      ? `Linked · status ${entry.planningCenterSyncStatus} · last sync ${formatDate(entry.planningCenterLastSyncedAt)}`
                      : "Not linked"}
                  </p>
                  {entry.planningCenterPersonId ? (
                    <p className="mt-1 font-mono text-xs text-white/35">
                      PCO person {entry.planningCenterPersonId}
                      {entry.planningCenterDisplayName ? ` · ${entry.planningCenterDisplayName}` : ""}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm text-white/60">
                    Family: {entry.familyCount} · Friends: {entry.friendsCount}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {entry.role !== "admin" ? (
                    <form action={setUserRoleAction}>
                      <input type="hidden" name="user_id" value={entry.id} />
                      <input type="hidden" name="role" value="admin" />
                      <button className="plc-button">Make admin</button>
                    </form>
                  ) : (
                    <form action={setUserRoleAction}>
                      <input type="hidden" name="user_id" value={entry.id} />
                      <input type="hidden" name="role" value="member" />
                      <button className="plc-button-secondary" type="submit">
                        Remove admin
                      </button>
                    </form>
                  )}
                  {entry.role !== "prayer_team" && entry.role !== "admin" ? (
                    <form action={setUserRoleAction}>
                      <input type="hidden" name="user_id" value={entry.id} />
                      <input type="hidden" name="role" value="prayer_team" />
                      <button className="plc-button-secondary" type="submit">
                        Prayer team
                      </button>
                    </form>
                  ) : null}
                  {entry.role === "prayer_team" ? (
                    <form action={setUserRoleAction}>
                      <input type="hidden" name="user_id" value={entry.id} />
                      <input type="hidden" name="role" value="member" />
                      <button className="plc-button-secondary" type="submit">
                        Remove prayer team
                      </button>
                    </form>
                  ) : null}
                  <form action={syncUserAction}>
                    <input type="hidden" name="user_id" value={entry.id} />
                    <button className="plc-button-secondary" disabled={!credentials.configured}>
                      Sync user
                    </button>
                  </form>
                  {entry.planningCenterPersonId ? (
                    <>
                      <form action={refreshUserAction}>
                        <input type="hidden" name="user_id" value={entry.id} />
                        <button className="plc-button-secondary" disabled={!credentials.configured}>
                          Refresh lists
                        </button>
                      </form>
                      <form action={unlinkUserAction}>
                        <input type="hidden" name="user_id" value={entry.id} />
                        <button className="plc-button-secondary">Unlink</button>
                      </form>
                    </>
                  ) : null}
                </div>
              </div>

              <details className="mt-4 rounded-lg border border-white/10 bg-black/30 p-4">
                <summary className="cursor-pointer text-sm font-black uppercase text-yellow">
                  Admin manual ID override
                </summary>
                <form action={manualPersonOverrideAction} className="mt-4 grid gap-3 md:grid-cols-4">
                  <input type="hidden" name="user_id" value={entry.id} />
                  <input
                    required
                    name="person_id"
                    defaultValue={entry.planningCenterPersonId ?? ""}
                    placeholder="PCO person ID"
                    className="plc-input px-3 py-2 font-mono text-sm"
                  />
                  <input
                    name="display_name"
                    defaultValue={entry.planningCenterDisplayName ?? entry.name}
                    placeholder="Display name"
                    className="plc-input px-3 py-2"
                  />
                  <label className="flex items-center gap-2 text-sm text-white/70">
                    <input name="pull_lists" type="checkbox" defaultChecked className="plc-checkbox" />
                    Pull Family/Friends after save
                  </label>
                  <button className="plc-button-secondary">Save override</button>
                </form>
              </details>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
