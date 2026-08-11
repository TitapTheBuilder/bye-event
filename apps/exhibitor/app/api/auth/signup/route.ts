import { consumeRateLimit, createExhibitor, db, getExhibitorByUsername } from "@repo/db";
import { hashPassword } from "@repo/shared/auth/password";
import { EXHIBITOR_SIGNUP_RATE_LIMIT } from "@repo/shared/constants";
import { exhibitorSignupSchema } from "@repo/shared/schemas";
import { NextResponse } from "next/server";
import { forbiddenOrigin, getClientIp, isSameOriginRequest } from "@/lib/http";
import { createExhibitorSession } from "@/lib/session";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();

  const rateLimit = await consumeRateLimit(
    db,
    `auth:exhibitor-signup:${getClientIp(request)}`,
    EXHIBITOR_SIGNUP_RATE_LIMIT,
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many signup attempts, please try again later" },
      {
        status: 429,
        headers: {
          "Retry-After": Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000)).toString(),
        },
      },
    );
  }

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
  const accountRateLimit = await consumeRateLimit(
    db,
    `auth:exhibitor-signup-account:${username.toLowerCase()}`,
    EXHIBITOR_SIGNUP_RATE_LIMIT,
  );
  if (!accountRateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many signup attempts, please try again later" },
      {
        status: 429,
        headers: {
          "Retry-After": Math.max(
            1,
            Math.ceil((accountRateLimit.resetAt - Date.now()) / 1000),
          ).toString(),
        },
      },
    );
  }

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
  } catch {
    // Most likely the phone_number unique constraint.
    return NextResponse.json(
      { error: "Username or phone number is already in use" },
      { status: 409 },
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
