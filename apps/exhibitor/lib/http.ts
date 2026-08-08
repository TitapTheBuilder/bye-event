import { NextResponse } from "next/server";

/**
 * Any custom Route Handler that mutates state must check the Origin header
 * itself -- Server Actions get Next's built-in Origin verification for
 * free, but hand-rolled Route Handlers (like ours here) do not.
 */
function firstForwardedValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  // Some same-site requests omit Origin, but we only call this from
  // state-mutating handlers, so a missing header is treated as untrusted.
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const allowedOrigins = new Set([requestUrl.origin]);

    // Next may see an internal container URL behind an HTTPS reverse proxy.
    // Compare against the externally-visible host/protocol supplied by that
    // trusted proxy as well as the direct request URL. This keeps CSRF origin
    // validation intact while allowing phone/LAN and production proxy setups.
    const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
    const host = forwardedHost ?? request.headers.get("host");
    const forwardedProto = firstForwardedValue(request.headers.get("x-forwarded-proto"));
    const protocol = forwardedProto ?? requestUrl.protocol.replace(":", "");
    if (host && (protocol === "http" || protocol === "https")) {
      allowedOrigins.add(`${protocol}://${host}`);
    }

    return allowedOrigins.has(originUrl.origin);
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
