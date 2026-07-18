"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; match?: (path: string) => boolean };

const primaryNav: NavItem[] = [
  {
    href: "/admin",
    label: "Overview",
    match: (path) => path === "/admin" || path === "/admin/"
  },
  {
    href: "/admin/campaign",
    label: "Campaign",
    match: (path) => path.startsWith("/admin/campaign")
  },
  {
    href: "/admin/content",
    label: "Content",
    match: (path) =>
      path.startsWith("/admin/content") ||
      path.startsWith("/admin/prompts") ||
      path.startsWith("/admin/acts") ||
      path.startsWith("/admin/categories")
  },
  {
    href: "/admin/community",
    label: "Community",
    match: (path) =>
      path.startsWith("/admin/community") ||
      path.startsWith("/admin/requests") ||
      path.startsWith("/admin/moderation")
  },
  {
    href: "/admin/planning-center",
    label: "People",
    match: (path) => path.startsWith("/admin/planning-center")
  },
  {
    href: "/admin/notifications",
    label: "Messages",
    match: (path) => path.startsWith("/admin/notifications")
  }
];

const contentSecondary: NavItem[] = [
  { href: "/admin/prompts", label: "Campaign prompts" },
  { href: "/admin/acts", label: "ACTS guide" },
  { href: "/admin/categories", label: "Tags" }
];

const communitySecondary: NavItem[] = [
  { href: "/admin/requests", label: "Prayer requests" },
  { href: "/admin/moderation", label: "Board safety" }
];

function linkClass(active: boolean, secondary = false) {
  if (secondary) {
    return active
      ? "rounded-full border border-yellow bg-yellow/15 px-3 py-1.5 text-xs font-black uppercase text-yellow"
      : "rounded-full border border-white/10 px-3 py-1.5 text-xs font-black uppercase text-white/65 transition hover:border-yellow/50 hover:text-yellow";
  }
  return active
    ? "rounded-full border border-yellow bg-yellow px-3 py-1.5 text-xs font-black uppercase text-black"
    : "rounded-full border border-white/15 px-3 py-1.5 text-xs font-black uppercase text-white/80 transition hover:border-yellow hover:text-yellow";
}

export function AdminNav() {
  const pathname = usePathname() || "/admin";

  const showContent = primaryNav
    .find((item) => item.label === "Content")
    ?.match?.(pathname);
  const showCommunity = primaryNav
    .find((item) => item.label === "Community")
    ?.match?.(pathname);

  const secondary = showContent
    ? contentSecondary
    : showCommunity
      ? communitySecondary
      : null;

  return (
    <div className="border-b border-white/10 bg-zinc-950/90">
      <div className="mx-auto max-w-7xl space-y-2 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-xs font-black uppercase tracking-[0.2em] text-yellow">Admin</span>
          {primaryNav.map((link) => {
            const active = link.match ? link.match(pathname) : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} className={linkClass(active)}>
                {link.label}
              </Link>
            );
          })}
        </div>
        {secondary ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-2">
            <span className="mr-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
              {showContent ? "Content" : "Community"}
            </span>
            {secondary.map((link) => {
              const active =
                pathname === link.href ||
                pathname.startsWith(`${link.href}/`) ||
                (link.href === "/admin/prompts" && pathname.startsWith("/admin/prompts"));
              return (
                <Link key={link.href} href={link.href} className={linkClass(active, true)}>
                  {link.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
