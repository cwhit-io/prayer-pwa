import { ScriptureReference } from "@/app/components/scripture-reference";
import { PrayButton } from "@/app/components/pray-button";
import { prayerCountLabel, type SessionFocus } from "@/lib/pray-links";

export type PromptCardView = {
  id: string;
  title: string;
  body: string;
  category: string;
  tags?: string[];
  scriptureReference: string | null;
  scriptureText: string | null;
  scriptureHref: string | null;
  prayerCount: number;
};

function toFocus(prompt: PromptCardView): SessionFocus {
  return {
    kind: "prompt",
    id: prompt.id,
    title: prompt.title,
    body: prompt.body,
    category: prompt.category,
    tags: prompt.tags ?? (prompt.category ? [prompt.category] : []),
    scriptureReference: prompt.scriptureReference,
    scriptureText: prompt.scriptureText,
    scriptureHref: prompt.scriptureHref
  };
}

export function PromptList({
  prompts,
  signedIn
}: {
  prompts: PromptCardView[];
  signedIn: boolean;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      {prompts.map((prompt) => {
        const focus = toFocus(prompt);
        return (
          <article key={prompt.id} className="plc-panel p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="plc-eyebrow">
                  {(prompt.tags && prompt.tags.length > 0 ? prompt.tags : [prompt.category]).join(" · ")}
                </p>
                <h2 className="mt-2 text-2xl font-black uppercase text-white">{prompt.title}</h2>
              </div>
              <span
                className={`plc-status ${
                  prompt.prayerCount === 0 ? "border-yellow/60 text-yellow" : ""
                }`}
              >
                {prayerCountLabel(prompt.prayerCount)}
              </span>
            </div>
            {prompt.scriptureReference ? (
              <ScriptureReference
                className="mt-4"
                reference={prompt.scriptureReference}
                href={prompt.scriptureHref}
                text={prompt.scriptureText}
              />
            ) : null}
            <p className="plc-reading mt-3">{prompt.body}</p>
            <div className="mt-5">
              <PrayButton focus={focus} signedIn={signedIn} prayerCount={prompt.prayerCount} />
            </div>
          </article>
        );
      })}
    </section>
  );
}
