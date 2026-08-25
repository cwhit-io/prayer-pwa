"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { actionErrorMessage, redirectWithQuery, rethrowIfNextNavigation } from "@/lib/form-action";
import { saveUserNotificationPreferences } from "@/lib/notification-preferences";

export async function saveNotificationPreferencesAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }

  try {
    const emailPrayerRequestUpdates =
      formData.get("email_prayer_request_updates") === "on" ||
      formData.get("email_prayer_request_updates") === "true";
    const emailPledgeInvitations =
      formData.get("email_pledge_invitations") === "on" ||
      formData.get("email_pledge_invitations") === "true";
    const emailProgressUpdates =
      formData.get("email_progress_updates") === "on" ||
      formData.get("email_progress_updates") === "true";

    await saveUserNotificationPreferences({
      userId: user.id,
      emailPrayerRequestUpdates,
      emailPledgeInvitations,
      emailProgressUpdates
    });

    revalidatePath("/auth");
    redirectWithQuery("/auth#settings", { prefs_saved: "1", section: "settings" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithQuery("/auth#settings", {
      error: actionErrorMessage(error, "Could not save notification preferences."),
      section: "settings"
    });
  }
}
