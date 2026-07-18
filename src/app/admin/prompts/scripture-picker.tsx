"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BIBLE_BOOKS, formatScriptureReference, getBibleBook } from "@/lib/bible-books";
import { buildYouVersionEsvUrl, parseScriptureReference } from "@/lib/youversion";
import { loadChapterVersesAction, loadPassageTextAction } from "./scripture-actions";

type ScripturePickerProps = {
  initialReference?: string | null;
  initialText?: string | null;
};

function parseInitial(reference?: string | null) {
  if (!reference) {
    return null;
  }
  return parseScriptureReference(reference);
}

export function ScripturePicker({ initialReference, initialText }: ScripturePickerProps) {
  const parsed = parseInitial(initialReference);
  const hasUserPicked = useRef(false);

  const [bookUsfm, setBookUsfm] = useState(parsed?.bookUsfm ?? "");
  const [chapter, setChapter] = useState(parsed?.chapter ? String(parsed.chapter) : "");
  const [verseStart, setVerseStart] = useState(parsed?.verseStart ? String(parsed.verseStart) : "");
  const [verseEnd, setVerseEnd] = useState(
    parsed?.verseEnd ? String(parsed.verseEnd) : parsed?.verseStart ? String(parsed.verseStart) : ""
  );
  const [verseCount, setVerseCount] = useState(50);
  const [reference, setReference] = useState(initialReference ?? "");
  const [text, setText] = useState(initialText ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function markPicked() {
    hasUserPicked.current = true;
  }

  const book = useMemo(() => (bookUsfm ? getBibleBook(bookUsfm) : null), [bookUsfm]);
  const chapterOptions = useMemo(() => {
    if (!book) {
      return [];
    }
    return Array.from({ length: book.chapters }, (_, index) => index + 1);
  }, [book]);

  const verseOptions = useMemo(() => {
    return Array.from({ length: Math.max(1, verseCount) }, (_, index) => index + 1);
  }, [verseCount]);

  const usfmPassage = useMemo(() => {
    if (!bookUsfm || !chapter || !verseStart) {
      return null;
    }
    const start = Number(verseStart);
    const end = verseEnd ? Number(verseEnd) : start;
    if (!Number.isFinite(start) || start <= 0) {
      return null;
    }
    if (Number.isFinite(end) && end > start) {
      return `${bookUsfm}.${chapter}.${start}-${end}`;
    }
    return `${bookUsfm}.${chapter}.${start}`;
  }, [bookUsfm, chapter, verseStart, verseEnd]);

  const esvUrl = useMemo(() => (reference ? buildYouVersionEsvUrl(reference) : null), [reference]);

  // Load verse count when book/chapter change.
  useEffect(() => {
    if (!bookUsfm || !chapter) {
      return;
    }

    let cancelled = false;
    startTransition(async () => {
      const result = await loadChapterVersesAction(bookUsfm, Number(chapter));
      if (cancelled) {
        return;
      }
      setVerseCount(result.verseCount);

      // Clamp verses if they exceed the chapter.
      setVerseStart((current) => {
        const value = Number(current);
        if (!current || value < 1) {
          return "1";
        }
        if (value > result.verseCount) {
          return String(result.verseCount);
        }
        return current;
      });
      setVerseEnd((current) => {
        const value = Number(current);
        if (!current || value < 1) {
          return "1";
        }
        if (value > result.verseCount) {
          return String(result.verseCount);
        }
        return current;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [bookUsfm, chapter]);

  // Auto-build human reference + load text only after the admin uses the picker.
  useEffect(() => {
    if (!hasUserPicked.current || !book || !chapter || !verseStart || !usfmPassage) {
      return;
    }

    const start = Number(verseStart);
    const end = verseEnd ? Number(verseEnd) : start;
    if (!Number.isFinite(start) || start <= 0) {
      return;
    }

    const nextReference = formatScriptureReference({
      bookName: book.name,
      chapter: Number(chapter),
      verseStart: start,
      verseEnd: Number.isFinite(end) && end > start ? end : null
    });
    setReference(nextReference);

    let cancelled = false;
    startTransition(async () => {
      setStatus("Loading passage…");
      const result = await loadPassageTextAction(usfmPassage);
      if (cancelled) {
        return;
      }

      if (result.content) {
        setText(result.content);
        setStatus(
          result.source === "esv"
            ? "Loaded English Standard Version text."
            : "Loaded passage text for the prompt. Members still open ESV on YouVersion."
        );
      } else {
        setStatus("Could not load passage text. Reference is still set for YouVersion ESV.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [book, chapter, verseStart, verseEnd, usfmPassage]);

  function clearPicker() {
    markPicked();
    setBookUsfm("");
    setChapter("");
    setVerseStart("");
    setVerseEnd("");
    setReference("");
    setText("");
    setStatus(null);
  }

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-black/25 p-4">
      <div>
        <p className="text-sm font-black uppercase text-yellow">Scripture picker</p>
        <p className="mt-1 text-xs text-white/50">
          Choose book, chapter, and verse(s). The reference auto-fills and links to ESV on YouVersion.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="plc-label block space-y-2">
          <span>Book</span>
          <select
            value={bookUsfm}
            onChange={(event) => {
              markPicked();
              setBookUsfm(event.target.value);
              setChapter("");
              setVerseStart("");
              setVerseEnd("");
            }}
            className="plc-input w-full px-3 py-2"
          >
            <option value="">Select book…</option>
            {BIBLE_BOOKS.map((item) => (
              <option key={item.usfm} value={item.usfm}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="plc-label block space-y-2">
          <span>Chapter</span>
          <select
            value={chapter}
            disabled={!book}
            onChange={(event) => {
              markPicked();
              setChapter(event.target.value);
              setVerseStart("1");
              setVerseEnd("1");
            }}
            className="plc-input w-full px-3 py-2 disabled:opacity-40"
          >
            <option value="">{book ? "Select chapter…" : "Pick a book first"}</option>
            {chapterOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="plc-label block space-y-2">
          <span>Verse start</span>
          <select
            value={verseStart}
            disabled={!chapter}
            onChange={(event) => {
              markPicked();
              const next = event.target.value;
              setVerseStart(next);
              setVerseEnd((current) => {
                if (!current || Number(current) < Number(next)) {
                  return next;
                }
                return current;
              });
            }}
            className="plc-input w-full px-3 py-2 disabled:opacity-40"
          >
            <option value="">{chapter ? "Select verse…" : "Pick a chapter first"}</option>
            {verseOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="plc-label block space-y-2">
          <span>Verse end (optional)</span>
          <select
            value={verseEnd}
            disabled={!verseStart}
            onChange={(event) => {
              markPicked();
              setVerseEnd(event.target.value);
            }}
            className="plc-input w-full px-3 py-2 disabled:opacity-40"
          >
            <option value="">{verseStart ? "Same as start / select end…" : "Pick a start verse"}</option>
            {verseOptions
              .filter((value) => !verseStart || value >= Number(verseStart))
              .map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={clearPicker} className="plc-button-secondary">
          Clear scripture
        </button>
        {isPending ? <span className="text-xs uppercase tracking-wide text-white/45">Updating…</span> : null}
        {status ? <span className="text-xs text-white/55">{status}</span> : null}
      </div>

      <label className="plc-label block space-y-2">
        <span>Scripture reference</span>
        <input
          name="scripture_reference"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="Psalm 46:10"
          className="plc-input w-full px-4 py-3"
        />
        {esvUrl ? (
          <a
            href={esvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-xs font-black uppercase text-yellow"
          >
            Preview on YouVersion ESV ↗
          </a>
        ) : (
          <span className="text-xs font-normal normal-case tracking-normal text-white/45">
            Or type a reference manually. Picker values auto-fill this field.
          </span>
        )}
      </label>

      <label className="plc-label block space-y-2">
        <span>Scripture text</span>
        <textarea
          name="scripture_text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="plc-input min-h-24 w-full px-4 py-3"
          placeholder="Passage text loads when you finish picking verses (editable)."
        />
      </label>
    </div>
  );
}
