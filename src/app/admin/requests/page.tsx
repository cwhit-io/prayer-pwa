import Link from "next/link";
import { FormBanner } from "@/app/components/form-banner";
import { getCurrentUser, hasCapability } from "@/lib/auth";
import type { PrayerRequest } from "@/lib/prayer-requests";
import { auditPrivateRequestListAccess, getAdminPrayerRequests, getDelayedBoardRequests, getPendingBoardReviewRequests } from "@/lib/prayer-requests";
import {
  deleteRequestAction,
  publishRequestNowAction,
  updateRequestStatusAction
} from "./actions";
import { approveBoardRequestAction, rejectBoardRequestAction } from "@/app/admin/moderation/actions";
import { ConfirmDeleteButton } from "../confirm-delete-button";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function displayStatus(request: PrayerRequest, isDelayed: boolean, isHeld: boolean) {
  if (isHeld) return "Needs private review";
  if (isDelayed) return "Approved, waiting to appear";
  if (request.status === "praying") return "People are praying";
  if (request.status === "answered") return "Answered";
  if (request.status === "archived") return "Archived";
  return "Open";
}

function RequestTable({
  requests,
  delayedIds,
  reviewIds,
  isAdmin,
  reviewQueue = false
}: {
  requests: PrayerRequest[];
  delayedIds: Set<string>;
  reviewIds: Set<string>;
  isAdmin: boolean;
  reviewQueue?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[60rem] text-left text-sm">
        <thead className="bg-black/30 text-xs font-black uppercase tracking-wide text-white/70">
          <tr>
            <th className="px-4 py-3">Request</th>
            <th className="px-4 py-3">Submitted by</th>
            <th className="px-4 py-3">Visibility</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Options</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => {
            const isDelayed = delayedIds.has(request.id);
            const isHeld = reviewIds.has(request.id);
            return (
              <tr key={request.id} className="border-t border-white/10 bg-surface/50 align-top">
                <td className="px-4 py-4">
                  <p className="font-black text-white">{request.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-yellow">{request.category}</p>
                  <p className="mt-2 max-w-xs truncate text-white/65" title={request.body}>{request.body}</p>
                  {request.matchedKeywords ? <p className="mt-1 text-xs text-yellow">Matched: {request.matchedKeywords}</p> : null}
                </td>
                <td className="px-4 py-4 text-white/75">{request.isAnonymous ? "Anonymous" : request.requesterName ?? "Unknown"}</td>
                <td className="px-4 py-4 text-white/75">{request.visibility === "church_anonymous" ? "Community board" : "Private prayer"}</td>
                <td className="px-4 py-4 font-black text-white">{displayStatus(request, isDelayed, isHeld)}</td>
                <td className="whitespace-nowrap px-4 py-4 text-white/65">{formatDate(request.createdAt)}</td>
                <td className="px-4 py-4">
                  <div className="flex min-w-[13rem] flex-wrap gap-2">
                    {reviewQueue && isHeld ? (
                      <>
                        <form action={approveBoardRequestAction}><input type="hidden" name="id" value={request.id} /><button className="plc-button">Approve and publish</button></form>
                        <form action={rejectBoardRequestAction}><input type="hidden" name="id" value={request.id} /><button className="plc-button-secondary">Keep off board</button></form>
                      </>
                    ) : null}
                    {isDelayed ? <form action={publishRequestNowAction}><input type="hidden" name="id" value={request.id} /><button className="plc-button-secondary">Publish now</button></form> : null}
                    <form action={updateRequestStatusAction}>
                      <input type="hidden" name="id" value={request.id} />
                      <input type="hidden" name="status" value={request.status === "archived" ? "open" : "archived"} />
                      <button className="plc-button-secondary">{request.status === "archived" ? "Unarchive" : "Archive"}</button>
                    </form>
                    {isAdmin ? <form action={deleteRequestAction}><input type="hidden" name="id" value={request.id} /><ConfirmDeleteButton /></form> : null}
                  </div>
                </td>
              </tr>
            );
          })}
          {requests.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-white/70">Nothing is waiting here.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminRequestsPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; status_saved?: string; published?: string; deleted?: string; approved?: string; rejected?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;

  if (!user) {
    return <main className="plc-page"><section className="plc-panel mx-auto max-w-3xl p-6"><h1 className="text-3xl font-black uppercase text-white">Sign in required</h1><p className="plc-copy mt-2">Prayer request review is available to admins and prayer-team members.</p><Link href="/auth" className="plc-button mt-5">Sign in</Link></section></main>;
  }

  if (!hasCapability(user.role, "community-requests:moderate")) {
    return <main className="plc-page"><section className="plc-panel mx-auto max-w-3xl p-6"><h1 className="text-3xl font-black uppercase text-white">Staff access needed</h1><p className="plc-copy mt-2">Your account does not have admin or prayer-team access.</p></section></main>;
  }

  const canViewPrivate = hasCapability(user.role, "private-requests:read");
  const [requests, delayed, reviewQueue] = await Promise.all([
    getAdminPrayerRequests({ includePrivate: canViewPrivate }),
    getDelayedBoardRequests(),
    getPendingBoardReviewRequests()
  ]);
  const delayedIds = new Set(delayed.map((item) => item.id));
  const reviewRequests = reviewQueue.filter((item) => item.boardModeration === "pending_review");
  const reviewIds = new Set(reviewRequests.map((item) => item.id));
  if (canViewPrivate) {
    await auditPrivateRequestListAccess(user.id);
  }

  return (
    <main className="plc-page">
      <div className="plc-shell-wide space-y-8">
        <header className="space-y-3">
          <p className="plc-eyebrow">Admin · Prayer requests</p>
          <h1 className="plc-title">Review prayer requests.</h1>
          <p className="plc-copy">Use the tables below to review requests, archive old requests, restore archived requests, or permanently delete requests when necessary.</p>
          <FormBanner error={params?.error} success={params?.approved === "1" ? "Request approved and published." : params?.rejected === "1" ? "Request kept off the community board." : params?.deleted === "1" ? "Request permanently deleted." : params?.status_saved === "1" ? "Request status updated." : params?.published === "1" ? "Request published to the board." : null} />
        </header>

        <section className="space-y-4 border-l-4 border-yellow pl-5">
          <div><h2 className="text-2xl font-black uppercase text-white">Held community requests</h2><p className="plc-copy mt-1">Admins can approve a held community request or keep it off the board. Prayer Team cannot access this queue.</p></div>
          <RequestTable requests={reviewRequests} delayedIds={delayedIds} reviewIds={reviewIds} isAdmin reviewQueue />
        </section>

        <section className="space-y-4">
          <div><h2 className="text-2xl font-black uppercase text-white">{canViewPrivate ? "All requests" : "Community requests"}</h2><p className="plc-copy mt-1">{canViewPrivate ? "Private requests are visible here because you are a superadmin. Access should be limited to care and moderation needs." : "Private requests are excluded. Archive community requests that no longer belong in the active list."}</p></div>
          <RequestTable requests={requests} delayedIds={delayedIds} reviewIds={reviewIds} isAdmin />
        </section>
      </div>
    </main>
  );
}
