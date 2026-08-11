import path from "node:path";
import { db, getUpload } from "@repo/db";
import { NextResponse } from "next/server";

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;


/**
 * Serves admin-uploaded assets (the business-customer logo) so this app
 * can resolve the relative `/uploads/...` path stored in
 * event_settings.logo_url without proxying through the admin app.
 *
 * Reads from the `uploads` table, because the admin app runs as a separate
 * container and its local disk is NOT reachable from here in a normal
 * deployment -- only docker-compose happens to mount a shared volume.

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

  const contentType = CONTENT_TYPE_BY_EXTENSION[
    path.extname(segments.at(-1) ?? "").toLowerCase()
  ];
  if (!contentType) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stored = await getUpload(db, segments.join("/"));
  if (!stored) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(stored.data), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
