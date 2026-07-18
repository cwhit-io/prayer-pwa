import Link from "next/link";
import { FormBanner } from "@/app/components/form-banner";
import { getCurrentUser } from "@/lib/auth";
import {
  getAdminPrayerRequests,
  getDelayedBoardRequests,
  getPendingBoardReviewRequests,
  requestStatuses
} from "@/lib/prayer-requests";
import {
  publishRequestNowAction,
  updateRequestStatusAction
} from "./actions";
import {
  approveBoardRequestAction,
  rejectBoardRequestAction
} from "@/app/admin/moderation/actions";

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

export default async function AdminRequestsPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; status_saved?: string; published?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;

  if (!user) {
    return (
      <main className="plc-page">
        <section className="plc-panel mx-auto max-w-3xl p-6">
          <h1 className="text-3xl font-black uppercase text-white">Sign in required</h1>
          <p className="plc-copy mt-2">Request moderation is available to admin users.</p>
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
          <p className="plc-copy mt-2">Your account is signed in, but it does not have the admin role yet.</p>
        </section>
      </main>
    );
  }

  const [requests, delayed, reviewQueue] = await Promise.all([
    getAdminPrayerRequests(),
    getDelayedBoardRequests(),
    getPendingBoardReviewRequests()
  ]);

  const delayedIds = new Set(delayed.map((item) => item.id));
  const reviewIds = new Set(
    reviewQueue.filter((item) => item.boardModeration === "pending_review").map((item) => item.id)
  );

  return (
    <main className="plc-page">
      <div className="plc-shell-wide space-y-8">
        <header className="space-y-3">
          <p className="plc-eyebrow">Admin</p>
          <h1 className="plc-title">Prayer request moderation.</h1>
          <p className="plc-copy">
            Keyword rules live under{" "}
            <Link href="/admin/moderation" className="font-black uppercase text-yellow">
              Moderation
            </Link>
            . Delayed community posts can be published here immediately.
          </p>
          <FormBanner
            error={params?.error}
            success={
              params?.status_saved === "1"
                ? "Request status updated."
                : params?.published === "1"
                  ? "Request published to the board."
                  : null
            }
          />
        </header>

        {delayed.length > 0 ? (
          <section className="space-y-4">
            <h2 className="text-2xl font-black uppercase text-white">
              Pending board publish ({delayed.length})
            </h2>
            <p className="plc-copy">
              These community posts are scheduled with a random delay. Publish now if you want them on the board
              immediately.
            </p>
            {delayed.map((request) => (
              <article key={request.id} className="plc-panel border border-yellow/30 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black uppercase text-yellow">{request.category}</p>
                    <h3 className="mt-1 text-xl font-black text-white">{request.title}</h3>
                    <p className="mt-1 text-sm text-white/50">
                      {request.isAnonymous ? "Anonymous" : request.requesterName ?? "Unknown"} · Scheduled{" "}
                      {request.publishAt ? formatDate(request.publishAt) : "soon"}
                    </p>
                  </div>
                  <span className="plc-status border-yellow/50 text-yellow">Delayed</span>
                </div>
                <p className="mt-4 leading-7 text-white/75">{request.body}</p>
                <form action={publishRequestNowAction} className="mt-5">
                  <input type="hidden" name="id" value={request.id} />
                  <button className="plc-button">Publish to board now</button>
                </form>
              </article>
            ))}
          </section>
        ) : null}

        {reviewQueue.filter((item) => item.boardModeration === "pending_review").length > 0 ? (
          <section className="space-y-4">
            <h2 className="text-2xl font-black uppercase text-white">Keyword holds</h2>
            {reviewQueue
              .filter((item) => item.boardModeration === "pending_review")
              .map((request) => (
                <article key={request.id} className="plc-panel border border-yellow/20 p-5">
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
                    </div>
                    <span className="plc-status">Needs review</span>
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
                  </div>
                </article>
              ))}
          </section>
        ) : null}

        <section className="space-y-4">
          <h2 className="text-2xl font-black uppercase text-white">All requests</h2>
          {requests.length > 0 ? (
            requests.map((request) => {
              const isDelayed = delayedIds.has(request.id);
              const isHeld = reviewIds.has(request.id);
              return (
                <article key={request.id} className="plc-panel p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-black uppercase text-yellow">{request.category}</p>
                      <h2 className="mt-1 text-xl font-black text-white">{request.title}</h2>
                      <p className="mt-1 text-sm text-white/50">
                        {request.isAnonymous
                          ? request.verifiedAnonymous && request.requesterName
                            ? `${request.requesterName} (verified anonymous)`
                            : "Anonymous"
                          : request.requesterName ?? "Unknown"}{" "}
                        · {request.visibility === "church_anonymous" ? "Community board" : "Private prayer"}
                        {" · "}
                        {formatDate(request.createdAt)}
                        {isHeld ? " · Board review" : ""}
                        {isDelayed && request.publishAt
                          ? ` · Delayed until ${formatDate(request.publishAt)}`
                          : ""}
                        {request.matchedKeywords ? ` · Keywords: ${request.matchedKeywords}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isDelayed ? <span className="plc-status border-yellow/50 text-yellow">Delayed</span> : null}
                      {isHeld ? <span className="plc-status">Review</span> : null}
                      <span className="plc-status">{request.status}</span>
                    </div>
                  </div>
                  <p className="mt-4 leading-7 text-white/70">{request.body}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {(isDelayed || isHeld) && request.visibility === "church_anonymous" ? (
                      <form action={publishRequestNowAction}>
                        <input type="hidden" name="id" value={request.id} />
                        <button className="plc-button">Publish to board now</button>
                      </form>
                    ) : null}
                    <form action={updateRequestStatusAction} className="flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={request.id} />
                      {requestStatuses.map((status) => (
                        <button key={status} name="status" value={status} className="plc-button-secondary">
                          {status}
                        </button>
                      ))}
                    </form>
                  </div>
                </article>
              );
            })
          ) : (
            <article className="plc-panel p-6">
              <h2 className="text-2xl font-black uppercase text-white">No requests yet</h2>
              <p className="plc-copy mt-2">Submitted requests will appear here for moderation.</p>
            </article>
          )}
        </section>
      </div>
    </main>
  );
}
