"use client";

import { FormEvent, useState, useTransition } from "react";
import type { PlanningCenterAdminSearchResult } from "@/lib/planning-center";
import {
  addUserFromPlanningCenterAction,
  searchPlanningCenterPeopleAction
} from "./planning-center/actions";

export function AddPlanningCenterPerson({ credentialsConfigured }: { credentialsConfigured: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PlanningCenterAdminSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setSearch("");
    setResults([]);
    setError(null);
    setHasSearched(false);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const response = await searchPlanningCenterPeopleAction(search);
      setHasSearched(true);
      setResults(response.results);
      setError(response.ok ? null : response.error);
    });
  }

  return (
    <>
      <button
        type="button"
        className="plc-button-secondary"
        disabled={!credentialsConfigured}
        onClick={() => setOpen(true)}
        title={credentialsConfigured ? undefined : "Configure Planning Center credentials first"}
      >
        Add
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-planning-center-person-title"
        >
          <div className="plc-panel max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6 sm:p-8">
            <header className="flex items-start justify-between gap-5 border-b border-white/10 pb-5">
              <div>
                <p className="plc-eyebrow">Planning Center</p>
                <h2 id="add-planning-center-person-title" className="mt-2 text-3xl font-black uppercase text-white">
                  Add a person
                </h2>
                <p className="mt-2 text-sm text-white/70">
                  Search the church directory, then add the person to the campaign for paper prayer entries.
                </p>
              </div>
              <button type="button" onClick={close} className="plc-button-secondary">Close</button>
            </header>

            <form onSubmit={submitSearch} className="mt-6 flex flex-wrap gap-3">
              <label className="min-w-[14rem] flex-1">
                <span className="sr-only">Search Planning Center by name or email</span>
                <input
                  autoFocus
                  required
                  minLength={2}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name or email"
                  className="plc-input w-full px-4 py-3"
                />
              </label>
              <button className="plc-button" disabled={isPending}>
                {isPending ? "Searching..." : "Search Planning Center"}
              </button>
            </form>

            {error ? <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}

            <div className="mt-5 space-y-3">
              {results.map((person) => (
                <article key={person.personId} className="plc-card-muted flex flex-wrap items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-black text-white">{person.name}</p>
                    <p className="mt-1 text-sm text-white/60">{person.email || "No email in Planning Center"}</p>
                  </div>
                  {person.existingUserId ? (
                    <span className="plc-status">Already in campaign</span>
                  ) : (
                    <form action={addUserFromPlanningCenterAction}>
                      <input type="hidden" name="person_id" value={person.personId} />
                      <button className="plc-button-secondary">Add to campaign</button>
                    </form>
                  )}
                </article>
              ))}
              {hasSearched && !isPending && results.length === 0 && !error ? (
                <p className="py-6 text-center text-white/65">No Planning Center people matched that search.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
