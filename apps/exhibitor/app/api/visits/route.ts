import { db, listVisitsForExhibitor } from "@repo/db";
import { unauthorized } from "@/lib/http";
import { requireExhibitorSession, UnauthorizedError } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  let session: Awaited<ReturnType<typeof requireExhibitorSession>>;
  try {
    session = await requireExhibitorSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized();
    throw err;
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("q") ?? undefined;

  const visits = await listVisitsForExhibitor(db, session.exhibitorId, search);
  return NextResponse.json({ visits });
}
