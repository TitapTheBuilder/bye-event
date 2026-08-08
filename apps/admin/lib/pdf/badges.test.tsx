import type { EventSettings, Visitor } from "@repo/db";
import { describe, expect, it } from "vitest";
import { generateBadgePdf } from "./badges";

const visitor: Visitor = {
  id: "019c0000-0000-7000-8000-000000000001",
  qrToken: "persian-pdf-test-token",
  name: "علی رضایی",
  company: "شرکت فناوری تهران",
  phoneNumber: null,
  email: null,
  visitorType: "invited",
  deactivatedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const eventSettings: EventSettings = {
  id: 1,
  businessName: "نمایشگاه تهران",
  logoUrl: null,
  primaryColor: "#6366f1",
  secondaryColor: "#8b5cf6",
  accentColor: "#22d3ee",
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("generateBadgePdf", () => {
  it("renders a Persian invited badge with the bundled font", async () => {
    const pdf = await generateBadgePdf({
      visitorType: "invited",
      visitors: [visitor],
      eventSettings,
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(10_000);
    expect(pdf.toString("latin1")).toContain("/ToUnicode");
  });
});
