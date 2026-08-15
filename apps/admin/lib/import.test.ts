import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  MAX_IMPORT_CELL_CHARS,
  MAX_IMPORT_COLUMNS,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  parseVisitorImportFile,
} from "./import";

function csvBuffer(text: string): Buffer {
  return Buffer.from(text, "utf-8");
}

describe("parseVisitorImportFile", () => {
  it("parses a well-formed CSV and validates every row", () => {
    const csv =
      "first name,last name,company,phone number,email\nJane,Doe,Acme,+1 555 000 0000,jane@acme.com\n";
    const result = parseVisitorImportFile(csvBuffer(csv), "visitors.csv");

    expect(result.rows).toHaveLength(1);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(0);
    expect(result.rows[0]?.data).toMatchObject({
      firstName: "Jane",
      lastName: "Doe",
      company: "Acme",
      phoneNumber: "+1 555 000 0000",
      email: "jane@acme.com",
    });
  });

  it("parses the canonical color-first CSV format (color, first name, company, last name)", () => {
    const csv = "color,first name,company,last name\nblue,Ali,Tehran Labs,Ahmadi\nyellow,Sara,FaraData,\n";
    const result = parseVisitorImportFile(csvBuffer(csv), "visitors.csv");

    expect(result.validCount).toBe(2);
    expect(result.rows[0]?.data).toMatchObject({
      color: "blue",
      firstName: "Ali",
      company: "Tehran Labs",
      lastName: "Ahmadi",
    });
    expect(result.rows[1]?.data).toMatchObject({
      color: "yellow",
      firstName: "Sara",
      company: "FaraData",
    });
  });

  it("does a partial-success import: valid rows succeed even when others are invalid", () => {
    const csv = [
      "first name,last name,company,email",
      "Jane,Doe,Acme,jane@acme.com",
      "John,Smith,Widgets Inc,not-an-email",
    ].join("\n");
    const result = parseVisitorImportFile(csvBuffer(csv), "visitors.csv");

    expect(result.rows).toHaveLength(2);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(1);

    const [validRow, invalidRow] = result.rows;
    expect(validRow?.valid).toBe(true);
    expect(invalidRow?.valid).toBe(false);
    expect(invalidRow?.errors?.length).toBeGreaterThan(0);
  });

  it("normalizes common header aliases (case-insensitive)", () => {
    const csv =
      "Given Name,Surname,Organization,Mobile,E-mail\nAda,Lovelace,Analytical Engines,555-1234,ada@example.com\n";
    const result = parseVisitorImportFile(csvBuffer(csv), "visitors.csv");

    expect(result.validCount).toBe(1);
    expect(result.rows[0]?.data).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      company: "Analytical Engines",
      phoneNumber: "555-1234",
      email: "ada@example.com",
    });
  });

  it("preserves legacy full-name columns without guessing name boundaries", () => {
    const csv = "Full Name,Company\nMaryam Sadat Hosseini,Tehran Labs\n";
    const result = parseVisitorImportFile(csvBuffer(csv), "visitors.csv");

    expect(result.validCount).toBe(1);
    expect(result.rows[0]?.data).toMatchObject({
      firstName: "Maryam Sadat Hosseini",
      company: "Tehran Labs",
    });
  });

  it("skips fully blank rows instead of reporting them as invalid", () => {
    const csv = "first name,last name,company,email\nJane,Doe,Acme,jane@acme.com\n,,,\n";
    const result = parseVisitorImportFile(csvBuffer(csv), "visitors.csv");

    expect(result.rows).toHaveLength(1);
    expect(result.validCount).toBe(1);
  });

  it("allows every field to be blank except for validated ones (guest-like rows are still valid)", () => {
    const csv = "first name,last name,company,email\n,,Acme,\n";
    const result = parseVisitorImportFile(csvBuffer(csv), "visitors.csv");

    expect(result.rows).toHaveLength(1);
    expect(result.validCount).toBe(1);
    expect(result.rows[0]?.data).toMatchObject({ company: "Acme" });
  });

  it("parses XLSX files after checking their ZIP signature", () => {
    const sheet = XLSX.utils.json_to_sheet([{ "first name": "Ada", email: "ada@example.com" }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Visitors");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const result = parseVisitorImportFile(buffer, "visitors.xlsx");

    expect(result.validCount).toBe(1);
    expect(result.rows[0]?.data?.firstName).toBe("Ada");
  });

  it("rejects spreadsheet extensions whose signatures do not match", () => {
    expect(() => parseVisitorImportFile(csvBuffer("first name\nAda\n"), "visitors.xlsx")).toThrow(
      /signature/,
    );
  });

  it("rejects previews over the row limit", () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, index) => `Visitor ${index}`);
    const csv = ["first name", ...rows].join("\n");

    expect(() => parseVisitorImportFile(csvBuffer(csv), "visitors.csv")).toThrow(/rows/);
  });

  it("rejects previews over the column limit", () => {
    const headers = Array.from({ length: MAX_IMPORT_COLUMNS + 1 }, (_, index) => `column-${index}`);
    const csv = `${headers.join(",")}\n${headers.map(() => "value").join(",")}\n`;

    expect(() => parseVisitorImportFile(csvBuffer(csv), "visitors.csv")).toThrow(/columns/);
  });

  it("counts CSV cells beyond the declared headers", () => {
    const values = Array.from({ length: MAX_IMPORT_COLUMNS + 1 }, () => "value");
    const csv = `first name\n${values.join(",")}\n`;

    expect(() => parseVisitorImportFile(csvBuffer(csv), "visitors.csv")).toThrow(/columns/);
  });

  it("rejects oversized cells", () => {
    const csv = `company\n${"a".repeat(MAX_IMPORT_CELL_CHARS + 1)}\n`;

    expect(() => parseVisitorImportFile(csvBuffer(csv), "visitors.csv")).toThrow(/cells/);
  });

  it("enforces the file byte limit inside the parser", () => {
    expect(() =>
      parseVisitorImportFile(Buffer.alloc(MAX_IMPORT_FILE_BYTES + 1, "a"), "visitors.csv"),
    ).toThrow(/too large/);
  });
});
