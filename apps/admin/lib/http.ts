import { NextResponse } from "next/server";

/**
 * Any custom Route Handler that mutates state must check the Origin header
 * itself -- Server Actions get Next's built-in Origin verification for
 * free, but hand-rolled Route Handlers (like every mutating route in this
 * app) do not.
 */
function configuredOrigin(request: Request): string | null {
  const value = process.env.ADMIN_PUBLIC_ORIGIN;
  if (!value) return process.env.NODE_ENV === "production" ? null : new URL(request.url).origin;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const expected = configuredOrigin(request);
    if (expected !== null && originUrl.origin === expected) {
      return true;
    }

    if (process.env.NODE_ENV !== "production") {
      const requestUrl = new URL(request.url);
      if (originUrl.origin === requestUrl.origin) {
        return true;
      }
      const isLoopback = (host: string) =>
        host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
      if (
        isLoopback(originUrl.hostname) &&
        isLoopback(requestUrl.hostname) &&
        originUrl.port === requestUrl.port
      ) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

export function getClientIp(request: Request): string {
  if (process.env.TRUST_PROXY !== "1") return "direct";
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

export function forbiddenOrigin(): NextResponse {
  return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
}

export function unauthorized(message = "Unauthorized"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}
