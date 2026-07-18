import { listAllActsPromptsForExport } from "@/lib/acts-prompts";
import { getCurrentUser } from "@/lib/auth";
import { rowsToCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return new Response("Admin access required.", { status: 403 });
  }

  const prompts = await listAllActsPromptsForExport();
  const rows: Array<Array<string | boolean>> = [
    ["step", "title", "body", "tags", "scripture_reference", "scripture_text", "is_active"]
  ];

  for (const prompt of prompts) {
    rows.push([
      prompt.step,
      prompt.title,
      prompt.body,
      prompt.tags.join("|"),
      prompt.scriptureReference ?? "",
      prompt.scriptureText ?? "",
      prompt.isActive ? "true" : "false"
    ]);
  }

  const csv = rowsToCsv(rows);
  const filename = `acts-prompts-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
