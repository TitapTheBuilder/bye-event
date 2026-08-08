import { db, getVisitorByQrToken, syncVisitEvent } from "@repo/db";
import { visitSyncRequestSchema } from "@repo/shared/schemas";
import type { VisitSyncResponse, VisitSyncResultEntry } from "@repo/shared/schemas";
import { forbiddenOrigin, isSameOriginRequest, unauthorized } from "@/lib/http";
import { requireExhibitorSession, UnauthorizedError } from "@/lib/session";
import { NextResponse } from "next/server";

/**
 * Idempotent by construction: each localId is transactionally inserted into
 * visit_sync_events before its Visit upsert. Replaying the same client event
 * after a lost response succeeds without incrementing scan_count twice.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();

  let session: Awaited<ReturnType<typeof requireExhibitorSession>>;
  try {
    session = await requireExhibitorSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized();
    throw err;
  }

  const body = await request.json().catch(() => null);
  const parsed = visitSyncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, {
      status: 400,
    });
  }

  const results: VisitSyncResultEntry[] = [];

  for (const entry of parsed.data.entries) {
    try {
      const visitor = await getVisitorByQrToken(db, entry.qrToken);
      if (!visitor) {
        results.push({
          localId: entry.localId,
          status: "error",
          error: "Visitor not found",
          errorCode: "visitor_not_found",
        });
        continue;
      }
      await syncVisitEvent(
        db,
        entry.localId,
        session.exhibitorId,
        visitor.id,
        new Date(entry.scannedAt),
      );
      results.push({ localId: entry.localId, status: "synced" });
    } catch {
      results.push({
        localId: entry.localId,
        status: "error",
        error: "Sync failed",
        errorCode: "sync_failed",
      });
    }
  }

  const response: VisitSyncResponse = { results };
  return NextResponse.json(response);
}
