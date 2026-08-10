import path from "node:path";
import { db, getUpload, putUpload } from "@repo/db";
import { readUploadedFile, resolveUploadPath } from "@/lib/uploads";
import { NextResponse } from "next/server";

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

/**
 * Serves admin-uploaded assets (the business-customer logo). Intentionally
 * unauthenticated: both apps' layouts render this logo publicly, before
 * login, from event_settings.logo_url -- there's no PII or access-control
 * concern in a logo image. resolveUploadPath rejects any `..`/nested-slash
 * segment so this can never be turned into an arbitrary-file-read.
 *
 * The database is the system of record (see the `uploads` table); the
 * local-disk read is a fallback for assets uploaded before that existed.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const filePath = resolveUploadPath(segments);
  if (!filePath) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const stored = await getUpload(db, segments.join("/"));
  if (stored) {
    return new NextResponse(new Uint8Array(stored.data), {
      headers: {
        "Content-Type": stored.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  try {
    const data = await readUploadedFile(filePath);
    const contentType = CONTENT_TYPE_BY_EXTENSION[path.extname(filePath).toLowerCase()];
    // Backfill: this asset predates database storage and so is invisible to
    // the exhibitor app. We are the container that still holds the bytes, so
    // copy them across now rather than making the admin re-upload.
    if (contentType) {
      await putUpload(db, segments.join("/"), contentType, data).catch(() => {});
    }
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
