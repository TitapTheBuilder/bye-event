import { verifySessionToken } from "@repo/shared/auth/session";
import { EXHIBITOR_SESSION_COOKIE } from "@repo/shared/constants";
import { type NextRequest, NextResponse } from "next/server";

const AUTH_REQUIRED_PREFIXES = ["/profile"];

function createContentSecurityPolicy(nonce: string): string {
  const developmentEval = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${developmentEval}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
  ].join("; ");
}

function secureResponse(response: NextResponse, pathname: string, csp: string): NextResponse {
  response.headers.set("Content-Security-Policy", csp);
  if (pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = btoa(crypto.randomUUID());
  const csp = createContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const requiresAuthUi = AUTH_REQUIRED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (requiresAuthUi) {
    const token = request.cookies.get(EXHIBITOR_SESSION_COOKIE)?.value;
    const secret = process.env.EXHIBITOR_SESSION_SECRET;
    const verified = token && secret ? await verifySessionToken(token, secret, "exhibitor") : null;

    if (!verified) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      response = NextResponse.redirect(loginUrl);
    }
  }

  return secureResponse(response, pathname, csp);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)"],
};
