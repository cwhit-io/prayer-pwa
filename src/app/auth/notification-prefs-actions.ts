"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { redirectWithError, redirectWithQuery, rethrowIfNextNavigation } from "@/lib/form-action";
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

    await saveUserNotificationPreferences({
      userId: user.id,
      emailPrayerRequestUpdates
    });

    revalidatePath("/auth");
    redirectWithQuery("/auth", { prefs_saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/auth", error, "Could not save notification preferences.");
  }
}
