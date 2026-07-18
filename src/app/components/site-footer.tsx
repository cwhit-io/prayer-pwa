import Link from "next/link";

/** Public site identity for FortWaynePrays.org */
export const SITE_NAME = "Fort Wayne Prays";
/** Canonical public hostname (Cloudflare Tunnel). */
export const SITE_DOMAIN = "fortwayneprays.org";
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL || `https://${SITE_DOMAIN}`
).replace(/\/$/, "");
export const ORG_NAME = "Blackhawk Ministries";
export const ORG_ADDRESS = "7400 E State Blvd, Fort Wayne, IN 46815";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-paper/10 bg-night-deep pb-24 pt-10 text-paper md:pb-10">
      <div className="mx-auto max-w-7xl space-y-4 px-5 text-center md:text-left">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row md:items-end">
          <div className="space-y-2">
            <p className="text-lg font-black uppercase tracking-wide text-paper">
              <Link href="/" className="hover:text-yellow">
                {SITE_NAME}
              </Link>
            </p>
            <p className="text-sm text-muted">
              <a
                href={`https://${SITE_DOMAIN}`}
                className="font-black uppercase text-yellow/90 hover:text-yellow"
              >
                {SITE_DOMAIN}
              </a>
            </p>
            <p className="text-sm leading-6 text-muted">
              © {year} {ORG_NAME}
              <br />
              {ORG_ADDRESS}
            </p>
          </div>
          <p className="max-w-sm text-xs leading-5 text-muted/80 md:text-right">
            Your Kingdom come in Fort Wayne as it is in heaven. · Pray Like Crazy
          </p>
        </div>
      </div>
    </footer>
  );
}
