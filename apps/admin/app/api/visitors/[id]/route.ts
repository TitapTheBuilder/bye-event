import {
  db,
  deactivateVisitor,
  getExhibitorsForVisitor,
  getVisitorById,
  reactivateVisitor,
  updateVisitor,
} from "@repo/db";
import { visitorStatusUpdateSchema, visitorUpdateSchema } from "@repo/shared/schemas";
import { forbiddenOrigin, isSameOriginRequest, unauthorized } from "@/lib/http";
import { requireAdminSession, UnauthorizedError } from "@/lib/session";
import { NextResponse } from "next/server";

async function checkAuth(): Promise<NextResponse | null> {
  try {
    await requireAdminSession();
    return null;
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized();
    throw err;
  }
}

/** Visitor detail + which exhibitors scanned them -- backs the dashboard's
 * expandable visitor row (§7: "expands to show which exhibitors scanned
 * each one"). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await checkAuth();
  if (authError) return authError;

  const { id } = await params;
  const visitor = await getVisitorById(db, id);
  if (!visitor) return NextResponse.json({ error: "Visitor not found" }, { status: 404 });

  const exhibitors = await getExhibitorsForVisitor(db, id);
  return NextResponse.json({ visitor, exhibitors });
}

/** Either a field update (name/company/phone/email/visitorType -- used for
 * both the invited-visitor edit form and filling in a guest's details) or
 * a `{ action: "reactivate" }` restore of a soft-deleted visitor. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();
  const authError = await checkAuth();
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const statusParsed = visitorStatusUpdateSchema.safeParse(body);
  if (statusParsed.success) {
    if (statusParsed.data.action === "reactivate") {
      await reactivateVisitor(db, id);
    } else {
      await deactivateVisitor(db, id);
    }
    const visitor = await getVisitorById(db, id);
    return NextResponse.json({ visitor });
  }

  const parsed = visitorUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const visitor = await updateVisitor(db, id, parsed.data);
  if (!visitor) return NextResponse.json({ error: "Visitor not found" }, { status: 404 });
  return NextResponse.json({ visitor });
}

/** Soft-delete: keeps historical visit analytics intact (per §4/§5) --
 * never a hard DELETE from the admin side. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();
  const authError = await checkAuth();
  if (authError) return authError;

  const { id } = await params;
  await deactivateVisitor(db, id);
  return NextResponse.json({ ok: true });
}
