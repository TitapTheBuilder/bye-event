import { db, listExhibitors } from "@repo/db";
import { unauthorized } from "@/lib/http";
import { requireAdminSession, UnauthorizedError } from "@/lib/session";
import { NextResponse } from "next/server";

/**
 * Read-only from the admin side: exhibitor accounts are self-service
 * signups via the exhibitor PWA (§6) -- admin can view and
 * deactivate/reactivate them (§7), but never creates one directly.
 */
export async function GET(request: Request) {
  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized();
    throw err;
  }

  const { searchParams } = new URL(request.url);
  const includeDeactivated = searchParams.get("includeDeactivated") === "true";

  const exhibitors = await listExhibitors(db, { includeDeactivated });
  return NextResponse.json({ exhibitors });
}
