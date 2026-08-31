"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { requestCategories } from "@/lib/request-options";

type Mode = "community" | "private";

function SubmitRequestButton() {
  const { pending } = useFormStatus();

  return (
    <button className="plc-button" disabled={pending}>
      {pending ? "Sending your request…" : "Submit request"}
    </button>
  );
}

export function RequestForm({
  action,
  canShareCommunity = true
}: {
  action: (formData: FormData) => Promise<void>;
  canShareCommunity?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(canShareCommunity ? "community" : "private");

  return (
    <form action={action} className="mt-6 space-y-4">
      <fieldset>
        <legend className="plc-label">Who should be able to see this request?</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className={`plc-card-muted flex items-start gap-3 p-4 ${canShareCommunity ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
            <input
              type="radio"
              name="visibility"
              value="church_anonymous"
              checked={mode === "community"}
              disabled={!canShareCommunity}
              onChange={() => setMode("community")}
              className="plc-checkbox mt-1"
            />
            <span>
              <span className="block font-black text-white">Signed-in community</span>
              <span className="mt-1 block text-sm leading-6 text-white/75">
                Visible to signed-in people whose profiles are connected to the church directory, and to the prayer
                team. You can hide your name below.
              </span>
            </span>
          </label>
          <label className="plc-card-muted flex cursor-pointer items-start gap-3 p-4">
            <input
              type="radio"
              name="visibility"
              value="prayer_team"
              checked={mode === "private"}
              onChange={() => setMode("private")}
              className="plc-checkbox mt-1"
            />
            <span>
              <span className="block font-black text-white">Private request</span>
              <span className="mt-1 block text-sm leading-6 text-white/75">
                Kept confidential between you and authorized church leaders. It will not appear on the community board.
              </span>
            </span>
          </label>
        </div>
      </fieldset>
      {!canShareCommunity ? (
        <p className="text-base leading-7 text-yellow">Connect your church profile to share on the community board. Private requests are available now.</p>
      ) : null}

      <label className="plc-label block space-y-2">
        <span>Title</span>
        <input required name="title" className="plc-input w-full px-4 py-3" />
      </label>
      <label className="plc-label block space-y-2">
        <span>What would you like us to pray for?</span>
        <textarea
          required
          name="body"
          className="plc-input min-h-32 w-full px-4 py-3"
          placeholder="Share only what you feel comfortable sharing."
        />
      </label>
      <label className="plc-label block space-y-2">
        <span>What is this request about?</span>
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
          Hide my name from other members. Authorized church leaders can still identify the submitter when care or moderation requires it.
        </label>
      ) : null}

      <p className="text-sm leading-6 text-white/70">
        {mode === "community"
          ? "Community requests are reviewed and may take a little time to appear."
          : "Your private request will not appear on the community board. You can track it under My requests."}
      </p>
      <SubmitRequestButton />
    </form>
  );
}
