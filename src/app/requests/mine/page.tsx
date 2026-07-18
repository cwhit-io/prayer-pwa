import Link from "next/link";
import { FormBanner } from "@/app/components/form-banner";
import { getCurrentUser } from "@/lib/auth";
import { getRequestsForUser } from "@/lib/prayer-requests";
import {
  createPrayerRequestAction,
  markMyRequestAnsweredAction,
  unpublishMyRequestAction
} from "../actions";
import { RequestForm } from "./request-form";
import { SubmitNoticeModal } from "./submit-notice";

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

function statusLabel(status: string) {
  if (status === "praying") {
    return "Being prayed for";
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function boardStatusLabel(request: {
  visibility: string;
  boardModeration: string;
  publishAt: string | null;
}) {
  if (request.visibility !== "church_anonymous") {
    if (request.visibility === "prayer_team") {
      return "Private prayer";
    }
    return null;
  }

  if (request.boardModeration === "unpublished") {
    return "Removed from board";
  }

  if (request.boardModeration === "rejected") {
    return "Not on board";
  }

  // Don't reveal keyword holds — keep language the same as a normal delay.
  if (
    request.boardModeration === "pending_review" ||
    (request.publishAt && new Date(request.publishAt).getTime() > Date.now())
  ) {
    return "May take a little time to appear on the board";
  }
  return "On community board";
}

function canUnpublishFromBoard(request: {
  visibility: string;
  boardModeration: string;
  status: string;
}) {
  if (request.status === "archived") {
    return false;
  }
  if (request.visibility === "church_anonymous") {
    return (
      request.boardModeration === "published" || request.boardModeration === "pending_review"
    );
  }
  // Private prayer: "remove" closes/archives the request.
  return request.status !== "archived";
}

export default async function MyRequestsPage({
  searchParams
}: {
  searchParams?: Promise<{ posted?: string; notice?: string; error?: string; updated?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;

  if (!user) {
    return (
      <main className="plc-page">
        <section className="plc-panel mx-auto max-w-3xl p-6">
          <h1 className="text-3xl font-black uppercase text-white">Sign in for your requests</h1>
          <p className="plc-copy mt-2">Your personal request list stays connected to your account.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/auth" className="plc-button">
              Sign in
            </Link>
            <Link href="/requests" className="plc-button-secondary">
              Community board
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const requests = await getRequestsForUser(user.id);

  const notice =
    params?.notice === "review" ||
    params?.notice === "delayed" ||
    params?.notice === "private" ||
    params?.notice === "private_review"
      ? params.notice
      : params?.posted === "private"
        ? "private"
        : params?.posted === "community"
          ? "delayed"
          : null;

  return (
    <main className="plc-page">
      <SubmitNoticeModal notice={notice} />
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section id="submit" className="plc-panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="plc-eyebrow">My requests</p>
              <h1 className="mt-2 text-4xl font-black uppercase text-white">Share a request.</h1>
              <p className="plc-copy mt-2">Choose community board or private prayer below.</p>
            </div>
            <Link href="/requests" className="plc-button-secondary">
              View board
            </Link>
          </div>

          <div className="mt-4">
            <FormBanner
              error={params?.error}
              success={
                params?.updated === "answered"
                  ? "Marked as answered."
                  : params?.updated === "unpublished"
                    ? "Removed from the community board."
                    : params?.updated === "closed"
                      ? "Request closed."
                      : null
              }
            />
          </div>

          <RequestForm action={createPrayerRequestAction} />
        </section>

        <section className="space-y-4">
          <div className="plc-panel p-6">
            <h2 className="text-2xl font-black uppercase text-paper">Your requests</h2>
            <p className="plc-copy mt-2 text-sm">
              Mark answered when God has moved, or remove a community request from the board.
            </p>
            <div className="mt-5 space-y-3">
              {requests.length > 0 ? (
                requests.map((request) => {
                  const boardLabel = boardStatusLabel(request);
                  const showAnswer =
                    request.status === "open" || request.status === "praying";
                  const showUnpublish = canUnpublishFromBoard(request);
                  return (
                    <article key={request.id} className="plc-card-muted p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black uppercase text-yellow">{request.category}</p>
                          <h3 className="mt-1 text-lg font-black text-paper">{request.title}</h3>
                        </div>
                        <span className="plc-status">{statusLabel(request.status)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted">{request.body}</p>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-white/45">
                        {formatDate(request.createdAt)}
                        {boardLabel ? ` · ${boardLabel}` : ""}
                        {request.isAnonymous ? " · Anonymous" : ""}
                      </p>
                      {showAnswer || showUnpublish ? (
                        <div className="mt-4 flex flex-wrap gap-2 border-t border-paper/10 pt-3">
                          {showAnswer ? (
                            <form action={markMyRequestAnsweredAction}>
                              <input type="hidden" name="id" value={request.id} />
                              <button type="submit" className="plc-button">
                                Mark answered
                              </button>
                            </form>
                          ) : null}
                          {showUnpublish ? (
                            <form action={unpublishMyRequestAction}>
                              <input type="hidden" name="id" value={request.id} />
                              <button type="submit" className="plc-button-secondary">
                                {request.visibility === "church_anonymous"
                                  ? "Remove from board"
                                  : "Close request"}
                              </button>
                            </form>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <p className="plc-copy">No requests submitted yet.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
