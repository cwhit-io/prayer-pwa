/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Isolated production builds use NEXT_DIST_DIR=.next-build so a live
  // `.next/standalone` server is not overwritten mid-compile.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Allow Cloudflare Tunnel / public host during dev (HMR + assets).
  allowedDevOrigins: [
    "10.10.96.138",
    "localhost",
    "127.0.0.1",
    "fortwayneprays.org",
    "www.fortwayneprays.org",
    "FortWaynePrays.org",
    "prayfw.org",
    "www.prayfw.org",
    "PrayFW.org",
    "fortwaynepraise.org",
    "www.fortwaynepraise.org",
    "FortWaynePraise.org"
  ],
  // Server actions & CSRF origin checks behind Cloudflare Tunnel.
  experimental: {
    serverActions: {
      allowedOrigins: [
        "fortwayneprays.org",
        "www.fortwayneprays.org",
        "FortWaynePrays.org",
        "prayfw.org",
        "www.prayfw.org",
        "PrayFW.org",
        "fortwaynepraise.org",
        "www.fortwaynepraise.org",
        "FortWaynePraise.org",
        "localhost:3000",
        "10.10.96.138:3000"
      ]
    }
  }
};

export default nextConfig;
