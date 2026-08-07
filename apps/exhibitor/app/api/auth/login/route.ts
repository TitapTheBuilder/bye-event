import { db, getExhibitorByUsername } from "@repo/db";
import { verifyPassword } from "@repo/shared/auth";
import { exhibitorLoginSchema } from "@repo/shared/schemas";
import { forbiddenOrigin, isSameOriginRequest } from "@/lib/http";
import { createExhibitorSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();

  const body = await request.json().catch(() => null);
  const parsed = exhibitorLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, {
      status: 400,
    });
  }

  const { username, password } = parsed.data;
  const exhibitor = await getExhibitorByUsername(db, username);

  // Generic error message either way -- never reveal whether the username
  // exists.
  const invalidCredentials = () =>
    NextResponse.json({ error: "Invalid username or password" }, { status: 401 });

  if (!exhibitor || exhibitor.deactivatedAt) return invalidCredentials();

  const validPassword = await verifyPassword(exhibitor.passwordHash, password);
  if (!validPassword) return invalidCredentials();

  await createExhibitorSession(exhibitor.id);

  return NextResponse.json({
    exhibitor: { id: exhibitor.id, name: exhibitor.name, username: exhibitor.username },
  });
}
