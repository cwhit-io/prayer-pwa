import { PrayButton } from "@/app/components/pray-button";
import { prayerCountLabel, type SessionFocus } from "@/lib/pray-links";

export type BoardItemView = {
  id: string;
  requestId: string | null;
  kind: string;
  title: string;
  body: string;
  category: string;
  authorLabel: string;
  createdAt: string;
  status: string;
  prayerCount: number;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function statusLabel(status: string) {
  if (status === "praying") {
    return "Being prayed for";
  }
  if (status === "answered") {
    return "Answered";
  }
  if (status === "open") {
    return "Open";
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function toFocus(item: BoardItemView): SessionFocus | null {
  if (!item.requestId) {
    return null;
  }
  return {
    kind: "request",
    id: item.requestId,
    title: item.title,
    body: item.body,
    category: item.category
  };
}

export function BoardList({ items, signedIn }: { items: BoardItemView[]; signedIn: boolean }) {
  return (
    <div className="space-y-4">
      {items.map((item) => {
        const focus = toFocus(item);
        return (
          <article key={item.id} className="plc-card-muted p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase text-yellow">{item.category}</p>
                <h2 className="mt-1 text-2xl font-black text-white">{item.title}</h2>
                <p className="mt-1 text-sm text-white/50">
                  {item.authorLabel} · {formatDate(item.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`plc-status ${
                    item.prayerCount === 0 ? "border-yellow/60 text-yellow" : ""
                  }`}
                >
                  {prayerCountLabel(item.prayerCount)}
                </span>
                <span className="plc-status">{statusLabel(item.status)}</span>
              </div>
            </div>
            <p className="mt-4 leading-7 text-white/75">{item.body}</p>

            {focus ? (
              <div className="mt-5">
                <PrayButton focus={focus} signedIn={signedIn} prayerCount={item.prayerCount} />
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
