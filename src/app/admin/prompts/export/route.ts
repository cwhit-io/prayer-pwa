import { getCurrentUser, hasCapability } from "@/lib/auth";
import { rowsToCsv } from "@/lib/csv";
import { listAllPrayerPromptsForExport } from "@/lib/prompts";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasCapability(user.role, "prayer-content:manage")) {
    return new Response("Prayer content access required.", { status: 403 });
  }

  const prompts = await listAllPrayerPromptsForExport();
  const rows: Array<Array<string | boolean>> = [
    [
      "title",
      "body",
      "tags",
      "scripture_reference",
      "scripture_text",
      "publish_date",
      "is_active"
    ]
  ];

  for (const prompt of prompts) {
    rows.push([
      prompt.title,
      prompt.body,
      (prompt.tags.length > 0 ? prompt.tags : [prompt.category]).join("|"),
      prompt.scriptureReference ?? "",
      prompt.scriptureText ?? "",
      prompt.publishDate,
      prompt.isActive ? "true" : "false"
    ]);
  }

  const csv = rowsToCsv(rows);
  const filename = `campaign-prompts-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
