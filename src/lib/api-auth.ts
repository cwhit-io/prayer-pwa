import { authenticateApiToken } from "@/lib/api-tokens";

export function jsonError(message: string, status: number) {
  return Response.json({ ok: false, error: message }, { status });
}

export async function requireApiAuth(request: Request) {
  const auth = await authenticateApiToken(request.headers.get("authorization"));
  if (!auth) {
    return { ok: false as const, response: jsonError("Unauthorized. Use Authorization: Bearer <token>.", 401) };
  }
  return { ok: true as const, tokenId: auth.tokenId };
}

export async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,|;]+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

export function asBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["1", "true", "yes", "y", "active"].includes(v)) {
      return true;
    }
    if (["0", "false", "no", "n", "inactive"].includes(v)) {
      return false;
    }
  }
  return fallback;
}
