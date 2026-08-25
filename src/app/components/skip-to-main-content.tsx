"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function SkipToMainContent() {
  const pathname = usePathname();

  useEffect(() => {
    const main = document.querySelector("main");
    if (main) {
      main.id = "main-content";
      main.tabIndex = -1;
    }
  }, [pathname]);

  return (
    <a href="#main-content" className="skip-to-main-content">
      Skip to main content
    </a>
  );
}
