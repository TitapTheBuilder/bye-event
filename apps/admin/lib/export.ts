import type { Exhibitor, VisitExportRow, Visitor } from "@repo/db";
import type { ExportEntity, ExportFormat } from "@repo/shared/schemas";
import Papa from "papaparse";
import * as XLSX from "xlsx";

/**
 * CSV/XLSX/JSON export of visitors, exhibitors, and visits, per §7. Full
 * raw database backups are an infra concern (pg_dump on a schedule), not
 * something this needs to reinvent -- this is a flat, human-readable
 * snapshot of each table for the event team.
 */

type ExportRow = Record<string, string | number | null>;

export const MAX_EXPORT_RECORDS = 50_000;
const SPREADSHEET_FORMULA_PREFIX = /^[=+\-@\t\r]/;

function neutralizeSpreadsheetCell(value: string | number | null): string | number | null {
  return typeof value === "string" && SPREADSHEET_FORMULA_PREFIX.test(value)
    ? `'${value}`
    : value;
}

function neutralizeSpreadsheetRows(rows: ExportRow[]): ExportRow[] {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, neutralizeSpreadsheetCell(value)]),
    ),
  );
}

function isoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function visitorsToRows(visitors: Visitor[]): ExportRow[] {
  return visitors.map((v) => ({
    id: v.id,
    qrToken: v.qrToken,
    shortCode: v.shortCode,
    firstName: v.firstName,
    lastName: v.lastName,
    company: v.company,
    phoneNumber: v.phoneNumber,
    email: v.email,
    color: v.color,
    visitorType: v.visitorType,
    deactivatedAt: isoOrNull(v.deactivatedAt),
    createdAt: isoOrNull(v.createdAt),
  }));
}

function exhibitorsToRows(exhibitors: Exhibitor[]): ExportRow[] {
  return exhibitors.map((e) => ({
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    username: e.username,
    phoneNumber: e.phoneNumber,
    deactivatedAt: isoOrNull(e.deactivatedAt),
    createdAt: isoOrNull(e.createdAt),
  }));
}

function visitsToRows(rows: VisitExportRow[]): ExportRow[] {
  return rows.map((r) => ({
    exhibitorId: r.exhibitorId,
    exhibitorFirstName: r.exhibitorFirstName,
    exhibitorLastName: r.exhibitorLastName,
    visitorId: r.visitorId,
    visitorFirstName: r.visitorFirstName,
    visitorLastName: r.visitorLastName,
    visitorCompany: r.visitorCompany,
    visitorType: r.visitorType,
    scanCount: r.scanCount,
    createdAt: isoOrNull(r.createdAt),
    lastScannedAt: isoOrNull(r.lastScannedAt),
  }));
}

export function toExportRows(
  entity: ExportEntity,
  data: { visitors?: Visitor[]; exhibitors?: Exhibitor[]; visits?: VisitExportRow[] },
): ExportRow[] {
  if (entity === "visitors") return visitorsToRows(data.visitors ?? []);
  if (entity === "exhibitors") return exhibitorsToRows(data.exhibitors ?? []);
  return visitsToRows(data.visits ?? []);
}

export interface SerializedExport {
  body: string | Buffer;
  contentType: string;
  filename: string;
}

export function serializeExport(
  entity: ExportEntity,
  format: ExportFormat,
  rows: ExportRow[],
): SerializedExport {
  if (rows.length > MAX_EXPORT_RECORDS) {
    throw new RangeError(`Export cannot contain more than ${MAX_EXPORT_RECORDS} records`);
  }

  const baseName = `${entity}-export-${new Date().toISOString().slice(0, 10)}`;

  if (format === "json") {
    return {
      body: JSON.stringify(rows, null, 2),
      contentType: "application/json",
      filename: `${baseName}.json`,
    };
  }

  const spreadsheetRows = neutralizeSpreadsheetRows(rows);

  if (format === "csv") {
    return {
      body: Papa.unparse(spreadsheetRows),
      contentType: "text/csv",
      filename: `${baseName}.csv`,
    };
  }

  const worksheet = XLSX.utils.json_to_sheet(spreadsheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, entity);
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return {
    body: buffer,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: `${baseName}.xlsx`,
  };
}
