"use server";

import { getChapterVerseCount, fetchPassageText } from "@/lib/youversion";

export async function loadChapterVersesAction(bookUsfm: string, chapter: number) {
  const verseCount = await getChapterVerseCount(bookUsfm, chapter);
  return { verseCount };
}

export async function loadPassageTextAction(usfmPassage: string) {
  return fetchPassageText(usfmPassage);
}
