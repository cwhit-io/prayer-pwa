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
             To protect participant privacy, requests are available only to signed-in people whose profiles are
             connected to the church directory.
           </p>
          <Link href="/auth" className="plc-button mt-5">
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  if (!user.planningCenterPersonId) {
    return (
      <main className="plc-page">
        <section className="plc-panel mx-auto max-w-3xl p-6">
          <p className="plc-eyebrow">Community board</p>
          <h1 className="mt-2 text-3xl font-black uppercase text-white">Connect your church profile</h1>
          <p className="plc-copy mt-3">
            To protect participant privacy, the community board is available only to signed-in people whose profiles
            are connected to the church directory. Your account is signed in, but it is not currently connected.
          </p>
          <p className="mt-3 text-base leading-7 text-white/75">
            Contact the church office for help connecting your profile. You can still view your own requests or share
            a confidential request visible only to you and authorized church leaders.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/auth" className="plc-button">
              View my profile
            </Link>
            <Link href="/requests/mine#requests" className="plc-button-secondary">
              My requests
            </Link>
          </div>
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
           <h1 className="plc-title max-w-3xl">Pray with your church family.</h1>
             <p className="plc-copy max-w-2xl">
               Choose <strong className="text-white">Pray for this request</strong> to open the prayer timer with a
               request already selected. You can pray in your own words or use the optional ACTS guide.
             </p>
             <p className="text-sm text-white/75">
               Names are shown only when the person chose to share them. Requests marked Anonymous hide the requester&apos;s
               name from the community board.
             </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/requests/mine#requests" className="plc-button">
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
               {needsPrayer > 0 ? `${needsPrayer} requests are waiting for prayer` : "Requests from your church family"}
            </h2>
          </div>

          {items.length > 0 ? (
            <BoardList items={items} signedIn />
          ) : (
            <div className="py-8 text-center">
               <h2 className="text-2xl font-black uppercase text-white">No community requests yet</h2>
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
