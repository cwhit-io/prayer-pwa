import { FormBanner } from "@/app/components/form-banner";
import { getRandomActsPromptSet } from "@/lib/acts-prompts";
import { getCurrentUser } from "@/lib/auth";
import type { SessionFocus } from "@/lib/pray-links";
import { getCampaignSettings } from "@/lib/settings";
import { getWeightedSupplication } from "@/lib/supplication";
import { resolvePreferredTagIds } from "@/lib/tags";
import { ActsGuide } from "@/app/log/acts-guide";
import { GuestLoginPrompt } from "@/app/log/guest-login-prompt";
import {
  loadPromptFocus,
  loadRequestFocus,
  loadPersonalFocus,
  toStepPrompt,
  type PrayerPageSearchParams
} from "@/app/log/prayer-page-data";

export const dynamic = "force-dynamic";

export default async function GuidedPrayerPage({
  searchParams
}: {
  searchParams?: Promise<PrayerPageSearchParams>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const canUseCommunityRequests = Boolean(user?.planningCenterPersonId);
  const requestId = canUseCommunityRequests ? params?.request?.trim() || null : null;
  const promptId = params?.prompt?.trim() || null;
  const personalFocus = await loadPersonalFocus(params, user?.id);
  const isGuest = !user;

  const [requestFocus, promptFocus, campaign] = await Promise.all([
    requestId ? loadRequestFocus(requestId) : Promise.resolve(null),
    promptId ? loadPromptFocus(promptId) : Promise.resolve(null),
    getCampaignSettings()
  ]);
  const selectedFocus = (!isGuest ? requestFocus : null) ?? promptFocus;
  const weighted = !selectedFocus && !personalFocus
    ? await getWeightedSupplication(null, { includeRequests: canUseCommunityRequests })
    : null;
  const guidedFocus: SessionFocus | null = selectedFocus ?? (weighted
    ? {
        kind: weighted.kind,
        id: weighted.id,
        title: weighted.title,
        body: weighted.body,
        category: weighted.category,
        scriptureReference: weighted.scriptureReference,
        scriptureText: weighted.scriptureText,
        scriptureHref: weighted.scriptureHref
      }
    : null);
  const preferredTagIds = guidedFocus
    ? await resolvePreferredTagIds({
        kind: guidedFocus.kind,
        id: guidedFocus.id,
        tagNames: guidedFocus.tags,
        category: guidedFocus.category
      })
    : [];
  const actsSet = await getRandomActsPromptSet(preferredTagIds);

  return (
    <main className="plc-page">
      {isGuest ? <GuestLoginPrompt /> : null}
      <div className="plc-shell max-w-3xl space-y-6">
        <FormBanner error={params?.error} />
        <ActsGuide
          mode="guided"
          autoStart
          promptId={guidedFocus?.kind === "prompt" ? guidedFocus.id : undefined}
          actsPrompts={{
            A: toStepPrompt(actsSet.A),
            C: toStepPrompt(actsSet.C),
            T: toStepPrompt(actsSet.T)
          }}
          supplicationPrompt={toStepPrompt(guidedFocus ? {
            ...guidedFocus,
            scriptureReference: guidedFocus.scriptureReference ?? null,
            scriptureText: guidedFocus.scriptureText ?? null
          } : null)}
          focus={guidedFocus}
          personalFocus={personalFocus ?? undefined}
          lockInitialFocus={Boolean(selectedFocus || personalFocus)}
          includeRequests={canUseCommunityRequests}
          canSaveSessions={Boolean(user)}
          showFocusBanner={Boolean(selectedFocus || personalFocus)}
          maxSessionMinutes={campaign.maxSessionMinutes}
          showActsTags={campaign.showActsTags}
          timerStorageOwner={user?.id ?? "guest"}
        />
      </div>
    </main>
  );
}
