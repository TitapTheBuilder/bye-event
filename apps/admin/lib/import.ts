import { type VisitorImportRow, visitorImportRowSchema } from "@repo/shared/schemas";
import Papa from "papaparse";
import * as XLSX from "xlsx";

/**
 * Bulk visitor import (CSV/XLSX), per §7: each row is validated
 * independently so a single bad row never blocks the rest of the file --
 * the route handler does a partial-success import (valid rows go in,
 * invalid rows are reported back for correction).
 */

export interface ImportRowResult {
  /** 1-based, counting only non-blank rows -- matches what the preview UI shows. */
  rowNumber: number;
  raw: Record<string, unknown>;
  valid: boolean;
  data?: VisitorImportRow;
  errors?: string[];
}

export interface ParsedImport {
  rows: ImportRowResult[];
  validCount: number;
  invalidCount: number;
}

export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_COLUMNS = 50;
export const MAX_IMPORT_CELL_CHARS = 1000;

export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportFileError";
  }
}

type ImportFormat = "csv" | "xls" | "xlsx";

const ZIP_SIGNATURES = [
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from([0x50, 0x4b, 0x05, 0x06]),
  Buffer.from([0x50, 0x4b, 0x07, 0x08]),
];
const OLE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

function startsWithSignature(buffer: Buffer, signature: Buffer): boolean {
  return buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature);
}

function detectImportFormat(buffer: Buffer, filename: string): ImportFormat {
  const extension = filename.toLowerCase().match(/\.(csv|xlsx|xls)$/)?.[1];
  const isZip = ZIP_SIGNATURES.some((signature) => startsWithSignature(buffer, signature));
  const isOle = startsWithSignature(buffer, OLE_SIGNATURE);

  if (extension === "xlsx") {
    if (!isZip) throw new ImportFileError("XLSX file signature does not match its extension");
    return "xlsx";
  }
  if (extension === "xls") {
    if (!isOle) throw new ImportFileError("XLS file signature does not match its extension");
    return "xls";
  }
  if (extension === "csv") {
    if (isZip || isOle || buffer.includes(0)) {
      throw new ImportFileError("CSV file contains binary spreadsheet data");
    }
    return "csv";
  }
  throw new ImportFileError("File must have a .csv, .xls, or .xlsx extension");
}

function assertCellBounds(rawRows: Record<string, unknown>[], headers: string[] = []): void {
  if (headers.length > MAX_IMPORT_COLUMNS) {
    throw new ImportFileError(`Import cannot contain more than ${MAX_IMPORT_COLUMNS} columns`);
  }

  for (const header of headers) {
    if (header.length > MAX_IMPORT_CELL_CHARS) {
      throw new ImportFileError(`Import cells cannot exceed ${MAX_IMPORT_CELL_CHARS} characters`);
    }
  }

  for (const row of rawRows) {
    let cellCount = 0;
    for (const [key, value] of Object.entries(row)) {
      if (key.length > MAX_IMPORT_CELL_CHARS) {
        throw new ImportFileError(`Import cells cannot exceed ${MAX_IMPORT_CELL_CHARS} characters`);
      }

      const values = key === "__parsed_extra" && Array.isArray(value) ? value : [value];
      cellCount += values.length;
      for (const cell of values) {
        if (typeof cell === "string" && cell.length > MAX_IMPORT_CELL_CHARS) {
          throw new ImportFileError(`Import cells cannot exceed ${MAX_IMPORT_CELL_CHARS} characters`);
        }
      }
    }
    if (cellCount > MAX_IMPORT_COLUMNS) {
      throw new ImportFileError(`Import cannot contain more than ${MAX_IMPORT_COLUMNS} columns`);
    }
  }
}

const HEADER_ALIASES: Record<string, keyof VisitorImportRow> = {
  // Legacy single-name columns are preserved losslessly rather than split
  // heuristically, which would corrupt compound and Persian names.
  name: "firstName",
  fullname: "firstName",
  "full name": "firstName",
  firstname: "firstName",
  "first name": "firstName",
  givenname: "firstName",
  "given name": "firstName",
  lastname: "lastName",
  "last name": "lastName",
  surname: "lastName",
  company: "company",
  organization: "company",
  organisation: "company",
  phone: "phoneNumber",
  phonenumber: "phoneNumber",
  "phone number": "phoneNumber",
  mobile: "phoneNumber",
  "mobile number": "phoneNumber",
  email: "email",
  "e-mail": "email",
  "email address": "email",
  color: "color",
  colour: "color",
};

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

function normalizeRow(raw: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const mapped = HEADER_ALIASES[normalizeKey(key)];
    if (mapped && normalized[mapped] === undefined) normalized[mapped] = value;
  }
  return normalized;
}

function isBlankRow(normalized: Record<string, unknown>): boolean {
  return Object.values(normalized).every((value) => {
    if (value == null) return true;
    return typeof value === "string" ? value.trim().length === 0 : false;
  });
}

function rowsFromCsv(text: string): Record<string, unknown>[] {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    preview: MAX_IMPORT_ROWS + 1,
    skipEmptyLines: "greedy",
  });
  if (result.data.length > MAX_IMPORT_ROWS) {
    throw new ImportFileError(`Import cannot contain more than ${MAX_IMPORT_ROWS} rows`);
  }
  assertCellBounds(result.data, result.meta.fields ?? []);
  return result.data;
}

function rowsFromSpreadsheet(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    sheetRows: MAX_IMPORT_ROWS + 2,
    sheets: 0,
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return [];

  const reference = sheet["!fullref"] ?? sheet["!ref"];
  if (reference) {
    const range = XLSX.utils.decode_range(reference);
    const rowCount = range.e.r - range.s.r + 1;
    const columnCount = range.e.c - range.s.c + 1;
    if (rowCount > MAX_IMPORT_ROWS + 1) {
      throw new ImportFileError(`Import cannot contain more than ${MAX_IMPORT_ROWS} rows`);
    }
    if (columnCount > MAX_IMPORT_COLUMNS) {
      throw new ImportFileError(`Import cannot contain more than ${MAX_IMPORT_COLUMNS} columns`);
    }
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new ImportFileError(`Import cannot contain more than ${MAX_IMPORT_ROWS} rows`);
  }
  assertCellBounds(rows);
  return rows;
}

export function parseVisitorImportFile(buffer: Buffer, filename: string): ParsedImport {
  if (buffer.length === 0) throw new ImportFileError("File is empty");
  if (buffer.length > MAX_IMPORT_FILE_BYTES) {
    throw new ImportFileError("File is too large (max 10MB)");
  }

  const format = detectImportFormat(buffer, filename);
  const rawRows =
    format === "csv" ? rowsFromCsv(buffer.toString("utf-8")) : rowsFromSpreadsheet(buffer);

  const rows: ImportRowResult[] = [];
  for (const raw of rawRows) {
    const normalized = normalizeRow(raw);
    if (isBlankRow(normalized)) continue;

    const parsed = visitorImportRowSchema.safeParse(normalized);
    const rowNumber = rows.length + 1;
    if (parsed.success) {
      rows.push({ rowNumber, raw, valid: true, data: parsed.data });
    } else {
      const errors = parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "row"}: ${issue.message}`,
      );
      rows.push({ rowNumber, raw, valid: false, errors });
    }
  }

  const validCount = rows.filter((r) => r.valid).length;
  return { rows, validCount, invalidCount: rows.length - validCount };
}
