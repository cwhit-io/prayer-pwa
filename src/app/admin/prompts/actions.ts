"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { cellAt, cellAtAny, csvHeaderMap, headerHasAny, parseCsv } from "@/lib/csv";
import { redirectWithError, redirectWithQuery, rethrowIfNextNavigation } from "@/lib/form-action";
import {
  appendPrayerPromptsFromRows,
  createPrayerPrompt,
  replacePrayerPromptsFromRows,
  setPrayerPromptActive,
  updatePrayerPrompt
} from "@/lib/prompts";
import { filterReservedStepTagNames, parseTagNameList, readTagsFromCsvRow } from "@/lib/tags";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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

function readTagsFromForm(formData: FormData): string[] {
  const checked = formData
    .getAll("tags")
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  const extra = parseTagNameList(readText(formData, "tags_extra"));
  return filterReservedStepTagNames(Array.from(new Set([...checked, ...extra])));
}

async function parsePromptFields(formData: FormData) {
  const title = readText(formData, "title");
  const body = readText(formData, "body");
  const tags = readTagsFromForm(formData);
  const publishDate = readText(formData, "publish_date");

  if (!title || !body || !publishDate || tags.length === 0) {
    throw new Error("Title, body, at least one tag, and publish date are required.");
  }

  return {
    title,
    body,
    tags,
    publishDate,
    scriptureReference: readText(formData, "scripture_reference") || null,
    scriptureText: readText(formData, "scripture_text") || null,
    isActive: formData.get("is_active") === "on"
  };
}

export async function createPromptAction(formData: FormData) {
  try {
    const user = await requireAdmin();
    const fields = await parsePromptFields(formData);

    await createPrayerPrompt({
      ...fields,
      createdBy: user.id
    });

    revalidatePath("/admin/prompts");
    revalidatePath("/admin/categories");
    revalidatePath("/prompts");
    revalidatePath("/log");
    redirectWithQuery("/admin/prompts", { saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/prompts", error, "Could not create prompt.");
  }
}

export async function updatePromptAction(formData: FormData) {
  try {
    await requireAdmin();
    const id = readText(formData, "id");

    if (!id) {
      redirectWithError("/admin/prompts", "Prompt id is required.");
    }

    const fields = await parsePromptFields(formData);
    await updatePrayerPrompt({ id, ...fields });

    revalidatePath("/admin/prompts");
    revalidatePath("/admin/categories");
    revalidatePath("/prompts");
    revalidatePath("/log");
    redirectWithQuery("/admin/prompts", { saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/prompts", error, "Could not update prompt.");
  }
}

export async function setPromptStatusAction(formData: FormData) {
  try {
    await requireAdmin();
    const id = readText(formData, "id");
    const isActive = readText(formData, "is_active") === "true";

    if (!id) {
      redirectWithError("/admin/prompts", "Prompt id is required.");
    }

    await setPrayerPromptActive({ id, isActive });
    revalidatePath("/admin/prompts");
    revalidatePath("/prompts");
    revalidatePath("/log");
    redirectWithQuery("/admin/prompts", { saved: "1" });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/prompts", error, "Could not update prompt status.");
  }
}

/** Upload CSV and replace or append campaign prompts (multi-tag aware). */
export async function importCampaignPromptsCsvAction(formData: FormData) {
  try {
    const user = await requireAdmin();
    const modeRaw = readText(formData, "import_mode").toLowerCase();
    const mode = modeRaw === "append" ? "append" : "replace";

    const upload = formData.get("csv_file");
    if (!(upload instanceof File) || upload.size === 0) {
      redirectWithError("/admin/prompts", "Choose a CSV file to upload.");
      return;
    }
    const file = upload;
    if (file.size > 2_000_000) {
      redirectWithError("/admin/prompts", "CSV is too large (max 2MB).");
    }

    const text = await file.text();
    const table = parseCsv(text);
    if (table.length < 2) {
      redirectWithError(
        "/admin/prompts",
        "CSV needs a header row and at least one data row."
      );
    }

    const header = csvHeaderMap(table[0]);
    for (const key of ["title", "body"]) {
      if (!header.has(key)) {
        redirectWithError(
          "/admin/prompts",
          `CSV is missing required column “${key}”. Download the export for the template.`
        );
      }
    }
    if (!headerHasAny(header, ["tags", "tag", "category", "categories"])) {
      redirectWithError(
        "/admin/prompts",
        "CSV needs a “tags” column (or legacy “category”). Separate multiple tags with | or ;."
      );
    }

    const rows: Array<{
      title: string;
      body: string;
      tags: string[];
      scriptureReference: string | null;
      scriptureText: string | null;
      publishDate: string;
      isActive: boolean;
    }> = [];

    for (let i = 1; i < table.length; i += 1) {
      const line = table[i];
      if (!line || line.every((c) => !String(c).replace(/^\uFEFF/, "").trim())) {
        continue;
      }
      const title = cellAt(line, header, "title");
      const body = cellAt(line, header, "body");
      const tags = readTagsFromCsvRow(line, header, cellAt, cellAtAny);
      if (!title || !body || tags.length === 0) {
        redirectWithError(
          "/admin/prompts",
          `Row ${i + 1}: title, body, and at least one tag are required.`
        );
        continue;
      }

      const publishRaw = cellAt(line, header, "publish_date") || todayIso();
      const publishDate = /^\d{4}-\d{2}-\d{2}$/.test(publishRaw) ? publishRaw : todayIso();

      rows.push({
        title,
        body,
        tags,
        scriptureReference: cellAt(line, header, "scripture_reference") || null,
        scriptureText: cellAt(line, header, "scripture_text") || null,
        publishDate,
        isActive: parseBool(cellAt(line, header, "is_active"), true)
      });
    }

    if (rows.length === 0) {
      redirectWithError("/admin/prompts", "CSV has no data rows after the header.");
    }

    const result =
      mode === "append"
        ? await appendPrayerPromptsFromRows(rows, user.id)
        : await replacePrayerPromptsFromRows(rows, user.id);

    revalidatePath("/admin/prompts");
    revalidatePath("/admin/categories");
    revalidatePath("/prompts");
    revalidatePath("/log");
    redirectWithQuery("/admin/prompts", {
      imported: "1",
      count: String(result.count),
      mode,
      cats_new: String(result.tagsCreated),
      cats_on: String(result.tagsReactivated)
    });
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError("/admin/prompts", error, "Could not import CSV.");
  }
}
