import path from "node:path";
import { db, getUpload } from "@repo/db";
import { readUploadedFile, resolveUploadPath } from "@/lib/uploads";
import { NextResponse } from "next/server";

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/**
 * Serves admin-uploaded assets (the business-customer logo). Intentionally
 * unauthenticated: both apps' layouts render this logo publicly, before
 * login, from event_settings.logo_url -- there's no PII or access-control
 * concern in a logo image. resolveUploadPath rejects any `..`/nested-slash
 * segment so this can never be turned into an arbitrary-file-read.
 *
 * The database is the system of record (see the `uploads` table); the
 * local-disk read is a read-only fallback for assets uploaded before that
 * existed.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const filePath = resolveUploadPath(segments);
  if (!filePath) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const contentType = CONTENT_TYPE_BY_EXTENSION[path.extname(filePath).toLowerCase()];
  if (!contentType) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stored = await getUpload(db, segments.join("/"));
  if (stored) {
    return new NextResponse(new Uint8Array(stored.data), {
      headers: {
        "Content-Type": stored.contentType || contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  }

  try {
    const data = await readUploadedFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
