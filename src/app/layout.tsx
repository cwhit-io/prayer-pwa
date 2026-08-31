import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { ClearStoredLoginChallenge } from "@/app/auth/login-challenge-state";
import { AuthSessionRefresh } from "@/app/components/auth-session-refresh";
import { Roboto, Roboto_Condensed } from "next/font/google";
import { ChunkLoadRecovery } from "@/app/components/chunk-load-recovery";
import { PrayerActivityToast } from "@/app/components/prayer-activity-toast";
import { ParticipantNavigation } from "@/app/components/participant-navigation";
import { ScrollToTop } from "@/app/components/scroll-to-top";
import { SkipToMainContent } from "@/app/components/skip-to-main-content";
import { SITE_DOMAIN, SITE_NAME, SITE_URL, SiteFooter } from "@/app/components/site-footer";
import { WeeklyPaceRing } from "@/app/components/weekly-pace-ring";
import { getCurrentUser, hasCapability } from "@/lib/auth";
import { getHeaderWeeklyPace } from "@/lib/campaign";
import { getPendingBoardReviewCount } from "@/lib/prayer-requests";
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
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico?v=2" },
      { url: "/favicon-16x16.png?v=2", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg?v=2", type: "image/svg+xml" }
    ],
    apple: [{ url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" }]
  }
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
  const [staffReviewCount, weeklyPace] = await Promise.all([
    hasCapability(user?.role, "community-requests:moderate")
      ? getPendingBoardReviewCount()
      : Promise.resolve(0),
    user ? getHeaderWeeklyPace(user.id) : Promise.resolve(null)
  ]);

  return (
    <html lang="en" className={`${robotoCondensed.variable} ${robotoReading.variable}`}>
      <body>
        <SkipToMainContent />
        <ChunkLoadRecovery />
        <AuthSessionRefresh enabled={Boolean(user)} />
        {user ? <ClearStoredLoginChallenge /> : null}
        <Suspense fallback={null}>
          <ScrollToTop />
        </Suspense>
        <PrayerActivityToast />
        <div className="plc-chrome sticky top-0 z-50 border-b backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/" className="flex shrink-0 items-center" aria-label="Pray Like Crazy home">
                <Image src="/header-logo@web.png" alt="Pray Like Crazy" width={800} height={226} priority className="h-10 w-auto object-contain sm:h-12" />
              </Link>
              {weeklyPace ? <WeeklyPaceRing {...weeklyPace} /> : null}
            </div>
            <ParticipantNavigation
              isSignedIn={Boolean(user)}
              role={user?.role}
              staffReviewCount={staffReviewCount}
              variant="header"
            />
          </div>
        </div>
        {children}
        <SiteFooter />
        <ParticipantNavigation
          isSignedIn={Boolean(user)}
          role={user?.role}
          staffReviewCount={staffReviewCount}
          variant="mobile"
        />
      </body>
    </html>
  );
}
