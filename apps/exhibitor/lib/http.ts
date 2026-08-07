import { NextResponse } from "next/server";

/**
 * Any custom Route Handler that mutates state must check the Origin header
 * itself -- Server Actions get Next's built-in Origin verification for
 * free, but hand-rolled Route Handlers (like ours here) do not.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  // Some same-site requests omit Origin, but we only call this from
  // state-mutating handlers, so a missing header is treated as untrusted
  // rather than silently allowed.
  if (!origin) return false;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    return originUrl.host === requestUrl.host;
  } catch {
    return false;
  }
}

export function forbiddenOrigin(): NextResponse {
  return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
}

export function unauthorized(message = "Unauthorized"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Best-effort client identifier for rate limiting the public visitor
 * lookup endpoint. Trusts X-Forwarded-For only because this app is
 * deployed behind a reverse proxy (Nginx/Caddy) that sets it -- see
 * docker-compose.yml / deployment docs.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  return "unknown";
}
