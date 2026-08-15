import { db, getExhibitorById, listVisitsForExhibitor } from "@repo/db";
import { formatPersonName } from "@repo/shared/person-name";
import { NextResponse } from "next/server";
import { forbiddenOrigin, isSameOriginRequest, unauthorized } from "@/lib/http";
import { generateScannedVisitorsPdf, type PdfScannedVisitorRow } from "@/lib/pdf/scanned-visitors";
import {
  MAX_SCANNED_EXPORT_RECORDS,
  serializeScannedVisitorsCsv,
} from "@/lib/scanned-export";
import { getExhibitorSession, requireExhibitorSession, UnauthorizedError } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let session: Awaited<ReturnType<typeof requireExhibitorSession>>;
  try {
    session = await requireExhibitorSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized();
    throw err;
  }

  const format = new URL(request.url).searchParams.get("format");
  if (format !== "csv" && format !== "pdf") {
    return NextResponse.json({ error: "Unsupported export format" }, { status: 400 });
  }

  const [rows, exhibitor] = await Promise.all([
    listVisitsForExhibitor(db, session.exhibitorId),
    getExhibitorById(db, session.exhibitorId),
  ]);
  if (rows.length > MAX_SCANNED_EXPORT_RECORDS) {
    return NextResponse.json(
      { error: `Export cannot contain more than ${MAX_SCANNED_EXPORT_RECORDS} records` },
      { status: 413 },
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  const filename = `scanned-visitors-${date}.${format}`;

  if (format === "csv") {
    return new NextResponse(serializeScannedVisitorsCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  try {
    const exhibitorName = exhibitor
      ? formatPersonName(exhibitor.firstName, exhibitor.lastName)
      : "Exhibitor";
    const pdf = await generateScannedVisitorsPdf(rows, exhibitorName);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("PDF export GET failed:", err);
    return NextResponse.json(
      { error: "Failed to generate PDF", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();

  let body: {
    format?: string;
    exhibitorName?: string;
    items?: PdfScannedVisitorRow[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const format = body.format;
  if (format !== "csv" && format !== "pdf") {
    return NextResponse.json({ error: "Unsupported export format" }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length > MAX_SCANNED_EXPORT_RECORDS) {
    return NextResponse.json(
      { error: `Export cannot contain more than ${MAX_SCANNED_EXPORT_RECORDS} records` },
      { status: 413 },
    );
  }

  const date = new Date().toISOString().slice(0, 10);
  const filename = `scanned-visitors-${date}.${format}`;

  if (format === "csv") {
    return new NextResponse(serializeScannedVisitorsCsv(items), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  let exhibitorName = body.exhibitorName?.trim() || "";
  if (!exhibitorName) {
    const session = await getExhibitorSession();
    if (session) {
      const exhibitor = await getExhibitorById(db, session.exhibitorId);
      if (exhibitor) {
        exhibitorName = formatPersonName(exhibitor.firstName, exhibitor.lastName);
      }
    }
  }
  if (!exhibitorName) exhibitorName = "Exhibitor";

  try {
    const pdf = await generateScannedVisitorsPdf(items, exhibitorName);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("PDF export POST failed:", err);
    return NextResponse.json(
      { error: "Failed to generate PDF", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
