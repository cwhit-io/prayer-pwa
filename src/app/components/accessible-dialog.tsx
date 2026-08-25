"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function AccessibleDialog({
  titleId,
  descriptionId,
  children,
  onEscape
}: {
  titleId: string;
  descriptionId?: string;
  children: ReactNode;
  onEscape?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="m-auto w-full max-w-lg bg-transparent p-5 text-left backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      onCancel={(event) => {
        event.preventDefault();
        onEscape?.();
      }}
    >
      {children}
    </dialog>
  );
}
