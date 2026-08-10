import { NextResponse } from "next/server";

/**
 * Any custom Route Handler that mutates state must check the Origin header
 * itself -- Server Actions get Next's built-in Origin verification for
 * free, but hand-rolled Route Handlers (like every mutating route in this
 * app) do not.
 */
function firstForwardedValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const allowedOrigins = new Set([requestUrl.origin]);

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
