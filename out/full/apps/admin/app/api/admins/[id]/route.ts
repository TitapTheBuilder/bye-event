import { db, deleteAdmin, listAdmins } from "@repo/db";
import { forbiddenOrigin, isSameOriginRequest, unauthorized } from "@/lib/http";
import { requireAdminSession, UnauthorizedError } from "@/lib/session";
import { NextResponse } from "next/server";

/**
 * Admin accounts are hard-deleted by design (no deactivated_at column on
 * `admins` -- see @repo/db/src/admins.ts). Guarded here against an admin
 * deleting their own account, or the last remaining admin account, either
 * of which would lock the whole panel out.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();

  let session: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    session = await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized();
    throw err;
  }

  const { id } = await params;

  if (id === session.adminId) {
    return NextResponse.json({ error: "You cannot delete your own admin account" }, { status: 400 });
  }

  const admins = await listAdmins(db);
  if (admins.length <= 1) {
    return NextResponse.json({ error: "Cannot delete the last remaining admin account" }, { status: 400 });
  }

  await deleteAdmin(db, id);
  return NextResponse.json({ ok: true });
}
