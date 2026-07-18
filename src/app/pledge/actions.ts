"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { redirectWithError, redirectWithQuery, rethrowIfNextNavigation } from "@/lib/form-action";
import { getLatestPledge, savePrayerPledge } from "@/lib/pledges";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function savePledgeAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth");
  }

  try {
    const minutesPerWeek = Number(readText(formData, "minutes_per_week"));
    const isPublic = formData.get("is_public") === "on";

    if (!Number.isFinite(minutesPerWeek) || minutesPerWeek <= 0) {
      redirectWithError("/auth", "A valid weekly minute pledge is required.");
    }

    const existing = await getLatestPledge(user.id);

    await savePrayerPledge({
      userId: user.id,
      minutesPerWeek: Math.round(minutesPerWeek),
      prayerFocus: existing?.prayerFocus ?? null,
      isPublic
    });

    revalidatePath("/");
    revalidatePath("/auth");
    revalidatePath("/dashboard");
    revalidatePath("/pledge");
    redirectWithQuery("/auth", { pledge_saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/auth", error, "Could not save your pledge.");
  }
}

/** @deprecated use savePledgeAction */
export async function createPledgeAction(formData: FormData) {
  return savePledgeAction(formData);
}
