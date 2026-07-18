import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getRandomActsPromptSet } from "@/lib/acts-prompts";
import { query } from "@/lib/postgres";
import type { SessionFocus } from "@/lib/pray-links";
import { getPromptById } from "@/lib/prompts";
import { getCampaignSettings } from "@/lib/settings";
import { getWeightedSupplication } from "@/lib/supplication";
import { resolvePreferredTagIds } from "@/lib/tags";
import { buildYouVersionEsvUrl } from "@/lib/youversion";
import { FormBanner } from "@/app/components/form-banner";
import { ActsGuide, type StepPrompt } from "./acts-guide";
import { GuestLoginPrompt } from "./guest-login-prompt";

export const dynamic = "force-dynamic";

function toStepPrompt(
  prompt: {
    id: string;
    title: string;
    body: string;
    scriptureReference: string | null;
    scriptureText: string | null;
    tags?: string[] | null;
    category?: string | null;
  } | null
): StepPrompt | null {
  if (!prompt) {
    return null;
  }

  return {
    id: prompt.id,
    title: prompt.title,
    body: prompt.body,
    scriptureReference: prompt.scriptureReference,
    scriptureText: prompt.scriptureText,
    scriptureHref: prompt.scriptureReference ? buildYouVersionEsvUrl(prompt.scriptureReference) : null,
    tags: prompt.tags ?? (prompt.category ? [prompt.category] : [])
  };
}

async function loadRequestFocus(requestId: string): Promise<SessionFocus | null> {
  const result = await query<{
    id: string;
    title: string;
    body: string;
    category: string;
  }>(
    `select id, title, body, category
     from prayer_requests
     where id = $1
       and visibility = 'church_anonymous'
       and status in ('open', 'praying', 'answered')
       and board_moderation = 'published'
       and (publish_at is null or publish_at <= now())
     limit 1`,
    [requestId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    kind: "request",
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category
  };
}

async function loadPromptFocus(promptId: string): Promise<SessionFocus | null> {
  const prompt = await getPromptById(promptId);
  if (!prompt || !prompt.isActive) {
    return null;
  }

  return {
    kind: "prompt",
    id: prompt.id,
    title: prompt.title,
    body: prompt.body,
    category: prompt.category,
    tags: prompt.tags,
    scriptureReference: prompt.scriptureReference,
    scriptureText: prompt.scriptureText,
    scriptureHref: prompt.scriptureReference ? buildYouVersionEsvUrl(prompt.scriptureReference) : null
  };
}

export default async function LogPrayerPage({
  searchParams
}: {
  searchParams?: Promise<{ request?: string; prompt?: string; saved?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const requestId = user ? params?.request?.trim() || null : null;
  const promptParam = params?.prompt?.trim() || null;
  const isGuest = !user;
  const justSaved = params?.saved === "1";
  const formError = params?.error ?? null;

  const [weightedS, requestFocus, promptFocus, campaign] = await Promise.all([
    !requestId && !promptParam
      ? getWeightedSupplication(null, { includeRequests: !isGuest })
      : Promise.resolve(null),
    requestId ? loadRequestFocus(requestId) : Promise.resolve(null),
    promptParam ? loadPromptFocus(promptParam) : Promise.resolve(null),
    getCampaignSettings()
  ]);

  // Guests never load community requests as focus.
  const focus: SessionFocus | null =
    (!isGuest ? requestFocus : null) ??
    promptFocus ??
    (weightedS
      ? {
          kind: weightedS.kind,
          id: weightedS.id,
          title: weightedS.title,
          body: weightedS.body,
          category: weightedS.category,
          tags: weightedS.kind === "prompt" ? undefined : null,
          scriptureReference: weightedS.scriptureReference,
          scriptureText: weightedS.scriptureText,
          scriptureHref: weightedS.scriptureHref
        }
      : null);

  // Prefer ACTS prompts that share tags with the S focus (fuzzy — zero overlap still OK).
  const preferredTagIds = focus
    ? await resolvePreferredTagIds({
        kind: focus.kind,
        id: focus.id,
        tagNames: focus.tags,
        category: focus.category
      })
    : [];
  const actsSet = await getRandomActsPromptSet(preferredTagIds);

  const sessionPromptId = focus?.kind === "prompt" ? focus.id : undefined;
  const supplication = focus
    ? {
        id: focus.id,
        title: focus.title,
        body: focus.body,
        scriptureReference: focus.scriptureReference ?? null,
        scriptureText: focus.scriptureText ?? null,
        tags: focus.tags ?? (focus.category ? [focus.category] : []),
        category: focus.category
      }
    : null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="plc-page">
      {isGuest ? <GuestLoginPrompt /> : null}
      <div className="plc-shell max-w-3xl space-y-8">
        <section className="space-y-6">
          <FormBanner error={formError} />
          <ActsGuide
            promptId={sessionPromptId}
            actsPrompts={{
              A: toStepPrompt(actsSet.A),
              C: toStepPrompt(actsSet.C),
              T: toStepPrompt(actsSet.T)
            }}
            supplicationPrompt={toStepPrompt(supplication)}
            focus={focus}
            lockInitialFocus={Boolean((!isGuest && requestFocus) || promptFocus)}
            includeRequests={!isGuest}
            canSaveSessions
            maxSessionMinutes={campaign.maxSessionMinutes}
            showActsTags={campaign.showActsTags}
            manualEntry={user ? { defaultMinutes: 10, today } : undefined}
          />
          {justSaved ? (
            <p className="text-center text-sm font-black uppercase text-yellow">
              Thank you — those minutes are part of the church total.
              {isGuest ? (
                <>
                  {" "}
                  <Link href="/auth" className="text-white underline">
                    Sign in
                  </Link>{" "}
                  <span className="font-normal normal-case tracking-normal text-white/55">
                    if you want them on your personal profile too.
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
          {isGuest ? (
            <p className="text-center text-sm text-white/50">
              Guest pray — minutes count toward the campaign total, but aren&apos;t tracked to a personal profile.{" "}
              <Link href="/auth" className="font-black uppercase text-yellow">
                Sign in
              </Link>{" "}
              to save history, set a pledge, and use the community board.
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
