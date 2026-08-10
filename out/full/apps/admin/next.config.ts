import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Both apps import schema/helpers/zod-schemas straight from TS source in
  // these workspace packages -- never duplicated, never pre-built.
  transpilePackages: ["@repo/db", "@repo/shared"],
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
