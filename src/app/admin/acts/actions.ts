"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  appendActsPromptsFromRows,
  createActsPrompt,
  parseActsStepLetter,
  replaceActsPromptsFromRows,
  setActsPromptActive,
  type ActsImportRow,
  type ActsStepLetter,
  updateActsPrompt
} from "@/lib/acts-prompts";
import { cellAt, cellAtAny, csvHeaderMap, headerHasAny, parseCsv } from "@/lib/csv";
import { redirectWithError, redirectWithQuery, rethrowIfNextNavigation } from "@/lib/form-action";
import { parseTagNameList, readTagsFromCsvRow } from "@/lib/tags";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }
  if (user.role !== "admin") {
    redirectWithError("/admin", "Admin access is required.");
  }
  return user;
}

function parseStep(value: string): ActsStepLetter {
  const step = parseActsStepLetter(value);
  if (step) {
    return step;
  }
  throw new Error(
    `Choose Adoration, Confession, or Thanksgiving (use A, C, T, or the full step name). Got: “${value || "(empty)"}”.`
  );
}

function readTagsFromForm(formData: FormData): string[] {
  const checked = formData
    .getAll("tags")
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  const extra = parseTagNameList(readText(formData, "tags_extra"));
  // parseTagNameList already drops reserved step names.
  return Array.from(new Set([...checked, ...extra])).filter(
    (tag) => !["adoration", "confession", "thanksgiving", "supplication"].includes(tag.toLowerCase())
  );
}

function revalidateActs() {
  revalidatePath("/admin/acts");
  revalidatePath("/admin/categories");
  revalidatePath("/log");
}

export async function createActsPromptAction(formData: FormData) {
  try {
    await requireAdmin();
    const step = parseStep(readText(formData, "step"));
    const title = readText(formData, "title");
    const body = readText(formData, "body");
    const tags = readTagsFromForm(formData);

    if (!title || !body) {
      redirectWithError("/admin/acts", "Title and prayer focus are required.");
    }

    await createActsPrompt({
      step,
      title,
      body,
      scriptureReference: readText(formData, "scripture_reference") || null,
      scriptureText: readText(formData, "scripture_text") || null,
      isActive: formData.get("is_active") === "on",
      tags
    });

    revalidateActs();
    redirectWithQuery("/admin/acts", { saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/acts", error, "Could not create ACTS prompt.");
  }
}

export async function updateActsPromptAction(formData: FormData) {
  try {
    await requireAdmin();
    const id = readText(formData, "id");
    const step = parseStep(readText(formData, "step"));
    const title = readText(formData, "title");
    const body = readText(formData, "body");
    const tags = readTagsFromForm(formData);

    if (!id || !title || !body) {
      redirectWithError("/admin/acts", "Id, title, and prayer focus are required.");
    }

    // Always replace tag set from the form (including empty = clear tags).
    await updateActsPrompt({
      id,
      step,
      title,
      body,
      scriptureReference: readText(formData, "scripture_reference") || null,
      scriptureText: readText(formData, "scripture_text") || null,
      isActive: formData.get("is_active") === "on",
      tags
    });

    revalidateActs();
    redirectWithQuery("/admin/acts", { saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/acts", error, "Could not update ACTS prompt.");
  }
}

export async function setActsPromptStatusAction(formData: FormData) {
  try {
    await requireAdmin();
    const id = readText(formData, "id");
    const isActive = readText(formData, "is_active") === "true";

    if (!id) {
      redirectWithError("/admin/acts", "Prompt id is required.");
    }

    await setActsPromptActive({ id, isActive });
    revalidateActs();
    redirectWithQuery("/admin/acts", { saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/acts", error, "Could not update prompt status.");
  }
}

function parseBool(value: string, fallback = true) {
  const v = value.trim().toLowerCase();
  if (!v) {
    return fallback;
  }
  if (["1", "true", "yes", "y", "active"].includes(v)) {
    return true;
  }
  if (["0", "false", "no", "n", "inactive"].includes(v)) {
    return false;
  }
  return fallback;
}

/** Upload CSV and replace or append ACTS prompts. */
export async function importActsPromptsCsvAction(formData: FormData) {
  try {
    await requireAdmin();
    const modeRaw = readText(formData, "import_mode").toLowerCase();
    const mode = modeRaw === "append" ? "append" : "replace";

    const upload = formData.get("csv_file");
    if (!(upload instanceof File) || upload.size === 0) {
      redirectWithError("/admin/acts", "Choose a CSV file to upload.");
      return;
    }
    const file = upload;
    if (file.size > 2_000_000) {
      redirectWithError("/admin/acts", "CSV is too large (max 2MB).");
    }

    const text = await file.text();
    const table = parseCsv(text);
    if (table.length < 2) {
      redirectWithError("/admin/acts", "CSV needs a header row and at least one data row.");
    }

    const header = csvHeaderMap(table[0]);
    const stepKeys = ["step", "acts_step", "letter", "step_letter"];
    if (!headerHasAny(header, stepKeys)) {
      redirectWithError(
        "/admin/acts",
        "CSV is missing required column “step” (A/C/T or Adoration/Confession/Thanksgiving). Download the export for a template."
      );
    }
    for (const key of ["title", "body"]) {
      if (!header.has(key)) {
        redirectWithError(
          "/admin/acts",
          `CSV is missing required column “${key}”. Download the export for the template.`
        );
      }
    }

    const rows: ActsImportRow[] = [];

    for (let i = 1; i < table.length; i += 1) {
      const line = table[i];
      if (!line || line.every((c) => !String(c).replace(/^\uFEFF/, "").trim())) {
        continue;
      }
      const stepRaw = cellAtAny(line, header, stepKeys);
      const step = parseActsStepLetter(stepRaw);
      if (!step) {
        redirectWithError(
          "/admin/acts",
          `Row ${i + 1}: step must be A, C, T (or Adoration / Confession / Thanksgiving). Got: “${stepRaw || "(empty)"}”.`
        );
        continue;
      }
      const title = cellAt(line, header, "title");
      const body = cellAt(line, header, "body");
      if (!title || !body) {
        redirectWithError("/admin/acts", `Row ${i + 1}: title and body are required.`);
        continue;
      }

      const tags = readTagsFromCsvRow(line, header, cellAt, cellAtAny);

      rows.push({
        step,
        title,
        body,
        scriptureReference:
          cellAtAny(line, header, ["scripture_reference", "scripture", "reference"]) || null,
        scriptureText: cellAtAny(line, header, ["scripture_text", "passage", "verse_text"]) || null,
        isActive: parseBool(cellAtAny(line, header, ["is_active", "active", "status"]), true),
        tags
      });
    }

    if (rows.length === 0) {
      redirectWithError("/admin/acts", "CSV has no data rows after the header.");
    }

    const result =
      mode === "append"
        ? await appendActsPromptsFromRows(rows)
        : await replaceActsPromptsFromRows(rows);
    revalidateActs();
    redirectWithQuery("/admin/acts", {
      imported: "1",
      count: String(result.count),
      mode
    });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/acts", error, "Could not import CSV.");
  }
}
