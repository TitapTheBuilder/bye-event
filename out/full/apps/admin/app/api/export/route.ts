import { db, listAllVisitsForExport, listAllVisitorsForExport, listExhibitors } from "@repo/db";
import { exportQuerySchema } from "@repo/shared/schemas";
import { serializeExport, toExportRows } from "@/lib/export";
import { unauthorized } from "@/lib/http";
import { requireAdminSession, UnauthorizedError } from "@/lib/session";
import { NextResponse } from "next/server";

/**
 * CSV/XLSX/JSON export of visitors, exhibitors, or visits (§7). Full raw
 * database backups are an infra concern (pg_dump on a schedule), not
 * reinvented here -- this is a flat snapshot for the event team.
 */
export async function GET(request: Request) {
  try {
    await requireAdminSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized();
    throw err;
  }

  const { searchParams } = new URL(request.url);
  const parsed = exportQuerySchema.safeParse({
    entity: searchParams.get("entity"),
    format: searchParams.get("format"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid export request", issues: parsed.error.issues }, {
      status: 400,
    });
  }
  const includeDeactivated = searchParams.get("includeDeactivated") === "true";
  const { entity, format } = parsed.data;

  const rows = toExportRows(entity, {
    visitors: entity === "visitors" ? await listAllVisitorsForExport(db, { includeDeactivated }) : undefined,
    exhibitors: entity === "exhibitors" ? await listExhibitors(db, { includeDeactivated }) : undefined,
    visits: entity === "visits" ? await listAllVisitsForExport(db) : undefined,
  });

  const { body, contentType, filename } = serializeExport(entity, format, rows);
  const bodyBytes = typeof body === "string" ? body : new Uint8Array(body);

  return new NextResponse(bodyBytes, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
