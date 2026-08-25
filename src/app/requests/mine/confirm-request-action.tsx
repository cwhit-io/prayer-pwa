"use client";

import type { ReactNode } from "react";

export function ConfirmRequestAction({
  action,
  requestId,
  confirmation,
  className,
  children
}: {
  action: (formData: FormData) => Promise<void>;
  requestId: string;
  confirmation: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmation)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={requestId} />
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
