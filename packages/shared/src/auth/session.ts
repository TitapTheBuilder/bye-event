import { SignJWT, jwtVerify } from "jose";

export type SessionRole = "exhibitor" | "admin";

export interface SessionPayload {
  /** User id (exhibitor.id or admin.id) -- never anything else. */
  sub: string;
  role: SessionRole;
  sessionVersion: number;
}

export interface VerifiedSession {
  sub: string;
  role: SessionRole;
  sessionVersion: number;
  issuedAt: Date;
  expiresAt: Date;
}

const SESSION_REALMS = {
  admin: {
    issuer: "bye2-admin",
    audience: "bye2-admin-session",
  },
  exhibitor: {
    issuer: "bye2-exhibitor",
    audience: "bye2-exhibitor-session",
  },
} as const;

const DEVELOPMENT_SECRET_MARKERS = [
  "dev-secret",
  "test-secret",
  "change-me",
  "placeholder",
  "example-secret",
] as const;

export function requireSessionSecret(
  secret: string | undefined,
  variableName: string,
  environment = process.env.NODE_ENV,
): string {
  if (!secret) {
    throw new Error(`${variableName} is not set`);
  }

  if (environment === "production") {
    if (secret.length < 32) {
      throw new Error(`${variableName} must be at least 32 characters in production`);
    }

    const normalized = secret.toLowerCase();
    if (DEVELOPMENT_SECRET_MARKERS.some((marker) => normalized.includes(marker))) {
      throw new Error(`${variableName} must not use a development value in production`);
    }
  }

  return secret;
}

function getSecretKey(secret: string) {
  return new TextEncoder().encode(requireSessionSecret(secret, "session secret"));
}

function isSessionVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
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
  if (!isSessionVersion(payload.sessionVersion)) {
    throw new Error("sessionVersion must be a non-negative safe integer");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const realm = SESSION_REALMS[payload.role];
  return new SignJWT({ role: payload.role, sessionVersion: payload.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(realm.issuer)
    .setAudience(realm.audience)
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
    const realm = SESSION_REALMS[expectedRole];
    const { payload } = await jwtVerify(token, getSecretKey(secret), {
      algorithms: ["HS256"],
      issuer: realm.issuer,
      audience: realm.audience,
    });
    if (
      payload.role !== expectedRole ||
      typeof payload.sub !== "string" ||
      payload.sub.length === 0 ||
      !isSessionVersion(payload.sessionVersion) ||
      typeof payload.iat !== "number" ||
      !Number.isSafeInteger(payload.iat) ||
      typeof payload.exp !== "number" ||
      !Number.isSafeInteger(payload.exp)
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      role: expectedRole,
      sessionVersion: payload.sessionVersion,
      issuedAt: new Date(payload.iat * 1000),
      expiresAt: new Date(payload.exp * 1000),
    };
  } catch {
    // Expired, malformed, or signature mismatch -- never throw, never log
    // the token itself (including in crash reports).
    return null;
  }
}
