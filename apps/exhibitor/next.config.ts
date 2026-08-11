import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "0" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Both apps import schema/helpers/zod-schemas straight from TS source in
  // these workspace packages -- never duplicated, never pre-built.
  transpilePackages: ["@repo/db", "@repo/shared"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

// Next.js 16 defaults to Turbopack, so we use @serwist/turbopack (Serwist's
// Turbopack-native integration) rather than @serwist/next, which injects a
// webpack config that Turbopack builds reject outright.
export default withSerwist(nextConfig);
