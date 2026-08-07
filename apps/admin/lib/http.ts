import { NextResponse } from "next/server";

/**
 * Any custom Route Handler that mutates state must check the Origin header
 * itself -- Server Actions get Next's built-in Origin verification for
 * free, but hand-rolled Route Handlers (like every mutating route in this
 * app) do not.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
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
