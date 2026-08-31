import { NextResponse } from "next/server";
import { getRecentPublicSessionPulse } from "@/lib/campaign";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessions = await getRecentPublicSessionPulse(8);
  return NextResponse.json(
    { sessions },
    { headers: { "Cache-Control": "no-store" } }
  );
}
