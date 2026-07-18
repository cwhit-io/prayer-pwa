"use server";

import { redirect } from "next/navigation";
import { createSessionForUser, signOutCurrentUser, upsertUserByEmail } from "@/lib/auth";
import { redirectWithError, redirectWithQuery, rethrowIfNextNavigation } from "@/lib/form-action";
import {
  completePlanningCenterLogin,
  completeUnlinkedLogin,
  startPlanningCenterLogin,
  tryAutoCompleteUnlinkedLogin,
  verifyPlanningCenterLoginCode
} from "@/lib/planning-center-login";

function toSafeText(value: FormDataEntryValue | null, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

export async function signInAction(formData: FormData) {
  try {
    const name = toSafeText(formData.get("name"));
    const email = toSafeText(formData.get("email")).toLowerCase();

    if (!name || !email) {
      redirectWithError("/auth", "Please provide your name and email.");
    }

    const user = await upsertUserByEmail({ name, email });
    await createSessionForUser(user.id);
    redirect("/auth");
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/auth", error, "Could not sign in.");
  }
}

export async function signOutAction() {
  await signOutCurrentUser();
  redirect("/");
}

export async function requestLoginCodeAction(formData: FormData) {
  try {
    const contact = toSafeText(formData.get("contact"));
    if (!contact) {
      redirectWithError("/auth", "Enter your email address or phone number.");
    }

    const challenge = await startPlanningCenterLogin(contact);
    const query: Record<string, string> = {
      challenge: challenge.challengeId,
      contact: challenge.contact,
      delivery: challenge.delivery
    };
    if (challenge.debugCode) {
      query.debug_code = challenge.debugCode;
    }
    if (!challenge.hasPlanningCenterMatch) {
      query.unlinked = "1";
    }
    redirectWithQuery("/auth", query);
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/auth", error, "Could not send a login code.");
  }
}

export async function verifyLoginCodeAction(formData: FormData) {
  const challengeId = toSafeText(formData.get("challenge_id"));
  const code = toSafeText(formData.get("code"));
  const back = challengeId ? `/auth?challenge=${encodeURIComponent(challengeId)}` : "/auth";

  try {
    if (!challengeId || !code) {
      redirectWithError(back, "Enter the code we sent you.");
    }

    await verifyPlanningCenterLoginCode({ challengeId, code });

    // Returning unlinked user: finish login without person picker.
    const autoUser = await tryAutoCompleteUnlinkedLogin(challengeId);
    if (autoUser) {
      await createSessionForUser(autoUser.id);
      redirect("/auth");
    }

    redirectWithQuery("/auth", { challenge: challengeId, verified: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError(back, error, "That code could not be verified.");
  }
}

export async function choosePlanningCenterPersonAction(formData: FormData) {
  const challengeId = toSafeText(formData.get("challenge_id"));
  const personId = toSafeText(formData.get("person_id"));
  const back = challengeId
    ? `/auth?challenge=${encodeURIComponent(challengeId)}&verified=1`
    : "/auth";

  try {
    if (!challengeId || !personId) {
      redirectWithError(back, "Choose which household member you are.");
    }

    const user = await completePlanningCenterLogin({ challengeId, personId });
    await createSessionForUser(user.id);
    redirect("/auth");
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError(back, error, "Could not finish sign-in.");
  }
}

/** Create / sign in without a Planning Center person link. */
export async function createUnlinkedAccountAction(formData: FormData) {
  const challengeId = toSafeText(formData.get("challenge_id"));
  const name = toSafeText(formData.get("name"));
  const back = challengeId
    ? `/auth?challenge=${encodeURIComponent(challengeId)}&verified=1`
    : "/auth";

  try {
    if (!challengeId) {
      redirectWithError("/auth", "Your login session expired. Please request a new code.");
    }
    if (!name) {
      redirectWithError(back, "Enter your name to create a prayer account.");
    }

    const user = await completeUnlinkedLogin({ challengeId, name });
    await createSessionForUser(user.id);
    redirect("/auth");
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError(back, error, "Could not create your account.");
  }
}
