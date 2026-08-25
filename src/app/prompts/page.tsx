import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPromptArchive } from "@/lib/prompts";
import { getActivePromptTagNames } from "@/lib/tags";
import { buildYouVersionEsvUrl, resolveManyScriptures } from "@/lib/youversion";
import { PromptList } from "./prompt-list";

export const dynamic = "force-dynamic";

export default async function PromptsPage({
  searchParams
}: {
  searchParams?: Promise<{ category?: string; tag?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth?next=/prompts");
  }

  const params = await searchParams;
  const selectedTag = params?.tag || params?.category;
  const [tags, prompts] = await Promise.all([
    getActivePromptTagNames(),
    getPromptArchive(selectedTag)
  ]);
  const scriptureMap = await resolveManyScriptures(prompts.map((prompt) => prompt.scriptureReference));

  const cards = prompts.map((prompt) => {
    const resolved = prompt.scriptureReference ? scriptureMap.get(prompt.scriptureReference) : null;
    const scriptureText = prompt.scriptureText || resolved?.content || null;
    return {
      id: prompt.id,
      title: prompt.title,
      body: prompt.body,
      category: prompt.category,
      tags: prompt.tags,
      scriptureReference: prompt.scriptureReference,
      scriptureText,
      scriptureHref: prompt.scriptureReference
        ? resolved?.youVersionEsvUrl || buildYouVersionEsvUrl(prompt.scriptureReference)
        : null,
      prayerCount: prompt.prayerCount ?? 0
    };
  });

  return (
    <main className="plc-page">
      <div className="plc-shell-wide space-y-8">
        <header className="space-y-3">
          <p className="plc-eyebrow">Prayer prompts</p>
          <h1 className="plc-title max-w-3xl">Choose something to pray about.</h1>
          <p className="plc-copy max-w-2xl">
            Browse prayer ideas by topic. Select <strong className="text-white">Pray with this prompt</strong> to
            open it in the prayer timer. The optional ACTS guide includes Adoration, Confession, Thanksgiving, and
            Supplication, with an explanation for each step.
          </p>
          <Link href="/log#prayer-focus-options" className="inline-flex min-h-11 items-center font-black text-yellow">Back to prayer options</Link>
        </header>

        <div>
          <p className="plc-label">Choose a topic</p>
          <nav aria-label="Prompt topics" className="mt-2 flex flex-wrap gap-2">
          <Link
            href="/prompts"
             className={`rounded-full px-4 py-2 text-sm font-black uppercase ${!selectedTag ? "bg-yellow text-black" : "bg-black/40 text-white"}`}
             aria-current={!selectedTag ? "page" : undefined}
          >
            All
          </Link>
          {tags.map((tag) => (
            <Link
              key={tag}
              href={`/prompts?tag=${encodeURIComponent(tag)}`}
               className={`rounded-full px-4 py-2 text-sm font-black uppercase ${selectedTag === tag ? "bg-yellow text-black" : "bg-black/40 text-white"}`}
               aria-current={selectedTag === tag ? "page" : undefined}
            >
              {tag}
            </Link>
          ))}
          </nav>
        </div>

        {cards.length > 0 ? (
          <PromptList prompts={cards} signedIn />
        ) : (
          <article className="plc-panel p-6">
            <h2 className="text-2xl font-black uppercase text-white">No prompts yet</h2>
            <p className="plc-copy mt-2">There are no prompts in this topic yet. Try another topic, or start praying for a simple guided prayer.</p>
            <Link href="/log" className="plc-button mt-5">Start praying</Link>
          </article>
        )}
      </div>
    </main>
  );
}
