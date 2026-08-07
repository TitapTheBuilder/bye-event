import { createAdmin, db, getAdminByEmail, listAdmins } from "@repo/db";
import { hashPassword } from "@repo/shared/auth";
import { adminCreateSchema } from "@repo/shared/schemas";
import { forbiddenOrigin, isSameOriginRequest, unauthorized } from "@/lib/http";
import { requireAdminSession, UnauthorizedError } from "@/lib/session";
import { NextResponse } from "next/server";

function toPublicAdmin(admin: { id: string; name: string; email: string; createdAt: Date }) {
  return { id: admin.id, name: admin.name, email: admin.email, createdAt: admin.createdAt };
}

/** Every admin account is created by another admin -- there is no
 * self-signup, supporting multiple distinct admin accounts from day one
 * (§3/§7). */
export async function GET() {
  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized();
    throw err;
  }

  const admins = await listAdmins(db);
  return NextResponse.json({ admins: admins.map(toPublicAdmin) });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();

  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized();
    throw err;
  }

  const body = await request.json().catch(() => null);
  const parsed = adminCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const { name, email, password } = parsed.data;
  const existing = await getAdminByEmail(db, email);
  if (existing) {
    return NextResponse.json({ error: "An admin with this email already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const admin = await createAdmin(db, { name, email, passwordHash });
  return NextResponse.json({ admin: toPublicAdmin(admin) }, { status: 201 });
}
