/** Minimal CSV helpers for admin import/export. */

export function escapeCsvCell(value: string | number | boolean | null | undefined) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function rowsToCsv(rows: Array<Array<string | number | boolean | null | undefined>>) {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n") + "\n";
}

/** Parse CSV text into rows of cells (supports quoted commas/newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    // Skip fully empty trailing rows
    if (row.length === 1 && row[0] === "" && rows.length > 0) {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushCell();
    } else if (ch === "\n") {
      pushCell();
      pushRow();
    } else if (ch === "\r") {
      // ignore CR; LF handles line end
    } else {
      cell += ch;
    }
  }

  // last cell/row
  pushCell();
  if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
    pushRow();
  }

  return rows;
}

/** Normalize a CSV header/cell for matching (BOM, whitespace, case). */
export function normalizeCsvKey(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function csvHeaderMap(headerRow: string[]) {
  const map = new Map<string, number>();
  headerRow.forEach((name, index) => {
    const key = normalizeCsvKey(name);
    if (key) {
      map.set(key, index);
    }
  });
  return map;
}

export function cellAt(row: string[], map: Map<string, number>, key: string) {
  const index = map.get(normalizeCsvKey(key));
  if (index == null) {
    return "";
  }
  return (row[index] ?? "").replace(/^\uFEFF/, "").trim();
}

/**
 * Look up a cell by any of several header aliases (first match wins).
 * Useful when exports use slightly different column names.
 */
export function cellAtAny(row: string[], map: Map<string, number>, keys: string[]) {
  for (const key of keys) {
    if (map.has(normalizeCsvKey(key))) {
      return cellAt(row, map, key);
    }
  }
  return "";
}

export function headerHasAny(map: Map<string, number>, keys: string[]) {
  return keys.some((key) => map.has(normalizeCsvKey(key)));
}
