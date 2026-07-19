import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  refreshSessionToken,
  SESSION_COOKIE_NAME
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const response = new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store"
    }
  });

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return response;
  }

  const refreshed = await refreshSessionToken(token);

  if (!refreshed) {
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  response.cookies.set(SESSION_COOKIE_NAME, refreshed.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: refreshed.expiresAt,
    path: "/"
  });

  return response;
}
