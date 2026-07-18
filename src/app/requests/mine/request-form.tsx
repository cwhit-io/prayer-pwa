"use client";

import { useState } from "react";
import { requestCategories } from "@/lib/request-options";

type Mode = "community" | "private";

export function RequestForm({
  action
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>("community");

  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">Share with</p>
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-white/15 bg-black/30 p-1">
          <button
            type="button"
            onClick={() => setMode("community")}
            className={`rounded-lg px-3 py-3 text-sm font-black uppercase transition ${
              mode === "community"
                ? "bg-yellow text-black"
                : "text-white/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            Community board
          </button>
          <button
            type="button"
            onClick={() => setMode("private")}
            className={`rounded-lg px-3 py-3 text-sm font-black uppercase transition ${
              mode === "private"
                ? "bg-yellow text-black"
                : "text-white/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            Private prayer
          </button>
        </div>
        <p className="mt-2 text-xs leading-5 text-white/45">
          {mode === "community"
            ? "Shared on the community board (may take a little time to appear)."
            : "Shared only with the prayer team — not shown on the board."}
        </p>
      </div>

      <input
        type="hidden"
        name="visibility"
        value={mode === "community" ? "church_anonymous" : "prayer_team"}
      />

      <label className="plc-label block space-y-2">
        <span>Title</span>
        <input required name="title" className="plc-input w-full px-4 py-3" />
      </label>
      <label className="plc-label block space-y-2">
        <span>Details</span>
        <textarea required name="body" className="plc-input min-h-32 w-full px-4 py-3" />
      </label>
      <label className="plc-label block space-y-2">
        <span>Category</span>
        <select required name="category" className="plc-input w-full px-4 py-3">
          {requestCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>

      {mode === "community" ? (
        <label className="plc-card-muted flex items-center gap-3 px-4 py-3 text-sm text-white/75">
          <input name="is_anonymous" type="checkbox" className="plc-checkbox" />
          Hide my name on the community board
        </label>
      ) : null}

      <p className="text-xs leading-5 text-white/45">
        {mode === "community"
          ? "Community board posts may take a little time to appear. Thank you for your patience while we care for one another well."
          : "Private prayer requests are handled confidentially by the prayer team."}
      </p>
      <button className="plc-button">Submit request</button>
    </form>
  );
}
