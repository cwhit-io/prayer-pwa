import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { Roboto, Roboto_Condensed } from "next/font/google";
import { ChunkLoadRecovery } from "@/app/components/chunk-load-recovery";
import { HomeIcon, PersonIcon, PromptIcon } from "@/app/components/icons";
import { ScrollToTop } from "@/app/components/scroll-to-top";
import { SITE_DOMAIN, SITE_NAME, SITE_URL, SiteFooter } from "@/app/components/site-footer";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

/** Condensed campaign / UI face */
const robotoCondensed = Roboto_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-body"
});

/** Regular-width face for longer prayer prompts and Scripture */
const robotoReading = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-reading"
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | Pray Like Crazy`,
    template: `%s | ${SITE_NAME}`
  },
  description:
    "Fort Wayne Prays — Blackhawk Ministries prayer campaign. Pledge, log prayer minutes, and seek God’s Kingdom in Fort Wayne.",
  applicationName: SITE_NAME,
  openGraph: {
    title: `${SITE_NAME} | Pray Like Crazy`,
    description: "One million minutes of prayer for Fort Wayne. Your Kingdom come.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website"
  },
  alternates: {
    canonical: SITE_URL
  },
  other: {
    "site-domain": SITE_DOMAIN
  },
  manifest: "/manifest.webmanifest"
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const
};

export default async function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html lang="en" className={`${robotoCondensed.variable} ${robotoReading.variable}`}>
      <body>
        <ChunkLoadRecovery />
        <Suspense fallback={null}>
          <ScrollToTop />
        </Suspense>
        <div className="plc-chrome sticky top-0 z-50 border-b backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
            <Link href="/" className="brand-logo text-2xl font-black uppercase text-paper">
              Pray <span>Like</span> Crazy
            </Link>
            <nav className="hidden items-center gap-6 text-sm font-black uppercase text-muted md:flex">
              {user ? (
                <Link href="/prompts" className="nav-link">
                  Prompts
                </Link>
              ) : null}
              {user ? (
                <Link href="/requests" className="nav-link">
                  Requests
                </Link>
              ) : null}
              <Link href="/log" className="pray-nav-btn" aria-label="PRAY">
                PRAY
              </Link>
              <Link
                href="/auth"
                className="grid h-10 w-10 place-items-center rounded-full border border-paper/40 text-paper"
                aria-label="Your profile and dashboard"
              >
                <span className="sr-only">Profile</span>
                <PersonIcon className="h-6 w-6" />
              </Link>
            </nav>
          </div>
        </div>
        {children}
        <SiteFooter />
        <nav className="plc-chrome fixed inset-x-0 bottom-0 z-50 border-t px-2 py-2 text-paper md:hidden">
          <div
            className={`mx-auto grid max-w-lg items-center text-center text-xs ${
              user ? "grid-cols-5" : "grid-cols-3"
            }`}
          >
            <Link href="/" className="bottom-nav-link text-yellow">
              <HomeIcon className="h-7 w-7" />
              <span>Home</span>
            </Link>
            {user ? (
              <Link href="/prompts" className="bottom-nav-link">
                <PromptIcon className="h-7 w-7" />
                <span>Prompts</span>
              </Link>
            ) : null}
            <Link href="/log" className="pray-nav-btn pray-nav-btn-mobile" aria-label="PRAY">
              PRAY
            </Link>
            {user ? (
              <Link href="/requests" className="bottom-nav-link">
                <span className="grid h-7 w-7 place-items-center text-lg font-black leading-none">+</span>
                <span>Requests</span>
              </Link>
            ) : null}
            <Link href="/auth" className="bottom-nav-link" aria-label="Your profile and dashboard">
              <PersonIcon className="h-7 w-7" />
              <span>Me</span>
            </Link>
          </div>
        </nav>
      </body>
    </html>
  );
}
