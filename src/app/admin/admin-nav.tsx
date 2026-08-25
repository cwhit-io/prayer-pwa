"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasCapability } from "@/lib/permissions";

type NavItem = { href: string; label: string; match?: (path: string) => boolean };

const primaryNav: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    match: (path) => path === "/admin" || path === "/admin/"
  },
  {
    href: "/admin/content",
    label: "Prayer content",
    match: (path) =>
      path.startsWith("/admin/content") ||
      path.startsWith("/admin/prompts") ||
      path.startsWith("/admin/acts") ||
      path.startsWith("/admin/categories")
  },
  {
    href: "/admin/requests",
    label: "Prayer requests",
    match: (path) =>
      path.startsWith("/admin/requests") ||
      path.startsWith("/admin/community") ||
      path.startsWith("/admin/moderation")
  },
  {
    href: "/admin/planning-center",
    label: "People & accounts",
    match: (path) => path.startsWith("/admin/planning-center")
  },
  {
    href: "/admin/campaign",
    label: "Settings",
    match: (path) => path.startsWith("/admin/campaign")
  },
  {
    href: "/admin/notifications",
    label: "Notifications",
    match: (path) => path.startsWith("/admin/notifications")
  }
];

const contentSecondary: NavItem[] = [
  { href: "/admin/prompts", label: "Prayer prompts" },
  { href: "/admin/acts", label: "ACTS guide" },
  { href: "/admin/categories", label: "Topics" }
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

export function AdminNav({ role = "admin" }: { role?: string }) {
  const pathname = usePathname() || "/admin";
  const visibleNav = primaryNav.filter((item) => {
    if (item.label === "Prayer requests") return hasCapability(role, "community-requests:moderate");
    if (item.label === "Settings") return hasCapability(role, "campaign-settings:manage");
    if (item.label === "Notifications") return hasCapability(role, "notifications:manage");
    return true;
  });

  const showContent = visibleNav
    .find((item) => item.label === "Prayer content")
    ?.match?.(pathname);
  const secondary = showContent ? contentSecondary : null;

  return (
    <div className="admin-nav-shell border-b">
      <div className="mx-auto max-w-7xl space-y-3 px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-2">
            <span className="block text-xs font-black uppercase tracking-[0.2em] text-yellow">Staff tools</span>
            <span className="block text-xs text-white/55">Manage the prayer campaign</span>
          </div>
          <Link href="/" className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-black uppercase text-white/70 transition hover:border-yellow hover:text-yellow">
            View public site
          </Link>
          {visibleNav.map((link) => {
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
            <span className="mr-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/50">
              Prayer content tools
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
