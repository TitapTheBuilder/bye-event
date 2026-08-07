import { createVisitorsBulk, db } from "@repo/db";
import { type VisitorImportRow, visitorImportRowSchema } from "@repo/shared/schemas";
import { forbiddenOrigin, isSameOriginRequest, unauthorized } from "@/lib/http";
import { requireAdminSession, UnauthorizedError } from "@/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const commitSchema = z.object({
  rows: z.array(visitorImportRowSchema).min(1).max(5000),
});

/**
 * Step 2 of the bulk visitor import flow: the client sends back exactly
 * the rows it wants inserted (normally the valid subset from the preview
 * step, re-validated here server-side too -- never trust client-side
 * validation alone). Goes through createVisitorsBulk, the same shared
 * insert helper used by every other visitor-creating path, so qr_token
 * generation is never duplicated.
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
  const parsed = commitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const visitors = await createVisitorsBulk(
    db,
    parsed.data.rows.map((row: VisitorImportRow) => ({ ...row, visitorType: "invited" as const })),
  );

  return NextResponse.json({ insertedCount: visitors.length, visitors }, { status: 201 });
}
