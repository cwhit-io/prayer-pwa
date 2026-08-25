"use client";

import Link from "next/link";
import { useState } from "react";

type PersonOption = {
  id: string;
  name: string;
  detail?: string | null;
};

type GroupKey = "friends" | "household" | "church";

function prayForHref(kind: "person" | "group", label: string) {
  return `/log?focus_type=${kind}&focus_label=${encodeURIComponent(label)}`;
}

export function PeopleFocusPicker({
  friends,
  household,
  churchFamily,
  churchProfileConnected
}: {
  friends: PersonOption[];
  household: PersonOption[];
  churchFamily: PersonOption[];
  churchProfileConnected: boolean;
}) {
  const [active, setActive] = useState<GroupKey>(
    friends.length > 0 ? "friends" : household.length > 0 ? "household" : churchFamily.length > 0 ? "church" : "friends"
  );
  const groups: Record<GroupKey, { label: string; people: PersonOption[]; groupLabel: string | null }> = {
    friends: { label: "Four friends", people: friends, groupLabel: friends.length > 0 ? "My Four Friends" : null },
    household: { label: "Household", people: household, groupLabel: "My Household" },
    church: { label: "Church family", people: churchFamily, groupLabel: "My Church Family" }
  };
  const selected = groups[active];

  return (
    <div className="plc-panel overflow-hidden">
      <div className="grid grid-cols-3 border-b border-white/10" role="tablist" aria-label="People groups">
        {(Object.keys(groups) as GroupKey[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active === key}
            aria-controls="people-focus-panel"
            onClick={() => setActive(key)}
            className={`min-h-14 px-2 py-3 text-sm font-black sm:px-4 ${active === key ? "bg-yellow text-black" : "text-white/75 hover:bg-white/5 hover:text-white"}`}
          >
            {groups[key].label}
          </button>
        ))}
      </div>

      <div id="people-focus-panel" role="tabpanel" className="p-5 sm:p-6">
        {active === "friends" ? (
          <p className="mb-4 text-sm leading-6 text-white/75">
            Pray intentionally for these friends who do not yet know Jesus to know him and receive salvation.
          </p>
        ) : null}
        {selected.groupLabel && selected.people.length > 0 ? (
          <Link href={prayForHref("group", selected.groupLabel)} className="plc-button-secondary mb-4 w-full">
            {active === "friends" ? "Pray for all four friends" : `Pray for everyone in ${selected.label.toLowerCase()}`}
          </Link>
        ) : null}

        {selected.people.length > 0 ? (
          <div className="max-h-[32rem] space-y-2 overflow-y-auto overscroll-contain pr-1">
            {selected.people.map((person) => (
              <div key={person.id} className="plc-card-muted grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="font-black text-white">{person.name}</p>
                  {person.detail ? <p className="mt-1 text-sm text-white/70">{person.detail}</p> : null}
                </div>
                <Link
                  href={prayForHref("person", person.name)}
                  className="inline-flex min-h-11 items-center font-black text-yellow"
                  aria-label={`Pray for ${person.name}`}
                >
                  Pray now
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-base leading-7 text-white/75">
              {active === "friends"
                ? "Your four-friends list is empty. Add up to four friends who do not yet know Jesus from Me."
                : churchProfileConnected
                  ? `No one is currently connected to your ${selected.label.toLowerCase()} group.`
                  : "Connect your prayer account to the church directory to see these people."}
            </p>
            <Link href="/auth#people" className="plc-button-secondary mt-4">Manage people</Link>
          </div>
        )}
      </div>
    </div>
  );
}
