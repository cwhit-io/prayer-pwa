"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { signOutAction } from "@/app/auth/actions";
import { ClockIcon, HomeIcon, PersonIcon, RequestIcon } from "@/app/components/icons";
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

function AccountMenu({
  variant,
  children,
  trigger
}: {
  variant: "header" | "mobile";
  children: ReactNode;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const menuId = useId();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const popoverClass =
    variant === "mobile"
      ? "account-menu-popover account-menu-popover-mobile"
      : "account-menu-popover account-menu-popover-desktop";

  return (
    <div ref={rootRef} className={variant === "mobile" ? "mobile-profile-menu relative min-w-0" : "profile-menu relative"}>
      <button
        type="button"
        className={
          variant === "mobile"
            ? "bottom-nav-link w-full cursor-pointer"
            : "grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-paper/40 text-paper transition hover:border-yellow hover:text-yellow"
        }
        aria-label="Open account options"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>
      {open ? (
        <div id={menuId} role="menu" className={popoverClass}>
          {children}
        </div>
      ) : null}
    </div>
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
              <ClockIcon className="h-7 w-7" />
              <span>Add Time</span>
            </Link>
          ) : null}
          {isSignedIn ? (
            <AccountMenu
              variant="mobile"
              trigger={(
                <>
                  <PersonIcon className="h-7 w-7" />
                  <span>Me</span>
                </>
              )}
            >
              <Link href="/auth" className="profile-menu-link" role="menuitem" aria-current={current("/auth")}>My profile</Link>
              {isStaff ? (
                <Link href="/admin" className="profile-menu-link" role="menuitem" aria-current={current("/admin")}>
                  {staffLabel}
                </Link>
              ) : null}
              <form action={signOutAction}>
                <button type="submit" className="profile-menu-link w-full text-left" role="menuitem">Sign out</button>
              </form>
            </AccountMenu>
          ) : (
            <Link href="/auth" className="bottom-nav-link min-w-0" aria-current={current("/auth")}>
              <PersonIcon className="h-7 w-7" />
              <span>Sign in</span>
            </Link>
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
            Add time
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
          <AccountMenu
            variant="header"
            trigger={(
              <>
                <span className="sr-only">Profile options</span>
                <PersonIcon className="h-6 w-6" />
              </>
            )}
          >
            <Link href="/auth" className="profile-menu-link" role="menuitem" aria-current={current("/auth")}>My profile</Link>
            <form action={signOutAction}>
              <button type="submit" className="profile-menu-link w-full text-left" role="menuitem">Sign out</button>
            </form>
          </AccountMenu>
        ) : (
          <Link
            href="/auth"
            className="account-nav-link flex min-h-11 items-center gap-2 rounded-full border border-paper/40 px-4 text-paper transition hover:border-yellow hover:text-yellow"
            aria-current={current("/auth")}
          >
            <PersonIcon className="h-5 w-5" />
            <span>Sign in</span>
          </Link>
        )}
      </nav>

    </>
  );
}
