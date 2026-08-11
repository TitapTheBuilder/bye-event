import { consumeRateLimit, db, getAdminByEmail } from "@repo/db";
import { verifyPassword } from "@repo/shared/auth/password";
import { ADMIN_LOGIN_RATE_LIMIT } from "@repo/shared/constants";
import { adminLoginSchema } from "@repo/shared/schemas";
import { forbiddenOrigin, getClientIp, isSameOriginRequest } from "@/lib/http";
import { createAdminSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();

  const rateLimit = await consumeRateLimit(
    db,
    `auth:admin-login:${getClientIp(request)}`,
    ADMIN_LOGIN_RATE_LIMIT,
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts, please try again later" },
      {
        status: 429,
        headers: {
          "Retry-After": Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000)).toString(),
        },
      },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, {
      status: 400,
    });
  }

  const { email, password } = parsed.data;
  const accountRateLimit = await consumeRateLimit(
    db,
    `auth:admin-login-account:${email.toLowerCase()}`,
    ADMIN_LOGIN_RATE_LIMIT,
  );
  if (!accountRateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts, please try again later" },
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

  const admin = await getAdminByEmail(db, email);

  const invalidCredentials = () =>
    NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  if (!admin) return invalidCredentials();

  const validPassword = await verifyPassword(admin.passwordHash, password);
  if (!validPassword) return invalidCredentials();

  await createAdminSession(admin.id, admin.sessionVersion);

  return NextResponse.json({ admin: { id: admin.id, name: admin.name, email: admin.email } });
}
