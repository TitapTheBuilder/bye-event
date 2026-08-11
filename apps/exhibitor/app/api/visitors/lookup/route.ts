import {
  consumeRateLimit,
  db,
  getVisitorByQrToken,
  getVisitorByShortCode,
} from "@repo/db";
import { VISITOR_LOOKUP_RATE_LIMIT } from "@repo/shared/constants";
import { forbiddenOrigin, getClientIp, isSameOriginRequest } from "@/lib/http";
import { NextResponse } from "next/server";

const SHORT_CODE_PATTERN = /^\d{6}$/;
const QR_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" } as const;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 512) {
    return NextResponse.json({ error: "Request is too large" }, { status: 413, headers: NO_STORE_HEADERS });
  }

  const body = (await request.json().catch(() => null)) as { identifier?: unknown } | null;
  const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
  const isShortCode = SHORT_CODE_PATTERN.test(identifier);
  const isQrToken = QR_TOKEN_PATTERN.test(identifier);

  if (!isShortCode && !isQrToken) {
    return NextResponse.json({ error: "Invalid visitor code" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  // Product requirement: six-digit manual codes have unlimited retries and
  // never receive an application-level 429. Only high-entropy QR tokens use
  // the distributed abuse-control bucket required for anonymous QR scanning.
  if (isQrToken) {
    const rateLimit = await consumeRateLimit(
      db,
      `visitor-lookup:qr:${getClientIp(request)}`,
      VISITOR_LOOKUP_RATE_LIMIT,
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many QR lookups, please slow down" },
        {
          status: 429,
          headers: {
            ...NO_STORE_HEADERS,
            "Retry-After": Math.max(
              1,
              Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
            ).toString(),
          },
        },
      );
    }
  }

  const visitor = isShortCode
    ? await getVisitorByShortCode(db, identifier)
    : await getVisitorByQrToken(db, identifier);
  if (!visitor) {
    return NextResponse.json({ error: "Visitor not found" }, { status: 404, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json(
    {
      visitor: {
        // Do not reveal the high-entropy badge credential through a successful
        // six-digit lookup. Cache/sync can continue using the entered code.
        qrToken: identifier,
        firstName: visitor.firstName,
        lastName: visitor.lastName,
        company: visitor.company,
        phoneNumber: visitor.phoneNumber,
        email: visitor.email,
        visitorType: visitor.visitorType,
      },
    },
    { headers: NO_STORE_HEADERS },
  );
}
