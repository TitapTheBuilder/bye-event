import {
  bumpAdminSessionVersion,
  db,
  getAdminSessionState,
} from "@repo/db";
import {
  createSessionToken,
  requireSessionSecret,
  verifySessionToken,
} from "@repo/shared/auth/session";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_SECONDS } from "@repo/shared/constants";
import { cookies } from "next/headers";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

function getSessionSecret(): string {
  return requireSessionSecret(process.env.ADMIN_SESSION_SECRET, "ADMIN_SESSION_SECRET");
}

export interface AdminSession {
  adminId: string;
}

/**
 * Admin and exhibitor auth are fully separate realms: different table
 * (`admins` vs `exhibitors`), different cookie name (ADMIN_SESSION_COOKIE),
 * different TTL (12h here vs 24h for exhibitors, given the higher blast
 * radius of an admin account), and verifySessionToken is called with
 * role "admin" so an exhibitor token can never be accepted here or vice
 * versa.
 */
export async function createAdminSession(
  adminId: string,
  sessionVersion: number,
): Promise<void> {
  const token = await createSessionToken(
    { sub: adminId, role: "admin", sessionVersion },
    getSessionSecret(),
    ADMIN_SESSION_TTL_SECONDS,
  );
  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
}

export async function clearAdminSession(): Promise<void> {
  const session = await getAdminSession();
  if (session) {
    await bumpAdminSessionVersion(db, session.adminId);
  }

  const store = await cookies();
  store.delete(ADMIN_SESSION_COOKIE);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;

  const verified = await verifySessionToken(token, getSessionSecret(), "admin");
  if (!verified) return null;

  const state = await getAdminSessionState(db, verified.sub);
  if (!state || state.sessionVersion !== verified.sessionVersion) return null;

  return { adminId: verified.sub };
}

/**
 * The one call every Server Action / Route Handler in this app that
 * touches real data must make for itself -- proxy.ts redirecting an
 * unauthenticated admin away from the dashboard is a UX nicety only, never
 * the sole gate (see CVE-2025-29927, a Next.js middleware-bypass header).
 */
export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new UnauthorizedError();
  return session;
}
