import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { runNotificationScheduler } from "@/lib/notification-scheduler";
import { getNotificationSchedulerSecret } from "@/lib/notification-scheduler-auth";

export const dynamic = "force-dynamic";

function isAuthorizedSchedulerRequest(request: Request) {
  const secret = getNotificationSchedulerSecret();
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const supplied = authorization.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

export async function POST(request: Request) {
  if (!isAuthorizedSchedulerRequest(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const result = await runNotificationScheduler({
    dryRun: url.searchParams.get("dry_run") === "1"
  });
  return NextResponse.json(result);
}
