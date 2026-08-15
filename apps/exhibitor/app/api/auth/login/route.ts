import { db, getExhibitorByUsername } from "@repo/db";
import { verifyPassword } from "@repo/shared/auth/password";
import { exhibitorLoginSchema } from "@repo/shared/schemas";
import { NextResponse } from "next/server";
import { forbiddenOrigin, isSameOriginRequest } from "@/lib/http";
import { createExhibitorSession } from "@/lib/session";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();

  const body = await request.json().catch(() => null);
  const parsed = exhibitorLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      {
        status: 400,
      },
    );
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

  await createExhibitorSession(exhibitor.id, exhibitor.sessionVersion);

  return NextResponse.json({
    exhibitor: {
      id: exhibitor.id,
      firstName: exhibitor.firstName,
      lastName: exhibitor.lastName,
      username: exhibitor.username,
      phoneNumber: exhibitor.phoneNumber,
    },
  });
}
