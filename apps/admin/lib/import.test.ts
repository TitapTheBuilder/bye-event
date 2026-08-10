import { describe, expect, it } from "vitest";
import { parseVisitorImportFile } from "./import";

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
});
