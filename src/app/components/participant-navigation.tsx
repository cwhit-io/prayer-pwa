"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { HomeIcon, PersonIcon, PromptIcon, RequestIcon } from "@/app/components/icons";
import { hasCapability } from "@/lib/permissions";

type ParticipantNavigationProps = {
  isSignedIn: boolean;
  role?: string;
  staffReviewCount: number;
  variant: "header" | "mobile";
};

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function useSignInHref() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (pathname === "/auth" && searchParams.get("challenge")) {
    const search = searchParams.toString();
    return search ? `/auth?${search}` : "/auth";
  }
  return "/auth";
}

function SignInNavLink({
  className,
  children
}: {
  className: string;
  children: ReactNode;
}) {
  const href = useSignInHref();
  const pathname = usePathname();
  return (
    <Link href={href} className={className} aria-current={pathname === "/auth" ? "page" : undefined}>
      {children}
    </Link>
  );
}

export function ParticipantNavigation({
  isSignedIn,
  role,
  staffReviewCount,
  variant
}: ParticipantNavigationProps) {
  const pathname = usePathname();
  const isStaff = hasCapability(role, "staff:access");
  const canModerate = hasCapability(role, "community-requests:moderate");
  const staffLabel = role === "superadmin" ? "Superadmin" : role === "admin" ? "Admin" : "Staff tools";
  const current = (href: string) => isActivePath(pathname, href) ? "page" as const : undefined;
  const prayCurrent = pathname === "/log" || pathname === "/guided-prayer" || pathname.startsWith("/guided-prayer/") || pathname.startsWith("/prompts/") || pathname === "/prompts" || pathname.startsWith("/people/") || pathname === "/people"
    ? "page" as const
    : undefined;

  if (variant === "mobile") {
    return (
      <nav aria-label="Mobile navigation" className="plc-chrome fixed inset-x-0 bottom-0 z-50 border-t px-2 py-2 text-paper md:hidden">
        <div className={`mx-auto grid max-w-lg items-center text-center text-xs ${isSignedIn ? "grid-cols-5" : "grid-cols-3"}`}>
          <Link href="/" className="bottom-nav-link min-w-0" aria-current={current("/")}>
            <HomeIcon className="h-7 w-7" />
            <span>Home</span>
          </Link>
          {isSignedIn ? (
            <Link href="/requests" className="bottom-nav-link min-w-0" aria-current={current("/requests")}>
              <RequestIcon className="h-7 w-7" />
              <span>Requests</span>
            </Link>
          ) : null}
          <Link
            href="/log"
            className="pray-nav-btn pray-nav-btn-mobile"
            aria-label="Start a prayer timer"
            aria-current={prayCurrent}
          >
            <span className="pray-wordmark" aria-hidden="true" />
            <span className="sr-only">Pray</span>
          </Link>
          {isSignedIn ? (
            <Link href="/add-time" className="bottom-nav-link min-w-0" aria-current={current("/add-time")}>
              <PromptIcon className="h-7 w-7" />
              <span>Prayer Log</span>
            </Link>
          ) : null}
          {isSignedIn ? (
            <Link href="/auth" className="bottom-nav-link min-w-0" aria-current={current("/auth")}>
              <PersonIcon className="h-7 w-7" />
              <span>Me</span>
            </Link>
          ) : (
            <Suspense fallback={
              <Link href="/auth" className="bottom-nav-link min-w-0" aria-current={current("/auth")}>
                <PersonIcon className="h-7 w-7" />
                <span>Sign in</span>
              </Link>
            }>
              <SignInNavLink className="bottom-nav-link min-w-0">
                <PersonIcon className="h-7 w-7" />
                <span>Sign in</span>
              </SignInNavLink>
            </Suspense>
          )}
        </div>
      </nav>
    );
  }

  return (
    <>
      {isStaff ? (
        <div className="flex items-center gap-2 md:hidden">
          <Link
            href="/admin"
            className="mobile-utility-link rounded-full border border-yellow/60 px-3 py-2 text-xs font-black uppercase text-yellow"
            aria-current={pathname === "/admin" ? "page" : undefined}
          >
            {staffLabel}
          </Link>
          {canModerate ? <Link
            href="/admin/requests"
            className="mobile-utility-link relative grid h-11 w-11 place-items-center rounded-full border border-paper/30 text-paper"
            aria-label={`Prayer requests needing review${staffReviewCount > 0 ? `: ${staffReviewCount}` : ""}`}
            aria-current={current("/admin/requests")}
          >
            <span className="text-lg leading-none" aria-hidden="true">&#128276;</span>
            {staffReviewCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-yellow px-1 text-[10px] font-black text-black">
                {staffReviewCount > 99 ? "99+" : staffReviewCount}
              </span>
            ) : null}
          </Link> : null}
        </div>
      ) : null}

      <nav aria-label="Primary navigation" className="hidden items-center gap-6 text-sm font-black uppercase text-muted md:flex">
        {isSignedIn ? (
          <Link href="/requests" className="nav-link" aria-current={current("/requests")}>
            Requests
          </Link>
        ) : null}
        {isSignedIn ? (
          <Link href="/add-time" className="nav-link" aria-current={current("/add-time")}>
            Prayer log
          </Link>
        ) : null}
        {isStaff ? (
          <Link href="/admin" className="nav-link" aria-current={current("/admin")}>
            {staffLabel}
          </Link>
        ) : null}
        <Link
          href="/log"
          className="pray-nav-btn"
          aria-label="Start a prayer timer"
          aria-current={current("/log")}
        >
          Start praying
        </Link>
        {isSignedIn ? (
          <Link
            href="/auth"
            className="account-nav-link grid h-11 w-11 place-items-center rounded-full border border-paper/40 text-paper transition hover:border-yellow hover:text-yellow"
            aria-label="My profile"
            aria-current={current("/auth")}
          >
            <PersonIcon className="h-6 w-6" />
          </Link>
        ) : (
          <Suspense fallback={
            <Link
              href="/auth"
              className="account-nav-link flex min-h-11 items-center gap-2 rounded-full border border-paper/40 px-4 text-paper transition hover:border-yellow hover:text-yellow"
              aria-current={current("/auth")}
            >
              <PersonIcon className="h-5 w-5" />
              <span>Sign in</span>
            </Link>
          }>
            <SignInNavLink className="account-nav-link flex min-h-11 items-center gap-2 rounded-full border border-paper/40 px-4 text-paper transition hover:border-yellow hover:text-yellow">
              <PersonIcon className="h-5 w-5" />
              <span>Sign in</span>
            </SignInNavLink>
          </Suspense>
        )}
      </nav>

    </>
  );
}
