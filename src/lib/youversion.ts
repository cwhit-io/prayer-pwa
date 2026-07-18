/**
 * YouVersion Platform helpers.
 * Deep-links open English ESV on bible.com (version 59).
 * Passage text via API is only available for open Bibles on this app key;
 * ESV text fetch returns 403 (publisher-restricted).
 */

const ESV_VERSION_ID = Number(process.env.YOUVERSION_ESV_VERSION_ID || 59);
/** Open English Bible used to validate USFM references when ESV text is denied. */
const RESOLVE_BIBLE_ID = Number(process.env.YOUVERSION_RESOLVE_BIBLE_ID || 3034); // BSB

const BOOK_ALIASES: Record<string, string> = {
  genesis: "GEN",
  gen: "GEN",
  ge: "GEN",
  exodus: "EXO",
  exo: "EXO",
  ex: "EXO",
  leviticus: "LEV",
  lev: "LEV",
  le: "LEV",
  numbers: "NUM",
  num: "NUM",
  nu: "NUM",
  deuteronomy: "DEU",
  deut: "DEU",
  de: "DEU",
  joshua: "JOS",
  josh: "JOS",
  jos: "JOS",
  judges: "JDG",
  judg: "JDG",
  jdg: "JDG",
  ruth: "RUT",
  ru: "RUT",
  "1 samuel": "1SA",
  "1samuel": "1SA",
  "1 sam": "1SA",
  "1sam": "1SA",
  "1 sa": "1SA",
  "i samuel": "1SA",
  "2 samuel": "2SA",
  "2samuel": "2SA",
  "2 sam": "2SA",
  "2sam": "2SA",
  "ii samuel": "2SA",
  "1 kings": "1KI",
  "1kings": "1KI",
  "1 ki": "1KI",
  "1ki": "1KI",
  "i kings": "1KI",
  "2 kings": "2KI",
  "2kings": "2KI",
  "2 ki": "2KI",
  "2ki": "2KI",
  "ii kings": "2KI",
  "1 chronicles": "1CH",
  "1chronicles": "1CH",
  "1 chron": "1CH",
  "1chr": "1CH",
  "1 ch": "1CH",
  "i chronicles": "1CH",
  "2 chronicles": "2CH",
  "2chronicles": "2CH",
  "2 chron": "2CH",
  "2chr": "2CH",
  "ii chronicles": "2CH",
  ezra: "EZR",
  ezr: "EZR",
  nehemiah: "NEH",
  neh: "NEH",
  esther: "EST",
  est: "EST",
  job: "JOB",
  psalm: "PSA",
  psalms: "PSA",
  ps: "PSA",
  psa: "PSA",
  proverbs: "PRO",
  prov: "PRO",
  pr: "PRO",
  pro: "PRO",
  ecclesiastes: "ECC",
  eccl: "ECC",
  ecc: "ECC",
  "song of solomon": "SNG",
  "song of songs": "SNG",
  songs: "SNG",
  song: "SNG",
  sos: "SNG",
  sng: "SNG",
  isaiah: "ISA",
  isa: "ISA",
  is: "ISA",
  jeremiah: "JER",
  jer: "JER",
  lamentations: "LAM",
  lam: "LAM",
  ezekiel: "EZK",
  ezek: "EZK",
  ezk: "EZK",
  daniel: "DAN",
  dan: "DAN",
  hosea: "HOS",
  hos: "HOS",
  joel: "JOL",
  jol: "JOL",
  amos: "AMO",
  amo: "AMO",
  obadiah: "OBA",
  obad: "OBA",
  oba: "OBA",
  jonah: "JON",
  jon: "JON",
  micah: "MIC",
  mic: "MIC",
  nahum: "NAM",
  nah: "NAM",
  nam: "NAM",
  habakkuk: "HAB",
  hab: "HAB",
  zephaniah: "ZEP",
  zeph: "ZEP",
  zep: "ZEP",
  haggai: "HAG",
  hag: "HAG",
  zechariah: "ZEC",
  zech: "ZEC",
  zec: "ZEC",
  malachi: "MAL",
  mal: "MAL",
  matthew: "MAT",
  matt: "MAT",
  mt: "MAT",
  mat: "MAT",
  mark: "MRK",
  mk: "MRK",
  mrk: "MRK",
  luke: "LUK",
  lk: "LUK",
  luk: "LUK",
  john: "JHN",
  jn: "JHN",
  jhn: "JHN",
  acts: "ACT",
  act: "ACT",
  romans: "ROM",
  rom: "ROM",
  ro: "ROM",
  "1 corinthians": "1CO",
  "1corinthians": "1CO",
  "1 cor": "1CO",
  "1cor": "1CO",
  "1 co": "1CO",
  "i corinthians": "1CO",
  "2 corinthians": "2CO",
  "2corinthians": "2CO",
  "2 cor": "2CO",
  "2cor": "2CO",
  "ii corinthians": "2CO",
  galatians: "GAL",
  gal: "GAL",
  ephesians: "EPH",
  eph: "EPH",
  philippians: "PHP",
  phil: "PHP",
  php: "PHP",
  colossians: "COL",
  col: "COL",
  "1 thessalonians": "1TH",
  "1thessalonians": "1TH",
  "1 thess": "1TH",
  "1thess": "1TH",
  "1 th": "1TH",
  "i thessalonians": "1TH",
  "2 thessalonians": "2TH",
  "2thessalonians": "2TH",
  "2 thess": "2TH",
  "2thess": "2TH",
  "ii thessalonians": "2TH",
  "1 timothy": "1TI",
  "1timothy": "1TI",
  "1 tim": "1TI",
  "1tim": "1TI",
  "1 ti": "1TI",
  "i timothy": "1TI",
  "2 timothy": "2TI",
  "2timothy": "2TI",
  "2 tim": "2TI",
  "2tim": "2TI",
  "ii timothy": "2TI",
  titus: "TIT",
  tit: "TIT",
  philemon: "PHM",
  phlm: "PHM",
  phm: "PHM",
  hebrews: "HEB",
  heb: "HEB",
  james: "JAS",
  jas: "JAS",
  jm: "JAS",
  "1 peter": "1PE",
  "1peter": "1PE",
  "1 pet": "1PE",
  "1pet": "1PE",
  "1 pe": "1PE",
  "i peter": "1PE",
  "2 peter": "2PE",
  "2peter": "2PE",
  "2 pet": "2PE",
  "2pet": "2PE",
  "ii peter": "2PE",
  "1 john": "1JN",
  "1john": "1JN",
  "1 jn": "1JN",
  "1jn": "1JN",
  "i john": "1JN",
  "2 john": "2JN",
  "2john": "2JN",
  "2 jn": "2JN",
  "ii john": "2JN",
  "3 john": "3JN",
  "3john": "3JN",
  "3 jn": "3JN",
  "iii john": "3JN",
  jude: "JUD",
  jud: "JUD",
  revelation: "REV",
  rev: "REV",
  re: "REV"
};

export type ParsedScripture = {
  bookUsfm: string;
  chapter: number;
  verseStart: number;
  verseEnd: number | null;
  /** e.g. PSA.46.10 or 1TI.2.1-2 */
  usfmPassage: string;
  displayReference: string;
};

function normalizeBookKey(input: string) {
  return input
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse human references like "Psalm 46:10", "1 Timothy 2:1-2", "John 3:16".
 */
export function parseScriptureReference(reference: string): ParsedScripture | null {
  const cleaned = reference.replace(/\u2013|\u2014/g, "-").trim();
  if (!cleaned) {
    return null;
  }

  const match = cleaned.match(
    /^((?:[123]|I{1,3}|1st|2nd|3rd)?\s*[A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?$/i
  );

  if (!match) {
    return null;
  }

  const bookKey = normalizeBookKey(match[1]);
  const bookUsfm = BOOK_ALIASES[bookKey];
  if (!bookUsfm) {
    return null;
  }

  const chapter = Number(match[2]);
  const verseStart = match[3] ? Number(match[3]) : 1;
  const verseEnd = match[4] ? Number(match[4]) : null;

  if (!Number.isFinite(chapter) || chapter <= 0 || !Number.isFinite(verseStart) || verseStart <= 0) {
    return null;
  }

  const usfmPassage =
    verseEnd && verseEnd !== verseStart
      ? `${bookUsfm}.${chapter}.${verseStart}-${verseEnd}`
      : `${bookUsfm}.${chapter}.${verseStart}`;

  return {
    bookUsfm,
    chapter,
    verseStart,
    verseEnd,
    usfmPassage,
    displayReference: cleaned
  };
}

/** YouVersion / bible.com deep link for English ESV. */
export function buildYouVersionEsvUrl(reference: string): string | null {
  const parsed = parseScriptureReference(reference);
  if (!parsed) {
    return null;
  }

  return `https://www.bible.com/bible/${ESV_VERSION_ID}/${parsed.usfmPassage}.ESV`;
}

function getAppKey() {
  return process.env.YOUVERSION_APP_KEY?.trim() || null;
}

export function isYouVersionConfigured() {
  return Boolean(getAppKey());
}

type PassageResponse = {
  id?: string;
  content?: string;
  reference?: string;
  message?: string;
};

/**
 * Validate a reference against YouVersion (open Bible) and return ESV deep-link metadata.
 * ESV text is not returned by the API for this app key (publisher access required).
 */
export async function resolveScriptureForYouVersion(reference: string): Promise<{
  reference: string;
  usfmPassage: string | null;
  youVersionEsvUrl: string | null;
  validated: boolean;
  content: string | null;
}> {
  const parsed = parseScriptureReference(reference);
  const youVersionEsvUrl = buildYouVersionEsvUrl(reference);

  if (!parsed) {
    return {
      reference,
      usfmPassage: null,
      youVersionEsvUrl: null,
      validated: false,
      content: null
    };
  }

  const appKey = getAppKey();
  if (!appKey) {
    return {
      reference: parsed.displayReference,
      usfmPassage: parsed.usfmPassage,
      youVersionEsvUrl,
      validated: false,
      content: null
    };
  }

  try {
    // Prefer ESV if the key gains access later; fall back to open Bible for validation.
    const tryIds = [ESV_VERSION_ID, RESOLVE_BIBLE_ID];
    let content: string | null = null;
    let validated = false;

    for (const bibleId of tryIds) {
      const url = `https://api.youversion.com/v1/bibles/${bibleId}/passages/${encodeURIComponent(parsed.usfmPassage)}`;
      const response = await fetch(url, {
        headers: {
          "X-YVP-App-Key": appKey,
          Accept: "application/json"
        },
        next: { revalidate: 60 * 60 * 24 }
      });

      if (!response.ok) {
        continue;
      }

      const payload = (await response.json()) as PassageResponse;
      validated = true;
      // Only keep text when it came from ESV; otherwise leave content null so we don't mislabel.
      if (bibleId === ESV_VERSION_ID && payload.content) {
        content = payload.content;
      }
      break;
    }

    return {
      reference: parsed.displayReference,
      usfmPassage: parsed.usfmPassage,
      youVersionEsvUrl,
      validated,
      content
    };
  } catch {
    return {
      reference: parsed.displayReference,
      usfmPassage: parsed.usfmPassage,
      youVersionEsvUrl,
      validated: false,
      content: null
    };
  }
}

export async function resolveManyScriptures(references: Array<string | null | undefined>) {
  const unique = [...new Set(references.filter((value): value is string => Boolean(value?.trim())))];
  const entries = await Promise.all(
    unique.map(async (reference) => [reference, await resolveScriptureForYouVersion(reference)] as const)
  );
  return new Map(entries);
}

type ChapterPayload = {
  id?: string;
  verses?: Array<{ id: string; title?: string }>;
  data?: {
    id?: string;
    verses?: Array<{ id: string; title?: string }>;
  };
};

/**
 * Verse count for a book/chapter via YouVersion (open Bible).
 * Falls back to a generous default if the API is unavailable.
 */
export async function getChapterVerseCount(bookUsfm: string, chapter: number): Promise<number> {
  const appKey = getAppKey();
  if (!appKey || !bookUsfm || !Number.isFinite(chapter) || chapter <= 0) {
    return 50;
  }

  try {
    const url = `https://api.youversion.com/v1/bibles/${RESOLVE_BIBLE_ID}/books/${encodeURIComponent(bookUsfm)}/chapters/${chapter}`;
    const response = await fetch(url, {
      headers: {
        "X-YVP-App-Key": appKey,
        Accept: "application/json"
      },
      next: { revalidate: 60 * 60 * 24 * 7 }
    });

    if (!response.ok) {
      return 50;
    }

    const payload = (await response.json()) as ChapterPayload;
    const verses = payload.verses ?? payload.data?.verses ?? [];
    return verses.length > 0 ? verses.length : 50;
  } catch {
    return 50;
  }
}

/**
 * Fetch passage text for admin preview/autofill.
 * Uses open Bible (BSB) when ESV is not licensed on the app key.
 */
export async function fetchPassageText(usfmPassage: string): Promise<{
  content: string | null;
  reference: string | null;
  source: "esv" | "open" | null;
}> {
  const appKey = getAppKey();
  if (!appKey || !usfmPassage) {
    return { content: null, reference: null, source: null };
  }

  const attempts: Array<{ id: number; source: "esv" | "open" }> = [
    { id: ESV_VERSION_ID, source: "esv" },
    { id: RESOLVE_BIBLE_ID, source: "open" }
  ];

  for (const attempt of attempts) {
    try {
      const url = `https://api.youversion.com/v1/bibles/${attempt.id}/passages/${encodeURIComponent(usfmPassage)}`;
      const response = await fetch(url, {
        headers: {
          "X-YVP-App-Key": appKey,
          Accept: "application/json"
        },
        cache: "no-store"
      });

      if (!response.ok) {
        continue;
      }

      const payload = (await response.json()) as PassageResponse;
      if (payload.content) {
        return {
          content: payload.content,
          reference: payload.reference ?? null,
          source: attempt.source
        };
      }
    } catch {
      // try next
    }
  }

  return { content: null, reference: null, source: null };
}
