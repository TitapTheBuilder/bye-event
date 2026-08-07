import { verifySessionToken } from "@repo/shared/auth";
import { ADMIN_SESSION_COOKIE } from "@repo/shared/constants";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Next.js 16's renamed `middleware.ts` -> `proxy.ts` (exported function
 * `proxy`, Node.js runtime). UX-only redirect for unauthenticated admins --
 * NOT the security boundary. Every Server Action and Route Handler
 * re-verifies the session independently (see lib/session.ts) because
 * Next.js has shipped a middleware-bypass vulnerability before
 * (CVE-2025-29927).
 */
const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  const verified = token && secret ? await verifySessionToken(token, secret, "admin") : null;

  if (!verified) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // API routes are excluded entirely: they must always return a proper
  // JSON 401 from the handler itself (via requireAdminSession), not an
  // HTML redirect, which would break fetch()-based error handling.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
