import { db, getVisitorByQrToken } from "@repo/db";
import { checkRateLimit } from "@repo/shared/auth";
import { VISITOR_LOOKUP_RATE_LIMIT } from "@repo/shared/constants";
import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/http";

/**
 * Intentionally unauthenticated -- scanning must work before an exhibitor
 * logs in. Because of that, this is the one surface most worth defending:
 * it's rate-limited per IP on top of qr_token already being long/random
 * (32 chars, ~190 bits of entropy) so it can't be brute-forced.
 */
export async function GET(request: Request, { params }: { params: Promise<{ qrToken: string }> }) {
  const { qrToken } = await params;

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`visitor-lookup:${ip}`, VISITOR_LOOKUP_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests, please slow down" },
      {
        status: 429,
        headers: { "Retry-After": Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString() },
      },
    );
  }

  if (!qrToken || qrToken.length > 64) {
    return NextResponse.json({ error: "Invalid QR token" }, { status: 400 });
  }

  const visitor = await getVisitorByQrToken(db, qrToken);
  if (!visitor) {
    return NextResponse.json({ error: "Visitor not found" }, { status: 404 });
  }

  return NextResponse.json({
    visitor: {
      qrToken: visitor.qrToken,
      firstName: visitor.firstName,
      lastName: visitor.lastName,
      company: visitor.company,
      phoneNumber: visitor.phoneNumber,
      email: visitor.email,
      visitorType: visitor.visitorType,
    },
  });
}
