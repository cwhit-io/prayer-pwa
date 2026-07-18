"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type NoticeKind = "delayed" | "review" | "private" | "private_review";

const copy: Record<
  NoticeKind,
  { title: string; body: string }
> = {
  delayed: {
    title: "We received your request",
    body: "Thank you for trusting us with this. Your prayer is already being carried. If you shared it with the community board, it may take a little time to appear—thank you for your patience while we care for one another well. We are praying with you."
  },
  review: {
    title: "We received your request",
    body: "Thank you for trusting us with this. Your prayer is already being carried. If you shared it with the community board, it may take a little time to appear—thank you for your patience while we care for one another well. We are praying with you."
  },
  private: {
    title: "We received your request",
    body: "Thank you for trusting us with this. Your request has been shared privately with the prayer team. We are praying with you."
  },
  private_review: {
    title: "We received your request",
    body: "Thank you for trusting us with this. Your request has been shared privately with the prayer team. We are praying with you."
  }
};

export function SubmitNoticeModal({
  notice
}: {
  notice: NoticeKind | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(notice));

  useEffect(() => {
    setOpen(Boolean(notice));
  }, [notice]);

  if (!open || !notice) {
    return null;
  }

  const content = copy[notice] ?? copy.delayed;

  function close() {
    setOpen(false);
    router.replace("/requests/mine", { scroll: false });
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-notice-title"
    >
      <div className="plc-panel w-full max-w-lg p-7 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
        <p className="plc-eyebrow">Prayer team</p>
        <h2 id="request-notice-title" className="mt-3 text-3xl font-black uppercase text-white">
          {content.title}
        </h2>
        <p className="plc-copy mt-4 leading-7">{content.body}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <button type="button" onClick={close} className="plc-button">
            Amen
          </button>
          <a href="/requests" className="plc-button-secondary">
            Community board
          </a>
        </div>
      </div>
    </div>
  );
}
