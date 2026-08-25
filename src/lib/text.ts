/**
 * Repair Word/Excel punctuation so apostrophes and quotes don't render as �.
 *
 * Typical cause: a Windows-1252 CSV (smart quotes, dashes) decoded as UTF-8.
 * Invalid bytes become U+FFFD; C1 controls (U+0080–U+009F) are the Latin-1
 * misread of the same Windows bytes.
 */

const CP1252_C1: Record<number, string> = {
  0x80: "\u20AC",
  0x82: "\u201A",
  0x83: "\u0192",
  0x84: "\u201E",
  0x85: "\u2026",
  0x86: "\u2020",
  0x87: "\u2021",
  0x88: "\u02C6",
  0x89: "\u2030",
  0x8a: "\u0160",
  0x8b: "\u2039",
  0x8c: "\u0152",
  0x8e: "\u017D",
  0x91: "\u2018",
  0x92: "\u2019",
  0x93: "\u201C",
  0x94: "\u201D",
  0x95: "\u2022",
  0x96: "\u2013",
  0x97: "\u2014",
  0x98: "\u02DC",
  0x99: "\u2122",
  0x9a: "\u0161",
  0x9b: "\u203A",
  0x9c: "\u0153",
  0x9e: "\u017E",
  0x9f: "\u0178"
};

/** UTF-8 punctuation that was decoded as Windows-1252 (â€™, â€œ, …). */
const MOJIBAKE: Array<[string, string]> = [
  ["\u00E2\u20AC\u2122", "\u2019"], // â€™
  ["\u00E2\u20AC\u02DC", "\u2018"], // â€˜
  ["\u00E2\u20AC\u0153", "\u201C"], // âœ
  ["\u00E2\u20AC\u009D", "\u201D"], // â€\x9d
  ["\u00E2\u20AC\u201D", "\u2014"], // â€”  (em dash)
  ["\u00E2\u20AC\u201C", "\u2013"], // â€“ (en dash)
  ["\u00E2\u20AC\u00A6", "\u2026"], // â€¦
  ["\u00C2\u00A0", "\u00A0"],
  ["\u00C2 ", " "]
];

/** Apostrophe/contraction after a letter: God's, don't, we're, I'll, I've, I'd, I'm. */
const APOSTROPHE_AFTER = /^(?:s|t|d|m|ll|re|ve)(?!\p{L})/u;

function isLetter(ch: string) {
  return /\p{L}/u.test(ch);
}

function repairReplacementChars(text: string) {
  return text.replace(/\uFFFD/g, (_match, offset: number, full: string) => {
    const prev = offset > 0 ? full[offset - 1] : "";
    const after = full.slice(offset + 1);
    const next = after[0] ?? "";
    const before = full.slice(0, offset);

    if (isLetter(prev) && APOSTROPHE_AFTER.test(after)) {
      return "\u2019";
    }

    const opensQuote =
      offset === 0 ||
      /[\s(\[{]$/.test(prev) ||
      /[,:;]\s*$/.test(before);
    if (opensQuote && /[\p{L}\p{N}]/u.test(next)) {
      return "\u201C";
    }

    if (
      /[\p{L}\p{N}.!?…'’]$/u.test(prev) &&
      (after === "" || /^[\s.,;:!?)}\]]/.test(after))
    ) {
      return "\u201D";
    }

    if (isLetter(prev) && isLetter(next)) {
      return "\u2014";
    }

    if (/\s$/.test(prev) && /^\s/.test(after)) {
      return "\u2014";
    }

    return "\u2019";
  });
}

function mapC1Controls(text: string) {
  return text.replace(/[\u0080-\u009F]/g, (ch) => CP1252_C1[ch.charCodeAt(0)] ?? "");
}

function replaceMojibake(text: string) {
  let next = text;
  for (const [from, to] of MOJIBAKE) {
    if (from && next.includes(from)) {
      next = next.split(from).join(to);
    }
  }
  return next;
}

/** Normalize pasted / imported copy for storage and display. */
export function repairImportedText(value: string) {
  if (!value) {
    return value;
  }

  return repairReplacementChars(mapC1Controls(replaceMojibake(value))).normalize("NFC");
}

export function repairImportedTextOrNull(value: string | null | undefined) {
  if (value == null) {
    return null;
  }
  const repaired = repairImportedText(value);
  return repaired === "" ? null : repaired;
}

export function sanitizePromptCopy<
  T extends {
    title: string;
    body: string;
    scriptureReference?: string | null;
    scriptureText?: string | null;
  }
>(input: T): T {
  return {
    ...input,
    title: repairImportedText(input.title),
    body: repairImportedText(input.body),
    scriptureReference: repairImportedTextOrNull(input.scriptureReference ?? null),
    scriptureText: repairImportedTextOrNull(input.scriptureText ?? null)
  };
}

function decodeWindows1252(bytes: Uint8Array) {
  let out = "";
  for (const byte of bytes) {
    if (byte < 0x80) {
      out += String.fromCharCode(byte);
      continue;
    }
    out += CP1252_C1[byte] ?? String.fromCharCode(byte);
  }
  return out;
}

/**
 * Decode admin CSV bytes. Excel on Windows often saves Windows-1252, not UTF-8.
 * `File.text()` always uses UTF-8 with replacement, which is how � gets stored.
 */
export function decodeImportedBytes(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes);
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return decodeWindows1252(bytes);
  }
}
