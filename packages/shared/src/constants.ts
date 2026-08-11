/** The one thing that's fixed across every white-label deployment. */
export const PLATFORM_CREDIT = "University of Tehran" as const;

export const EXHIBITOR_SESSION_COOKIE = "exhibitor_session" as const;
export const ADMIN_SESSION_COOKIE = "admin_session" as const;

export const EXHIBITOR_SESSION_TTL_SECONDS = 24 * 60 * 60; // 24h
export const ADMIN_SESSION_TTL_SECONDS = 12 * 60 * 60; // 12h — higher blast radius

export const ADMIN_LOGIN_RATE_LIMIT = {
  windowMs: 15 * 60_000,
  maxRequests: 8,
} as const;

export const EXHIBITOR_LOGIN_RATE_LIMIT = {
  windowMs: 15 * 60_000,
  maxRequests: 10,
} as const;

export const EXHIBITOR_SIGNUP_RATE_LIMIT = {
  windowMs: 60 * 60_000,
  maxRequests: 5,
} as const;

/** Per IP+device rate limit for the public, unauthenticated visitor lookup. */
export const VISITOR_LOOKUP_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 30,
} as const;

export const QR_TOKEN_LENGTH = 32;

export const VISITOR_TYPES = ["invited", "guest"] as const;
export type VisitorType = (typeof VISITOR_TYPES)[number];
