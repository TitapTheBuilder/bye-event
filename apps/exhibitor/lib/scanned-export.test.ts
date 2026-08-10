import type { ScannedVisitorRow } from "@repo/db";
import { describe, expect, it } from "vitest";
import { serializeScannedVisitorsCsv } from "./scanned-export";

const row: ScannedVisitorRow = {
  visitorId: "019c0000-0000-7000-8000-000000000001",
  firstName: "Ada",
  lastName: "Lovelace",
  company: "Analytical Engines",
  phoneNumber: "+1 555 0100",
  email: "ada@example.com",
  visitorType: "invited",
  qrToken: "private-token",
  scanCount: 2,
  lastScannedAt: new Date("2026-08-10T12:00:00.000Z"),
  createdAt: new Date("2026-08-10T11:00:00.000Z"),
};

describe("serializeScannedVisitorsCsv", () => {
  it("exports separate first and last name columns with a UTF-8 BOM", () => {
    const csv = serializeScannedVisitorsCsv([row]);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"firstName","lastName"');
    expect(csv).toContain('"Ada","Lovelace"');
    expect(csv).not.toContain(row.qrToken);
  });

  it("neutralizes spreadsheet formulas", () => {
    const csv = serializeScannedVisitorsCsv([{ ...row, company: '=HYPERLINK("bad")' }]);

    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
  });
});
