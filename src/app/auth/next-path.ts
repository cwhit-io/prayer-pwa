const AUTH_ORIGIN = "https://prayer-app.local";

/** Accept only an app-relative path, never an absolute or protocol-relative URL. */
export function getSafeAuthNextPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  try {
    const url = new URL(value, AUTH_ORIGIN);
    if (url.origin !== AUTH_ORIGIN) {
      return null;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function authHref(next: string | null, query: Record<string, string> = {}) {
  const params = new URLSearchParams(query);
  if (next) {
    params.set("next", next);
  }
  const search = params.toString();
  return `/auth${search ? `?${search}` : ""}`;
}
