import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;

function getUploadsDir(): string {
  return process.env.UPLOADS_DIR ?? path.join(process.cwd(), ".uploads");
}

/**
 * Serves admin-uploaded assets (the business-customer logo) directly from
 * the shared uploads volume so the exhibitor app can resolve the relative
 * `/uploads/...` path stored in event_settings.logo_url without needing
 * to proxy through the admin app.
 *
 * Mirrors apps/admin/app/uploads/[...path]/route.ts — intentionally
 * unauthenticated (logo is public) and path-traversal-safe (only flat
 * alphanumeric segments are accepted).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;

  // Reject anything that isn't a flat, safe filename per segment.
  if (segments.length === 0 || !segments.every((s) => SAFE_SEGMENT.test(s))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const uploadsDir = path.resolve(getUploadsDir());
  const resolved = path.resolve(uploadsDir, ...segments);

  // Belt-and-suspenders: never serve anything outside the uploads dir.
  if (!resolved.startsWith(`${uploadsDir}${path.sep}`) && resolved !== uploadsDir) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const data = await readFile(resolved);
    const contentType = CONTENT_TYPE_BY_EXTENSION[path.extname(resolved).toLowerCase()];
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
