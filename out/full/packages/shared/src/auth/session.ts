import { SignJWT, jwtVerify } from "jose";

export type SessionRole = "exhibitor" | "admin";

export interface SessionPayload {
  /** User id (exhibitor.id or admin.id) -- never anything else. */
  sub: string;
  role: SessionRole;
}

export interface VerifiedSession {
  sub: string;
  role: SessionRole;
  issuedAt: Date;
  expiresAt: Date;
}

function getSecretKey(secret: string) {
  return new TextEncoder().encode(secret);
}

/**
 * Minimal JWT payload: id, role, issued/expiry. No PII (name, email, phone)
 * ever goes in the token -- session cookies are for identity + authz, not
 * as a cache for profile data.
 */
export async function createSessionToken(
  payload: SessionPayload,
  secret: string,
  ttlSeconds: number,
): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + ttlSeconds)
    .sign(getSecretKey(secret));
}

/**
 * Verifies signature, expiry, AND that the token's role matches the realm
 * calling this (exhibitor vs admin) -- a valid admin token must never be
 * accepted by exhibitor-side verification or vice versa.
 */
export async function verifySessionToken(
  token: string,
  secret: string,
  expectedRole: SessionRole,
): Promise<VerifiedSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(secret), {
      algorithms: ["HS256"],
    });
    if (payload.role !== expectedRole || typeof payload.sub !== "string") {
      return null;
    }
    return {
      sub: payload.sub,
      role: expectedRole,
      issuedAt: new Date((payload.iat ?? 0) * 1000),
      expiresAt: new Date((payload.exp ?? 0) * 1000),
    };
  } catch {
    // Expired, malformed, or signature mismatch -- never throw, never log
    // the token itself (including in crash reports).
    return null;
  }
}
