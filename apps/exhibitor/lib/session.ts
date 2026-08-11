import {
  bumpExhibitorSessionVersion,
  db,
  getExhibitorSessionState,
} from "@repo/db";
import {
  createSessionToken,
  requireSessionSecret,
  verifySessionToken,
} from "@repo/shared/auth/session";
import { EXHIBITOR_SESSION_COOKIE, EXHIBITOR_SESSION_TTL_SECONDS } from "@repo/shared/constants";
import { cookies } from "next/headers";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

function getSessionSecret(): string {
  return requireSessionSecret(process.env.EXHIBITOR_SESSION_SECRET, "EXHIBITOR_SESSION_SECRET");
}

export interface ExhibitorSession {
  exhibitorId: string;
}

/** Sets the HttpOnly + Secure + SameSite=Lax session cookie after a successful login/signup. */
export async function createExhibitorSession(
  exhibitorId: string,
  sessionVersion: number,
): Promise<void> {
  const token = await createSessionToken(
    { sub: exhibitorId, role: "exhibitor", sessionVersion },
    getSessionSecret(),
    EXHIBITOR_SESSION_TTL_SECONDS,
  );
  const store = await cookies();
  store.set(EXHIBITOR_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: EXHIBITOR_SESSION_TTL_SECONDS,
  });
}

export async function clearExhibitorSession(): Promise<void> {
  const session = await getExhibitorSession();
  if (session) {
    await bumpExhibitorSessionVersion(db, session.exhibitorId);
  }

  const store = await cookies();
  store.delete(EXHIBITOR_SESSION_COOKIE);
}

/** Returns the current session, or null. Never throws. */
export async function getExhibitorSession(): Promise<ExhibitorSession | null> {
  const store = await cookies();
  const token = store.get(EXHIBITOR_SESSION_COOKIE)?.value;
  if (!token) return null;

  const verified = await verifySessionToken(token, getSessionSecret(), "exhibitor");
  if (!verified) return null;

  const state = await getExhibitorSessionState(db, verified.sub);
  if (
    !state ||
    state.deactivatedAt !== null ||
    state.sessionVersion !== verified.sessionVersion
  ) {
    return null;
  }

  return { exhibitorId: verified.sub };
}

/**
 * The one call every Server Action / Route Handler in this app that
 * touches real exhibitor data must make for itself. proxy.ts redirecting
 * an unauthenticated user is a UX nicety only -- it is never the sole
 * gate (see CVE-2025-29927, a Next.js middleware-bypass header). Throws
 * UnauthorizedError, which route handlers should catch and turn into a
 * 401 JSON response.
 */
export async function requireExhibitorSession(): Promise<ExhibitorSession> {
  const session = await getExhibitorSession();
  if (!session) throw new UnauthorizedError();
  return session;
}
