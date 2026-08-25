"use client";

import { useState } from "react";
import { FormSubmitButton } from "@/app/components/form-submit-button";
import type { PrayerFriendSlot } from "@/lib/prayer-friends";
import { savePrayerFriendsAction } from "./friends-actions";

export function FourFriendsList({ initialSlots }: { initialSlots: PrayerFriendSlot[] }) {
  const [editing, setEditing] = useState(false);
  const filled = initialSlots.filter((slot) => slot.name.length > 0);

  return (
    <article id="friends" className="plc-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="plc-eyebrow">Private prayer list</p>
          <h2 className="mt-1 text-2xl font-black uppercase text-white">My Four Friends</h2>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="plc-button-secondary"
            aria-expanded={editing}
            aria-controls="four-friends-editor"
          >
            {filled.length > 0 ? "Edit list" : "Add friends"}
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-white/65">
        Edit the four friends you&apos;re praying will know Jesus. Names stay private.
      </p>

      {editing ? (
        <form id="four-friends-editor" action={savePrayerFriendsAction} className="mt-5 space-y-3">
          {initialSlots.map((slot) => (
            <label key={slot.slot} className="plc-label block space-y-2">
              <span>Friend {slot.slot}</span>
              <input
                 name={`friend_${slot.slot}`}
                 autoFocus={slot.slot === 1}
                defaultValue={slot.name}
                maxLength={80}
                placeholder={`Name ${slot.slot}`}
                className="plc-input w-full px-4 py-3"
              />
            </label>
          ))}
          <div className="flex flex-wrap gap-3 pt-2">
            <FormSubmitButton pendingLabel="Saving your prayer list…">Save prayer list</FormSubmitButton>
            <button type="button" onClick={() => setEditing(false)} className="plc-button-secondary">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {filled.length > 0 ? filled.map((slot) => (
            <span key={slot.slot} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-black text-white">
              {slot.name}
            </span>
          )) : (
            <p className="text-sm text-white/60">No friends added yet.</p>
          )}
        </div>
      )}
    </article>
  );
}
