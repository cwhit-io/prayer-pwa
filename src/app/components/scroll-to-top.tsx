"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

function jumpToTop() {
  const html = document.documentElement;
  const previous = html.style.scrollBehavior;
  html.style.scrollBehavior = "auto";
  const active = document.activeElement;
  if (active instanceof HTMLElement && !active.closest("main")) {
    active.blur();
  }
  window.scrollTo(0, 0);
  html.scrollTop = 0;
  document.body.scrollTop = 0;
  html.style.scrollBehavior = previous;
}

/**
 * Soft client navigations can leave the window at the footer or keep a
 * bottom-nav control focused, which then scrolls into view. Reset to top.
 */
export function ScrollToTop() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    if (window.location.hash) {
      return;
    }

    jumpToTop();
    const frame = window.requestAnimationFrame(jumpToTop);
    const timeout = window.setTimeout(jumpToTop, 50);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [pathname, search]);

  return null;
}
