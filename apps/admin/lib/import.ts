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
    skipEmptyLines: true,
  });
  return result.data;
}

function rowsFromXlsx(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

export function parseVisitorImportFile(buffer: Buffer, filename: string): ParsedImport {
  const isXlsx = /\.xlsx?$/i.test(filename);
  const rawRows = isXlsx ? rowsFromXlsx(buffer) : rowsFromCsv(buffer.toString("utf-8"));

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
