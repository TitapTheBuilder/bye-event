// @vitest-environment node

import type { ScannedVisitorRow } from "@repo/db";
import { describe, expect, it } from "vitest";
import { generateScannedVisitorsPdf } from "./scanned-visitors";

const row: ScannedVisitorRow = {
  visitorId: "019c0000-0000-7000-8000-000000000001",
  firstName: "علی",
  lastName: "رضایی",
  company: "شرکت فناوری تهران",
  phoneNumber: null,
  email: null,
  visitorType: "invited",
  qrToken: "private-token",
  shortCode: null,
  scanCount: 1,
  lastScannedAt: new Date("2026-08-10T12:00:00.000Z"),
  createdAt: new Date("2026-08-10T12:00:00.000Z"),
};

describe("generateScannedVisitorsPdf", () => {
  it("renders Persian visitor names with the bundled font", async () => {
    const pdf = await generateScannedVisitorsPdf([row], "غرفه‌دار نمونه");

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(10_000);
    expect(pdf.toString("latin1")).toContain("/ToUnicode");
  });
});
