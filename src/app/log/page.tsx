import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import type { SessionFocus } from "@/lib/pray-links";
import { getCampaignSettings } from "@/lib/settings";
import { FormBanner } from "@/app/components/form-banner";
import { ActsGuide } from "./acts-guide";
import { GuestLoginPrompt } from "./guest-login-prompt";
import {
  guidedPrayerHref,
  loadPromptFocus,
  loadRequestFocus,
  loadPersonalFocus,
  toStepPrompt,
  type PrayerPageSearchParams
} from "./prayer-page-data";

export const dynamic = "force-dynamic";

export default async function LogPrayerPage({
  searchParams
}: {
  searchParams?: Promise<PrayerPageSearchParams>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const canUseCommunityRequests = Boolean(user?.planningCenterPersonId);
  const requestId = canUseCommunityRequests ? params?.request?.trim() || null : null;
  const promptParam = params?.prompt?.trim() || null;
  const personalFocus = await loadPersonalFocus(params, user?.id);
  const isGuest = !user;
  const justSaved = params?.saved === "1";
  const formError = params?.error ?? null;

  const [requestFocus, promptFocus, campaign] = await Promise.all([
    requestId ? loadRequestFocus(requestId) : Promise.resolve(null),
    promptParam ? loadPromptFocus(promptParam) : Promise.resolve(null),
    getCampaignSettings()
  ]);

  // Guests never load community requests as focus.
  const selectedFocus: SessionFocus | null =
    (!isGuest ? requestFocus : null) ??
    promptFocus;

  const focus: SessionFocus | null = selectedFocus;
  const sessionPromptId = selectedFocus?.kind === "prompt" ? selectedFocus.id : undefined;

  return (
    <main className="plc-page">
      {isGuest ? <GuestLoginPrompt /> : null}
      <div className="plc-shell max-w-3xl space-y-8">
        <section className="space-y-6">
          <FormBanner error={formError} />
           <ActsGuide
             mode="simple"
             guidedPrayerHref={guidedPrayerHref(params)}
             promptId={sessionPromptId}
             supplicationPrompt={toStepPrompt(selectedFocus ? {
               ...selectedFocus,
               scriptureReference: selectedFocus.scriptureReference ?? null,
               scriptureText: selectedFocus.scriptureText ?? null
             } : null)}
             focus={focus}
             timerStorageOwner={user?.id ?? "guest"}
             personalFocus={personalFocus ?? undefined}
             lockInitialFocus={Boolean((!isGuest && requestFocus) || promptFocus)}
              includeRequests={canUseCommunityRequests}
             canSaveSessions={Boolean(user)}
             showFocusBanner={Boolean(requestFocus || promptFocus || personalFocus)}
             maxSessionMinutes={campaign.maxSessionMinutes}
             showActsTags={campaign.showActsTags}
           />
          {justSaved ? (
            <p className="text-center text-sm font-black uppercase text-yellow">
               Your prayer minutes were saved.
              {isGuest ? (
                <>
                  {" "}
                  <Link href="/auth" className="text-white underline">
                    Sign in
                  </Link>{" "}
                   <span className="font-normal normal-case tracking-normal text-white/75">
                     Sign in next time if you also want a personal prayer history.
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
          {isGuest ? (
             <p className="text-center text-sm text-white/75">
               You can pray without signing in. Eligible guest prayer counts toward the church campaign but is not saved to a personal
               profile. {" "}
              <Link href="/auth" className="font-black uppercase text-yellow">
                Sign in
              </Link>{" "}
              to save history, make a campaign pledge, and use member features.
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
