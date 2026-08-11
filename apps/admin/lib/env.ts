import { requireSessionSecret } from "@repo/shared/auth/session";

export function validateAdminEnvironment(): void {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return;
  }

  requireSessionSecret(process.env.ADMIN_SESSION_SECRET, "ADMIN_SESSION_SECRET");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  if (process.env.TRUST_PROXY !== "1") throw new Error("TRUST_PROXY must be 1 in production");

  const origin = process.env.ADMIN_PUBLIC_ORIGIN;
  if (!origin || new URL(origin).protocol !== "https:") {
    throw new Error("ADMIN_PUBLIC_ORIGIN must be an HTTPS origin in production");
  }
}
