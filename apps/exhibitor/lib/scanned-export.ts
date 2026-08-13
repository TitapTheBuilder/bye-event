export const MAX_SCANNED_EXPORT_RECORDS = 5000;

export interface ExportableScannedVisitor {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  phoneNumber: string | null;
  email: string | null;
  visitorType?: "invited" | "guest" | string | null;
  scanCount?: number | null;
  scannedAt?: string | Date | null;
  lastScannedAt?: string | Date | null;
}

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

export function serializeScannedVisitorsCsv(rows: ExportableScannedVisitor[]): string {
  if (rows.length > MAX_SCANNED_EXPORT_RECORDS) {
    throw new RangeError(
      `Export cannot contain more than ${MAX_SCANNED_EXPORT_RECORDS} records`,
    );
  }

  const lines = [CSV_HEADERS.map(csvCell).join(",")];
  for (const row of rows) {
    const timestamp = row.lastScannedAt ?? row.scannedAt;
    const dateStr =
      timestamp instanceof Date
        ? timestamp.toISOString()
        : typeof timestamp === "string"
          ? timestamp
          : "";

    lines.push(
      [
        row.firstName,
        row.lastName,
        row.company,
        row.phoneNumber,
        row.email,
        row.visitorType ?? "invited",
        row.scanCount ?? 1,
        dateStr,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `\uFEFF${lines.join("\r\n")}`;
}
