"use client";

import { useState } from "react";
import { FriendsIcon } from "@/app/components/icons";
import type { PrayerFriendSlot } from "@/lib/prayer-friends";
import { savePrayerFriendsAction } from "./friends-actions";

export function FourFriendsList({ initialSlots }: { initialSlots: PrayerFriendSlot[] }) {
  const [editing, setEditing] = useState(false);
  const filled = initialSlots.filter((slot) => slot.name.length > 0);

  return (
    <article id="friends" className="plc-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <FriendsIcon className="h-8 w-8 text-yellow" />
          <div>
            <p className="plc-eyebrow">Pray for</p>
            <h2 className="text-2xl font-black uppercase text-white">My Friends</h2>
          </div>
        </div>
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)} className="plc-button-secondary">
            {filled.length > 0 ? "Edit list" : "Add friends"}
          </button>
        ) : null}
      </div>
      <p className="plc-copy mt-2">
        Name four people you&apos;ll carry in prayer this year—neighbors, coworkers, classmates, or anyone on your
        heart.
      </p>

      {editing ? (
        <form action={savePrayerFriendsAction} className="mt-5 space-y-3">
          {initialSlots.map((slot) => (
            <label key={slot.slot} className="plc-label block space-y-2">
              <span>Friend {slot.slot}</span>
              <input
                name={`friend_${slot.slot}`}
                defaultValue={slot.name}
                maxLength={80}
                placeholder={`Name ${slot.slot}`}
                className="plc-input w-full px-4 py-3"
              />
            </label>
          ))}
          <div className="flex flex-wrap gap-3 pt-2">
            <button className="plc-button">Save friends</button>
            <button type="button" onClick={() => setEditing(false)} className="plc-button-secondary">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {initialSlots.map((slot) => (
            <div key={slot.slot} className="plc-card-muted px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Friend {slot.slot}</p>
              <p className={`mt-1 font-black ${slot.name ? "text-white" : "text-white/35"}`}>
                {slot.name || "—"}
              </p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
