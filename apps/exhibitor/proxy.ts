import { verifySessionToken } from "@repo/shared/auth";
import { EXHIBITOR_SESSION_COOKIE } from "@repo/shared/constants";
import { type NextRequest, NextResponse } from "next/server";

// Basic in-memory rate limiting map for Node runtime (IP -> timestamps)
// In production, use Upstash Redis for distributed rate limiting.
const rateLimitMap = new Map<string, number[]>();
const MAX_REQUESTS = 100;
const WINDOW_MS = 60 * 1000; // 1 minute

const AUTH_REQUIRED_PREFIXES = ["/scanned", "/profile"];

export async function proxy(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  
  // 1. Rate Limiting Logic
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const requests = (rateLimitMap.get(ip) || []).filter(timestamp => timestamp > windowStart);
  requests.push(now);
  rateLimitMap.set(ip, requests);

  if (requests.length > MAX_REQUESTS) {
    return new NextResponse("Too Many Requests", { status: 429 });
  }

  const { pathname } = request.nextUrl;

  const requiresAuthUi = AUTH_REQUIRED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  
  let response = NextResponse.next();

  if (requiresAuthUi) {
    const token = request.cookies.get(EXHIBITOR_SESSION_COOKIE)?.value;
    const secret = process.env.SESSION_SECRET;
    const verified = token && secret ? await verifySessionToken(token, secret, "exhibitor") : null;

    if (!verified) {
      if (pathname.startsWith("/api/")) {
        response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      } else {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("next", pathname);
        response = NextResponse.redirect(loginUrl);
      }
    }
  }

  // 2. Strict CORS Policy
  response.headers.set("Access-Control-Allow-Origin", "https://your-production-domain.com");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)"],
};
