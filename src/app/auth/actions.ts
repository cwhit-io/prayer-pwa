"use server";

import { redirect } from "next/navigation";
import { createSessionForUser, signOutCurrentUser } from "@/lib/auth";
import { redirectWithError, redirectWithQuery, rethrowIfNextNavigation } from "@/lib/form-action";
import { getPostLoginRedirectPath } from "@/lib/pledges";
import {
  completePlanningCenterLogin,
  completeUnlinkedLogin,
  startPlanningCenterLogin,
  tryAutoCompleteUnlinkedLogin,
  verifyPlanningCenterLoginCode
} from "@/lib/planning-center-login";
import { authHref, getSafeAuthNextPath } from "@/app/auth/next-path";

function toSafeText(value: FormDataEntryValue | null, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

async function redirectAfterSignIn(userId: string, next: string | null): Promise<never> {
  redirect(next ?? await getPostLoginRedirectPath(userId));
}

export async function signOutAction() {
  await signOutCurrentUser();
  redirect("/");
}

export async function requestLoginCodeAction(formData: FormData) {
  const next = getSafeAuthNextPath(formData.get("next"));
  const back = authHref(next);
  try {
    const contact = toSafeText(formData.get("contact"));
    if (!contact) {
      redirectWithError(back, "Enter your email address or phone number.");
    }

    const challenge = await startPlanningCenterLogin(contact);
    const query: Record<string, string> = {
      challenge: challenge.challengeId,
      contact: challenge.contact,
      delivery: challenge.delivery
    };
    if (next) {
      query.next = next;
    }
    if (challenge.debugCode) {
      query.debug_code = challenge.debugCode;
    }
    if (!challenge.hasPlanningCenterMatch) {
      query.unlinked = "1";
    }
    redirectWithQuery("/auth", query);
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError(back, error, "Could not send a login code.");
  }
}

export async function verifyLoginCodeAction(formData: FormData) {
  const challengeId = toSafeText(formData.get("challenge_id"));
  const code = toSafeText(formData.get("code"));
  const next = getSafeAuthNextPath(formData.get("next"));
  const back = authHref(next, challengeId ? { challenge: challengeId } : {});

  try {
    if (!challengeId || !code) {
      redirectWithError(back, "Enter the code we sent you.");
    }

    await verifyPlanningCenterLoginCode({ challengeId, code });

    // Returning unlinked user: finish login without person picker.
    const autoUser = await tryAutoCompleteUnlinkedLogin(challengeId);
    if (autoUser) {
      await createSessionForUser(autoUser.id);
      await redirectAfterSignIn(autoUser.id, next);
    }

    redirectWithQuery("/auth", { challenge: challengeId, verified: "1", next });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError(back, error, "That code could not be verified.");
  }
}

export async function choosePlanningCenterPersonAction(formData: FormData) {
  const challengeId = toSafeText(formData.get("challenge_id"));
  const personId = toSafeText(formData.get("person_id"));
  const next = getSafeAuthNextPath(formData.get("next"));
  const back = authHref(next, challengeId ? { challenge: challengeId, verified: "1" } : {});

  try {
    if (!challengeId || !personId) {
      redirectWithError(back, "Choose which household member you are.");
    }
    const user = await completePlanningCenterLogin({ challengeId, personId });
    await createSessionForUser(user.id);
    await redirectAfterSignIn(user.id, next);
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError(back, error, "Could not finish sign-in.");
  }
}

/** Create / sign in without a Planning Center person link. */
export async function createUnlinkedAccountAction(formData: FormData) {
  const challengeId = toSafeText(formData.get("challenge_id"));
  const name = toSafeText(formData.get("name"));
  const next = getSafeAuthNextPath(formData.get("next"));
  const back = authHref(next, challengeId ? { challenge: challengeId, verified: "1" } : {});

  try {
    if (!challengeId) {
      redirectWithError(authHref(next), "Your login session expired. Please request a new code.");
    }
    if (!name) {
      redirectWithError(back, "Enter your name to create a prayer account.");
    }

    const user = await completeUnlinkedLogin({ challengeId, name });
    await createSessionForUser(user.id);
    await redirectAfterSignIn(user.id, next);
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError(back, error, "Could not create your account.");
  }
}
