import {
  ImportFileError,
  MAX_IMPORT_FILE_BYTES,
  parseVisitorImportFile,
} from "@/lib/import";
import { forbiddenOrigin, isSameOriginRequest, unauthorized } from "@/lib/http";
import { requireAdminSession, UnauthorizedError } from "@/lib/session";
import { NextResponse } from "next/server";

const MAX_MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

/**
 * Step 1 of the bulk visitor import flow (§7): parses + validates the
 * uploaded CSV/XLSX file per row WITHOUT writing anything to the
 * database, so the admin can review a preview (valid rows + per-row
 * validation errors) before committing. See ./commit/route.ts for the
 * actual insert.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();

  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized();
    throw err;
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_IMPORT_FILE_BYTES + MAX_MULTIPART_OVERHEAD_BYTES
  ) {
    return NextResponse.json({ error: "File is too large (max 10MB)" }, { status: 413 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 10MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const result = parseVisitorImportFile(buffer, file.name);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ImportFileError
            ? error.message
            : "Could not parse file. Please upload a valid CSV or XLSX file.",
      },
      { status: 400 },
    );
  }
}
