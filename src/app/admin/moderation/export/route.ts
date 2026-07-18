import { getCurrentUser } from "@/lib/auth";
import { rowsToCsv } from "@/lib/csv";
import { listModerationKeywords } from "@/lib/moderation";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return new Response("Admin access required.", { status: 403 });
  }

  const keywords = await listModerationKeywords();
  const rows: Array<Array<string | boolean>> = [["keyword", "is_active", "notes"]];

  for (const entry of keywords) {
    rows.push([entry.keyword, entry.isActive ? "true" : "false", entry.notes ?? ""]);
  }

  const csv = rowsToCsv(rows);
  const filename = `moderation-keywords-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
