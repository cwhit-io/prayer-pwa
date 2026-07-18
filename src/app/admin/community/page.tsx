import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getPendingBoardReviewRequests,
  getDelayedBoardRequests
} from "@/lib/prayer-requests";

export const dynamic = "force-dynamic";

export default async function AdminCommunityHubPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
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

  const [pending, delayed] = await Promise.all([
    getPendingBoardReviewRequests(),
    getDelayedBoardRequests()
  ]);

  return (
    <main className="plc-page">
      <div className="plc-shell-wide space-y-8">
        <header className="space-y-3">
          <p className="plc-eyebrow">Admin · Community</p>
          <h1 className="plc-title">Board & requests.</h1>
          <p className="plc-copy max-w-2xl">
            Moderate prayer requests and keep the community board safe—keyword holds, delays, and publishing.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <article className="plc-panel p-5">
            <p className="text-xs font-black uppercase text-white/45">Needs review</p>
            <p className="mt-2 text-3xl font-black text-yellow">{pending.length}</p>
            <p className="mt-1 text-sm text-white/50">Keyword holds waiting for a decision</p>
          </article>
          <article className="plc-panel p-5">
            <p className="text-xs font-black uppercase text-white/45">Delayed publish</p>
            <p className="mt-2 text-3xl font-black text-white">{delayed.length}</p>
            <p className="mt-1 text-sm text-white/50">Scheduled for the board, not live yet</p>
          </article>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Link href="/admin/requests" className="plc-panel block p-6 transition hover:border-yellow">
            <h2 className="text-xl font-black uppercase text-white">Prayer requests</h2>
            <p className="plc-copy mt-2">
              All requests, status updates, and force-publish delayed community posts.
            </p>
          </Link>
          <Link href="/admin/moderation" className="plc-panel block p-6 transition hover:border-yellow">
            <h2 className="text-xl font-black uppercase text-white">Board safety</h2>
            <p className="plc-copy mt-2">
              Review queue and keyword list (CSV download / replace).{" "}
              {pending.length > 0 ? (
                <span className="font-black text-yellow">{pending.length} waiting</span>
              ) : (
                "Queue is clear."
              )}
            </p>
          </Link>
        </section>
      </div>
    </main>
  );
}
