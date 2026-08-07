import { createGuestVisitors, db } from "@repo/db";
import { guestGenerateSchema } from "@repo/shared/schemas";
import { forbiddenOrigin, isSameOriginRequest, unauthorized } from "@/lib/http";
import { requireAdminSession, UnauthorizedError } from "@/lib/session";
import { NextResponse } from "next/server";

/**
 * Bulk guest-badge generation (§7): admin enters a count, we create that
 * many blank `visitor_type = 'guest'` rows, each with its own freshly
 * generated qr_token via the shared @repo/db insert helper -- QR mapping
 * is fully automatic, never a separate manual step.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();

  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized();
    throw err;
  }

  const body = await request.json().catch(() => null);
  const parsed = guestGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const visitors = await createGuestVisitors(db, parsed.data.count);
  return NextResponse.json({ visitors }, { status: 201 });
}
