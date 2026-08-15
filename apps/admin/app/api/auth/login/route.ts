import { db, getAdminByEmail } from "@repo/db";
import { verifyPassword } from "@repo/shared/auth/password";
import { adminLoginSchema } from "@repo/shared/schemas";
import { forbiddenOrigin, isSameOriginRequest } from "@/lib/http";
import { createAdminSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();

  const body = await request.json().catch(() => null);
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, {
      status: 400,
    });
  }

  const { email, password } = parsed.data;
  const admin = await getAdminByEmail(db, email);

  const invalidCredentials = () =>
    NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  if (!admin) return invalidCredentials();

  const validPassword = await verifyPassword(admin.passwordHash, password);
  if (!validPassword) return invalidCredentials();

  await createAdminSession(admin.id, admin.sessionVersion);

  return NextResponse.json({ admin: { id: admin.id, name: admin.name, email: admin.email } });
}
