import { deactivateExhibitor, db, getExhibitorById, reactivateExhibitor } from "@repo/db";
import { exhibitorStatusUpdateSchema } from "@repo/shared/schemas";
import { forbiddenOrigin, isSameOriginRequest, unauthorized } from "@/lib/http";
import { requireAdminSession, UnauthorizedError } from "@/lib/session";
import { NextResponse } from "next/server";

/** Deactivate/reactivate an exhibitor account (§7) -- soft-delete only,
 * keeping historical visit analytics intact. Never a hard DELETE here. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();

  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized();
    throw err;
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = exhibitorStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  if (parsed.data.action === "deactivate") {
    await deactivateExhibitor(db, id);
  } else {
    await reactivateExhibitor(db, id);
  }

  const exhibitor = await getExhibitorById(db, id);
  if (!exhibitor) return NextResponse.json({ error: "Exhibitor not found" }, { status: 404 });
  return NextResponse.json({ exhibitor });
}
