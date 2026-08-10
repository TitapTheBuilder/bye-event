import { db, getEventSettings, upsertEventSettings } from "@repo/db";
import { eventSettingsUpdateSchema } from "@repo/shared/schemas";
import { forbiddenOrigin, isSameOriginRequest, unauthorized } from "@/lib/http";
import { requireAdminSession, UnauthorizedError } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized();
    throw err;
  }

  const settings = await getEventSettings(db);
  return NextResponse.json({ settings });
}

/**
 * Business name + manual brand-color overrides (§7/§8). Colors are
 * auto-extracted from the logo on upload (see ./logo/route.ts) but always
 * admin-overridable via color pickers -- this is that override path.
 * Writes to event_settings, which both apps read at render time, so a
 * change here takes effect without a redeploy.
 */
export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();

  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized();
    throw err;
  }

  const body = await request.json().catch(() => null);
  const parsed = eventSettingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const settings = await upsertEventSettings(db, parsed.data);
  return NextResponse.json({ settings });
}
