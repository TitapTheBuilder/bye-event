import { db, upsertEventSettings } from "@repo/db";
import { logoUploadSchema } from "@repo/shared/schemas";
import { extractBrandColors } from "@/lib/colors";
import { forbiddenOrigin, isSameOriginRequest, unauthorized } from "@/lib/http";
import { requireAdminSession, UnauthorizedError } from "@/lib/session";
import { saveLogoUpload } from "@/lib/uploads";
import { NextResponse } from "next/server";

/**
 * Logo upload (§7): validates file type/size, stores it to disk, and
 * auto-extracts 2-3 brand colors from it (node-vibrant) unless extraction
 * fails (e.g. an SVG logo) -- in which case the existing/default palette
 * is kept and the admin can still set colors manually via PATCH
 * /api/branding. Writes event_settings.logo_url, read by both apps at
 * render time.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();

  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized();
    throw err;
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("logo");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No logo file provided" }, { status: 400 });
  }

  const parsed = logoUploadSchema.safeParse({ contentType: file.type, sizeBytes: file.size });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid logo file", issues: parsed.error.issues }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { filePath, url } = await saveLogoUpload(buffer, parsed.data.contentType);

  const extracted = await extractBrandColors(filePath);

  const settings = await upsertEventSettings(db, {
    logoUrl: url,
    ...(extracted
      ? {
          primaryColor: extracted.primaryColor,
          secondaryColor: extracted.secondaryColor,
          accentColor: extracted.accentColor,
        }
      : {}),
  });

  return NextResponse.json({ settings, colorsExtracted: extracted !== null });
}
