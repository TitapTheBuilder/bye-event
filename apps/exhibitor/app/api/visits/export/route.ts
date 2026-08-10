import { db, getExhibitorById, listVisitsForExhibitor } from "@repo/db";
import { formatPersonName } from "@repo/shared/person-name";
import { NextResponse } from "next/server";
import { unauthorized } from "@/lib/http";
import { generateScannedVisitorsPdf } from "@/lib/pdf/scanned-visitors";
import { serializeScannedVisitorsCsv } from "@/lib/scanned-export";
import { requireExhibitorSession, UnauthorizedError } from "@/lib/session";

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
  const date = new Date().toISOString().slice(0, 10);
  const filename = `scanned-visitors-${date}.${format}`;

  if (format === "csv") {
    return new NextResponse(serializeScannedVisitorsCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const exhibitorName = exhibitor
    ? formatPersonName(exhibitor.firstName, exhibitor.lastName)
    : "Exhibitor";
  const pdf = await generateScannedVisitorsPdf(rows, exhibitorName);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
