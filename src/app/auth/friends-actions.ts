"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { redirectWithError, redirectWithQuery, rethrowIfNextNavigation } from "@/lib/form-action";
import { savePrayerFriendSlots } from "@/lib/prayer-friends";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function savePrayerFriendsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }

  try {
    const names = [1, 2, 3, 4].map((slot) => readText(formData, `friend_${slot}`));
    await savePrayerFriendSlots(user.id, names);

    revalidatePath("/auth");
    redirectWithQuery("/auth", { friends_saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/auth", error, "Could not save friends list.");
  }
}
