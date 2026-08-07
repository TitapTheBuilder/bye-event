import { createExhibitor, db, getExhibitorByUsername } from "@repo/db";
import { hashPassword } from "@repo/shared/auth";
import { exhibitorSignupSchema } from "@repo/shared/schemas";
import { forbiddenOrigin, isSameOriginRequest } from "@/lib/http";
import { createExhibitorSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();

  const body = await request.json().catch(() => null);
  const parsed = exhibitorSignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, {
      status: 400,
    });
  }

  const { name, username, phoneNumber, password } = parsed.data;

  const existing = await getExhibitorByUsername(db, username);
  if (existing) {
    return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  let exhibitor: Awaited<ReturnType<typeof createExhibitor>>;
  try {
    exhibitor = await createExhibitor(db, { name, username, phoneNumber, passwordHash });
  } catch {
    // Most likely the phone_number unique constraint.
    return NextResponse.json(
      { error: "Username or phone number is already in use" },
      { status: 409 },
    );
  }

  await createExhibitorSession(exhibitor.id);

  return NextResponse.json(
    { exhibitor: { id: exhibitor.id, name: exhibitor.name, username: exhibitor.username } },
    { status: 201 },
  );
}
