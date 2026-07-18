import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

/** Safe message for query-string flash banners (max length). */
export function actionErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  // Call sites often pass a plain string: redirectWithError(path, "…message…")
  if (typeof error === "string" && error.trim()) {
    return error.replace(/\s+/g, " ").trim().slice(0, 480);
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.replace(/\s+/g, " ").trim().slice(0, 480);
  }
  return fallback;
}

/** Must rethrow Next.js redirect/not-found from catch blocks. */
export function rethrowIfNextNavigation(error: unknown): void {
  if (isRedirectError(error)) {
    throw error;
  }
  // NEXT_HTTP_ERROR_FALLBACK;not-found etc.
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_")
  ) {
    throw error;
  }
}

/**
 * Redirect with query params. Preserves path hash if present.
 * Prefer this over `throw new Error` in form actions so the UI gets a banner, not a crash.
 */
export function redirectWithQuery(path: string, query: Record<string, string | undefined | null> = {}) {
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const pathAndSearch = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const qIndex = pathAndSearch.indexOf("?");
  const pathname = qIndex >= 0 ? pathAndSearch.slice(0, qIndex) : pathAndSearch;
  const existing = qIndex >= 0 ? pathAndSearch.slice(qIndex + 1) : "";

  const params = new URLSearchParams(existing);
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }

  const search = params.toString();
  redirect(`${pathname}${search ? `?${search}` : ""}${hash}`);
}

export function redirectWithError(path: string, error: unknown, fallback?: string) {
  redirectWithQuery(path, { error: actionErrorMessage(error, fallback) });
}

/**
 * Run form action body; any Error becomes `?error=` on the given path.
 * Next.js redirects are rethrown so success redirects still work.
 */
export async function runFormAction(errorPath: string, work: () => Promise<void>) {
  try {
    await work();
  } catch (error) {
    rethrowIfNextNavigation(error);
    redirectWithError(errorPath, error);
  }
}
