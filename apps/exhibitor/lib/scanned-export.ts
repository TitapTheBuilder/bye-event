import type { ScannedVisitorRow } from "@repo/db";

export const MAX_SCANNED_EXPORT_RECORDS = 5000;

const CSV_HEADERS = [
  "firstName",
  "lastName",
  "company",
  "phoneNumber",
  "email",
  "visitorType",
  "scanCount",
  "lastScannedAt",
] as const;

function csvCell(value: string | number | null): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function serializeScannedVisitorsCsv(rows: ScannedVisitorRow[]): string {
  if (rows.length > MAX_SCANNED_EXPORT_RECORDS) {
    throw new RangeError(
      `Export cannot contain more than ${MAX_SCANNED_EXPORT_RECORDS} records`,
    );
  }

  const lines = [CSV_HEADERS.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.firstName,
        row.lastName,
        row.company,
        row.phoneNumber,
        row.email,
        row.visitorType,
        row.scanCount,
        row.lastScannedAt.toISOString(),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}`;
}
