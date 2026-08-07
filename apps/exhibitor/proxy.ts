import { verifySessionToken } from "@repo/shared/auth";
import { EXHIBITOR_SESSION_COOKIE } from "@repo/shared/constants";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Next.js 16's renamed `middleware.ts` -> `proxy.ts` (exported function
 * `proxy`, Node.js runtime). This is UX-only: it redirects an
 * unauthenticated visitor away from screens that assume a logged-in
 * exhibitor. It is deliberately NOT the security boundary -- every Server
 * Action and Route Handler re-verifies the session independently (see
 * lib/session.ts) because Next.js has shipped a middleware-bypass
 * vulnerability before (CVE-2025-29927).
 *
 * Landing, login, signup, the scan view, and the visitor description page
 * all must work without a session (offline-first pre-login scanning is a
 * hard requirement) -- only the scanned-list and profile screens redirect.
 */
const AUTH_REQUIRED_PREFIXES = ["/scanned", "/profile"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requiresAuthUi = AUTH_REQUIRED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!requiresAuthUi) return NextResponse.next();

  const token = request.cookies.get(EXHIBITOR_SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  const verified = token && secret ? await verifySessionToken(token, secret, "exhibitor") : null;

  if (!verified) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/scanned/:path*", "/profile/:path*"],
};
