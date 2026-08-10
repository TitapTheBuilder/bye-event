import path from "node:path";
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
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const filePath = resolveUploadPath(segments);
  if (!filePath) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const data = await readUploadedFile(filePath);
    const contentType = CONTENT_TYPE_BY_EXTENSION[path.extname(filePath).toLowerCase()];
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
