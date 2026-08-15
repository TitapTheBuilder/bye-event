import { db, putUpload, upsertEventSettings } from "@repo/db";
import { logoUploadSchema } from "@repo/shared/schemas";
import { extractBrandColors } from "@/lib/colors";
import { forbiddenOrigin, isSameOriginRequest, unauthorized } from "@/lib/http";
import { requireAdminSession, UnauthorizedError } from "@/lib/session";
import { InvalidLogoUploadError, saveLogoUpload } from "@/lib/uploads";
import { NextResponse } from "next/server";

/**
 * Logo upload (§7): validates and decodes a bounded raster image, stores a
 * canonical PNG, and auto-extracts 2-3 brand colors from it (node-vibrant).
 * If extraction fails, the existing/default palette is kept and the admin
 * can still set colors manually via PATCH /api/branding. Writes
 * event_settings.logo_url, read by both apps at render time.
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
  let saved: Awaited<ReturnType<typeof saveLogoUpload>>;
  try {
    saved = await saveLogoUpload(buffer, parsed.data.contentType);
  } catch (error) {
    if (error instanceof InvalidLogoUploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  const { filePath, url, storagePath, data, contentType } = saved;

  // The copy that actually matters. The exhibitor app runs as a separate
  // container and cannot read this one's disk, but both talk to the same
  // database -- so that is what its /uploads route serves the logo from.
  await putUpload(db, storagePath, contentType, data);

  const extracted = await extractBrandColors(data);

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
