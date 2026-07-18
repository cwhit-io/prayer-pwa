/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow Cloudflare Tunnel / public host during dev (HMR + assets).
  allowedDevOrigins: [
    "10.10.96.138",
    "localhost",
    "127.0.0.1",
    "fortwayneprays.org",
    "www.fortwayneprays.org",
    "FortWaynePrays.org"
  ],
  // Server actions & CSRF origin checks behind Cloudflare Tunnel.
  experimental: {
    serverActions: {
      allowedOrigins: [
        "fortwayneprays.org",
        "www.fortwayneprays.org",
        "FortWaynePrays.org",
        "localhost:3000",
        "10.10.96.138:3000"
      ]
    }
  }
};

export default nextConfig;
