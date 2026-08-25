"use client";

import type { MouseEvent } from "react";

export function ConfirmDeleteButton() {
  function confirmDelete(event: MouseEvent<HTMLButtonElement>) {
    const confirmed = window.confirm(
      "Delete this prayer request permanently? The request and its prayer records will be removed and cannot be restored."
    );

    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <button type="submit" onClick={confirmDelete} className="plc-button-secondary text-danger">
      Delete permanently
    </button>
  );
}
