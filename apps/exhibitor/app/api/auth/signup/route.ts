import { createExhibitor, db, getExhibitorByUsername } from "@repo/db";
import { hashPassword } from "@repo/shared/auth/password";
import { exhibitorSignupSchema } from "@repo/shared/schemas";
import { NextResponse } from "next/server";
import { forbiddenOrigin, isSameOriginRequest } from "@/lib/http";
import { createExhibitorSession } from "@/lib/session";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();

  const body = await request.json().catch(() => null);
  const parsed = exhibitorSignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      {
        status: 400,
      },
    );
  }

  const { firstName, lastName, username, phoneNumber, password } = parsed.data;

  const existing = await getExhibitorByUsername(db, username);
  if (existing) {
    return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  let exhibitor: Awaited<ReturnType<typeof createExhibitor>>;
  try {
    exhibitor = await createExhibitor(db, {
      firstName,
      lastName,
      username,
      phoneNumber,
      passwordHash,
    });
  } catch (err: unknown) {
    const dbErr = err as { code?: string; constraint?: string; message?: string; detail?: string };
    console.error("Exhibitor signup database error:", err);

    // Postgres unique_violation error code is 23505
    if (dbErr?.code === "23505" || dbErr?.message?.includes("unique") || dbErr?.detail?.includes("already exists")) {
      const target = `${dbErr?.constraint ?? ""} ${dbErr?.detail ?? ""} ${dbErr?.message ?? ""}`.toLowerCase();
      if (target.includes("phone")) {
        return NextResponse.json({ error: "Phone number is already in use" }, { status: 409 });
      }
      if (target.includes("username")) {
        return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
      }
      return NextResponse.json(
        { error: "Username or phone number is already in use" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Registration failed due to a server error. Please try again later." },
      { status: 500 },
    );
  }

  await createExhibitorSession(exhibitor.id, exhibitor.sessionVersion);

  return NextResponse.json(
    {
      exhibitor: {
        id: exhibitor.id,
        firstName: exhibitor.firstName,
        lastName: exhibitor.lastName,
        username: exhibitor.username,
        phoneNumber: exhibitor.phoneNumber,
      },
    },
    { status: 201 },
  );
}
