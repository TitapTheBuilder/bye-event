import type { ScannedVisitorRow } from "@repo/db";
import { describe, expect, it } from "vitest";
import {
  MAX_SCANNED_EXPORT_RECORDS,
  serializeScannedVisitorsCsv,
} from "./scanned-export";

const row: ScannedVisitorRow = {
  visitorId: "019c0000-0000-7000-8000-000000000001",
  shortCode: "TEST-321",
  firstName: "Ada",
  lastName: "Lovelace",
  company: "Analytical Engines",
  phoneNumber: "+1 555 0100",
  email: "ada@example.com",
  visitorType: "invited",
  qrToken: "private-token",
  shortCode: null,
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

  it.each(["=1+1", "+1+1", "-1+1", "@SUM(1,1)", "\t=1+1", "\r=1+1"])(
    "neutralizes spreadsheet formula prefix in %j",
    (company) => {
      const csv = serializeScannedVisitorsCsv([{ ...row, company }]);
      const escaped = `'${company}`.replaceAll('"', '""');

      expect(csv).toContain(`"${escaped}"`);
    },
  );

  it("rejects exports over the record limit", () => {
    const rows = Array.from({ length: MAX_SCANNED_EXPORT_RECORDS + 1 }, () => row);

    expect(() => serializeScannedVisitorsCsv(rows)).toThrow(/more than/);
  });
});
