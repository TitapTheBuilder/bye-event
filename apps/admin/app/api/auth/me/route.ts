import { db, getAdminById } from "@repo/db";
import { getAdminSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ admin: null });

  const admin = await getAdminById(db, session.adminId);
  if (!admin) return NextResponse.json({ admin: null });

  return NextResponse.json({ admin: { id: admin.id, name: admin.name, email: admin.email } });
}
