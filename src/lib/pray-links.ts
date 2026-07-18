export type SessionFocus = {
  kind: "request" | "prompt";
  id: string;
  title: string;
  body: string;
  category?: string | null;
  /** Shared prompt tags when focus is a campaign prompt (or free-form names). */
  tags?: string[] | null;
  scriptureReference?: string | null;
  scriptureText?: string | null;
  scriptureHref?: string | null;
};

export function prayerCountLabel(count: number) {
  if (count <= 0) {
    return "Needs prayer";
  }
  if (count === 1) {
    return "Prayed for 1 time";
  }
  return `Prayed for ${count} times`;
}

export function prayHref(focus: Pick<SessionFocus, "kind" | "id">) {
  const key = focus.kind === "request" ? "request" : "prompt";
  return `/log?${key}=${encodeURIComponent(focus.id)}`;
}
