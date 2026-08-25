"use server";

import { getChapterVerseCount, fetchPassageText } from "@/lib/youversion";
import { getCurrentUser, hasCapability } from "@/lib/auth";

async function requirePrayerContentAccess() {
  const user = await getCurrentUser();
  if (!user || !hasCapability(user.role, "prayer-content:manage")) {
    throw new Error("Prayer content access is required.");
  }
}

export async function loadChapterVersesAction(bookUsfm: string, chapter: number) {
  await requirePrayerContentAccess();
  const verseCount = await getChapterVerseCount(bookUsfm, chapter);
  return { verseCount };
}

export async function loadPassageTextAction(usfmPassage: string) {
  await requirePrayerContentAccess();
  return fetchPassageText(usfmPassage);
}
