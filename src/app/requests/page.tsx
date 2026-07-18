import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCommunityBoardItems } from "@/lib/prayer-requests";
import { BoardList } from "./board-list";

export const dynamic = "force-dynamic";

export default async function CommunityBoardPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="plc-page">
        <section className="plc-panel mx-auto max-w-3xl p-6">
          <p className="plc-eyebrow">Community board</p>
          <h1 className="mt-2 text-3xl font-black uppercase text-white">Sign in to view requests</h1>
          <p className="plc-copy mt-3">
            The community prayer board is only available to signed-in members of the campaign.
          </p>
          <Link href="/auth" className="plc-button mt-5">
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  const board = await getCommunityBoardItems();

  const needsPrayer = board.filter(
    (item) => item.kind === "request" && item.status !== "answered" && item.prayerCount === 0
  ).length;

  const items = board.map((item) => ({
    id: item.id,
    requestId: item.requestId,
    kind: item.kind,
    title: item.title,
    body: item.body,
    category: item.category,
    authorLabel: item.authorLabel,
    createdAt: item.createdAt,
    status: item.status,
    prayerCount: item.prayerCount
  }));

  return (
    <main className="plc-page">
      <div className="plc-shell-wide space-y-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3">
            <p className="plc-eyebrow">Community board</p>
            <h1 className="plc-title max-w-3xl">Pray with the church family.</h1>
            <p className="plc-copy max-w-2xl">
              Tap <strong className="text-white">Pray</strong> to open the PRAY page with that request.
              On Supplication, <strong className="text-white">I prayed for this</strong> records a prayer and loads
              the next one. Needs with fewer prayers float to the top.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/requests/mine" className="plc-button">
              My requests
            </Link>
            <Link href="/requests/mine#submit" className="plc-button-secondary">
              Share a request
            </Link>
          </div>
        </header>

        <section className="dark-panel space-y-6 p-6 sm:p-8">
          <div className="border-b border-white/10 pb-5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-yellow">Together</p>
            <h2 className="mt-2 text-3xl font-black uppercase text-white">
              {needsPrayer > 0 ? `${needsPrayer} need prayer` : "Board feed"}
            </h2>
          </div>

          {items.length > 0 ? (
            <BoardList items={items} signedIn />
          ) : (
            <div className="py-8 text-center">
              <h2 className="text-2xl font-black uppercase text-white">The board is ready</h2>
              <p className="plc-copy mx-auto mt-3 max-w-lg">
                When someone shares a community request, it will appear here for the church to pray over.
              </p>
              <Link href="/requests/mine#submit" className="plc-button mt-6">
                Share the first request
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
