import Link from "next/link";
import { FormBanner } from "@/app/components/form-banner";
import { getCurrentUser, hasCapability } from "@/lib/auth";
import { countUsersForAdminLinking, listUsersForAdminLinking, listUsersForStaffEntry, type LinkedUserSummary } from "@/lib/planning-center";
import { getPlanningCenterCredentials } from "@/lib/settings";
import { MemberEditor } from "../member-editor";
import { AddPlanningCenterPerson } from "../add-planning-center-person";
import { StaffEntryEditor } from "../staff-entry-editor";

export const dynamic = "force-dynamic";

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
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
    user_added?: string;
    created?: string;
    name?: string;
    session_saved?: string;
    pledge_saved?: string;
    member_q?: string;
    member_page?: string;
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

  if (!hasCapability(user.role, "member-entries:manage")) {
    return (
      <main className="plc-page">
        <section className="plc-panel mx-auto max-w-3xl p-6">
          <h1 className="text-3xl font-black uppercase text-white">Admin access needed</h1>
        </section>
      </main>
    );
  }

  const canViewDetailedProgress = hasCapability(user.role, "member-progress:read");
  const canManageDirectory = hasCapability(user.role, "directory:manage");
  const canAddPeople = hasCapability(user.role, "people:add");

  const memberSearch = (params?.member_q ?? "").trim();
  const memberPage = Math.max(1, Number(params?.member_page ?? "1") || 1);
  const memberPageSize = 25;
  const memberOffset = (memberPage - 1) * memberPageSize;

  const [credentials, users, memberTotal] = await Promise.all([
    canAddPeople ? getPlanningCenterCredentials() : Promise.resolve({ configured: false }),
    canViewDetailedProgress || canManageDirectory
      ? listUsersForAdminLinking(memberPageSize, memberOffset, memberSearch)
      : listUsersForStaffEntry(memberPageSize, memberOffset, memberSearch, canViewDetailedProgress),
    countUsersForAdminLinking(memberSearch)
  ]);

  return (
    <main className="plc-page">
      <div className="plc-shell-wide space-y-8">
        <header className="space-y-3">
          <p className="plc-eyebrow">Staff tools · Participant updates</p>
          <h1 className="plc-title">Record participant updates.</h1>
          <p className="plc-copy max-w-3xl">
              Search for a participant to record prayer minutes or view and update their campaign pledge.
              {canViewDetailedProgress ? " Admins can also review detailed campaign progress." : " Prayer progress for other participants is not shown to Prayer Team members."}
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
          {params?.user_added === "1" ? (
            <p className="text-sm font-black uppercase text-yellow">
              {params.created === "1" ? "User created" : "User already in campaign"}
              {params.name ? `: ${params.name}` : ""}.
            </p>
          ) : null}
          {params?.session_saved === "1" ? (
            <p className="text-sm font-black uppercase text-yellow">Prayer session recorded (PCO totals updated if linked).</p>
          ) : null}
          {params?.pledge_saved === "1" ? (
            <p className="text-sm font-black uppercase text-yellow">Pledge saved (PCO totals updated if linked).</p>
          ) : null}
          <FormBanner error={params?.error} />
        </header>

        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black uppercase text-white">Participants</h2>
              <p className="plc-copy mt-1 max-w-3xl">Search people, review the information allowed for your role, then record a reported update.</p>
            </div>
            <p className="text-sm text-white/70">Showing {memberTotal === 0 ? 0 : memberOffset + 1}–{Math.min(memberOffset + users.length, memberTotal)} of {memberTotal}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <form method="get" action="/admin/planning-center" className="flex min-w-[18rem] flex-1 flex-wrap gap-3">
              <input name="member_q" defaultValue={memberSearch} placeholder="Search a name or email" className="plc-input min-w-[16rem] flex-1 px-4 py-3" />
              <button className="plc-button" type="submit">Search people</button>
            </form>
            {canAddPeople ? <AddPlanningCenterPerson credentialsConfigured={credentials.configured} /> : null}
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="bg-black/30 text-xs font-black uppercase tracking-wide text-white/70">
                <tr><th className="px-4 py-3">Person</th>{canManageDirectory ? <th className="px-4 py-3">Role</th> : null}{canViewDetailedProgress ? <th className="px-4 py-3">Campaign prayer</th> : null}<th className="px-4 py-3">Campaign pledge</th>{canManageDirectory ? <th className="px-4 py-3">Directory connection</th> : null}<th className="px-4 py-3">Options</th></tr>
              </thead>
              <tbody>
                {users.map((entry) => {
                  const linkedEntry = "totalMinutesPrayed" in entry ? entry as LinkedUserSummary : null;
                  const staffEntry = "hasPledge" in entry ? entry : null;
                  return (
                  <tr key={entry.id} className="border-t border-white/10 bg-surface/50 align-top">
                    <td className="px-4 py-4"><p className="font-black text-white">{entry.name}{entry.id === user.id ? " (you)" : ""}</p><p className="mt-1 text-white/65">{entry.email}</p></td>
                    {canManageDirectory && linkedEntry ? <td className="px-4 py-4 capitalize text-white/80">{linkedEntry.role.replace(/_/g, " ")}</td> : null}
                    {canViewDetailedProgress && linkedEntry ? <td className="px-4 py-4 font-black text-yellow">{formatCount(linkedEntry.totalMinutesPrayed)}</td> : null}
                    <td className="px-4 py-4 text-white/80">{linkedEntry ? linkedEntry.minutesPerWeek ? `${formatCount(linkedEntry.minutesPerWeek)} min/week pace` : "No active pledge" : staffEntry?.hasPledge ? "Pledge recorded" : "No active pledge"}{canViewDetailedProgress && linkedEntry ? <span className="mt-1 block text-xs text-white/55">{formatCount(linkedEntry.totalMinutesPledged)} campaign minutes committed</span> : null}</td>
                    {canManageDirectory && linkedEntry ? <td className="px-4 py-4 text-white/70">{linkedEntry.planningCenterPersonId ? "Connected" : "Not connected"}<span className="mt-1 block text-xs text-white/55">Family {linkedEntry.familyCount} · Friends {linkedEntry.friendsCount}</span></td> : null}
                    <td className="px-4 py-4">{canManageDirectory && linkedEntry ? <MemberEditor entry={linkedEntry} credentialsConfigured={credentials.configured} /> : staffEntry ? <StaffEntryEditor entry={staffEntry} /> : null}</td>
                  </tr>
                  );
                })}
                {users.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-white/70">No people match this search.</td></tr> : null}
              </tbody>
            </table>
          </div>
          {memberTotal > memberPageSize ? (
            <div className="flex flex-wrap gap-3">
              {memberPage > 1 ? <Link href={`/admin/planning-center?member_q=${encodeURIComponent(memberSearch)}&member_page=${memberPage - 1}`} className="plc-button-secondary">Previous people</Link> : null}
              {memberOffset + users.length < memberTotal ? <Link href={`/admin/planning-center?member_q=${encodeURIComponent(memberSearch)}&member_page=${memberPage + 1}`} className="plc-button-secondary">Next people</Link> : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
