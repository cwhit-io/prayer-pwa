"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { actionErrorMessage, redirectWithError, redirectWithQuery, rethrowIfNextNavigation } from "@/lib/form-action";
import { getLatestPledge, removePrayerPledge, savePrayerPledge } from "@/lib/pledges";

const MAX_WEEKLY_MINUTES = 7 * 24 * 60;

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function savePledgeAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth");
  }

  const existing = await getLatestPledge(user.id);
  // New pledges often come from /pledge after login; updates from /auth.
  const errorBack = existing ? "/auth#progress" : "/pledge";

  try {
    const minutesPerWeek = Number(readText(formData, "minutes_per_week"));

    if (!Number.isInteger(minutesPerWeek) || minutesPerWeek <= 0 || minutesPerWeek > MAX_WEEKLY_MINUTES) {
      redirectWithError(errorBack, "Enter a whole-number weekly pledge between 1 and 10,080 minutes.");
    }

    await savePrayerPledge({
      userId: user.id,
      minutesPerWeek: Math.round(minutesPerWeek),
      prayerFocus: existing?.prayerFocus ?? null,
      isPublic: true
    });

    revalidatePath("/");
    revalidatePath("/auth");
    revalidatePath("/dashboard");
    revalidatePath("/pledge");
    redirectWithQuery("/auth#progress", { pledge_saved: "1", section: "progress" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    if (existing) {
      redirectWithQuery(errorBack, {
        error: actionErrorMessage(error, "Could not save your campaign pledge."),
        section: "progress"
      });
    }
    redirectWithError(errorBack, error, "Could not save your campaign pledge.");
  }
}

export async function removePledgeAction() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth");

  try {
    await removePrayerPledge(user.id);
    revalidatePath("/");
    revalidatePath("/auth");
    revalidatePath("/pledge");
    redirectWithQuery("/auth#progress", { pledge_removed: "1", section: "progress" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithQuery("/auth#progress", {
      error: actionErrorMessage(error, "Could not withdraw your campaign pledge."),
      section: "progress"
    });
  }
}

/** @deprecated use savePledgeAction */
export async function createPledgeAction(formData: FormData) {
  return savePledgeAction(formData);
}
