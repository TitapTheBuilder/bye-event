import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Both apps import schema/helpers/zod-schemas straight from TS source in
  // these workspace packages -- never duplicated, never pre-built.
  transpilePackages: ["@repo/db", "@repo/shared"],
};

// Next.js 16 defaults to Turbopack, so we use @serwist/turbopack (Serwist's
// Turbopack-native integration) rather than @serwist/next, which injects a
// webpack config that Turbopack builds reject outright.
export default withSerwist(nextConfig);
