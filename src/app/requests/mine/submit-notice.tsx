"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccessibleDialog } from "@/app/components/accessible-dialog";

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
    body: "Thank you for trusting us with this. Your request will remain confidential between you and authorized church leaders and will not appear on the community board."
  },
  private_review: {
    title: "We received your request",
    body: "Thank you for trusting us with this. Your request will remain confidential between you and authorized church leaders and will not appear on the community board."
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
    <AccessibleDialog titleId="request-notice-title" descriptionId="request-notice-description" onEscape={close}>
      <div className="plc-panel w-full max-w-lg p-7 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
        <p className="plc-eyebrow">Prayer request</p>
        <h2 id="request-notice-title" className="mt-3 text-3xl font-black uppercase text-white">
          {content.title}
        </h2>
          <p id="request-notice-description" className="plc-copy mt-4 leading-7">{content.body}</p>
          <div className="mt-7 flex flex-wrap gap-3">
             <button type="button" onClick={close} className="plc-button" autoFocus>
            Done
            </button>
           <a href={notice === "private" || notice === "private_review" ? "/requests/mine#requests" : "/requests"} className="plc-button-secondary">
             {notice === "private" || notice === "private_review" ? "View my requests" : "View community board"}
           </a>
        </div>
      </div>
    </AccessibleDialog>
  );
}
