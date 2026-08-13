import { existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";

// Only run for CLI scripts (migrate, seed, etc.), never inside Next.js build bundling
if (typeof window === "undefined" && !process.env.NEXT_PHASE) {
  const cwdEnv = resolve(process.cwd(), ".env");
  const rootEnv = resolve(process.cwd(), "../../.env");
  const pkgEnv = resolve(process.cwd(), "packages/db/.env");

  for (const envPath of [cwdEnv, rootEnv, pkgEnv]) {
    if (existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false });
    }
  }
}
