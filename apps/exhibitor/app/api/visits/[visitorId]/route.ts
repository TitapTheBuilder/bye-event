import { deleteVisit, db } from "@repo/db";
import { forbiddenOrigin, isSameOriginRequest, unauthorized } from "@/lib/http";
import { requireExhibitorSession, UnauthorizedError } from "@/lib/session";
import { NextResponse } from "next/server";

/**
 * The exhibitor's own "remove from my scanned list" action -- by design a
 * hard delete of exactly this one Visit row (unlike the soft-deletes used
 * everywhere else in the system).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ visitorId: string }> },
) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();

  let session: Awaited<ReturnType<typeof requireExhibitorSession>>;
  try {
    session = await requireExhibitorSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized();
    throw err;
  }

  const { visitorId } = await params;
  await deleteVisit(db, session.exhibitorId, visitorId);

  return NextResponse.json({ ok: true });
}
