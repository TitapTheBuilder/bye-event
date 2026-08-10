import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EventSettings, Visitor } from "@repo/db";
import { describe, expect, it } from "vitest";
import { formatGuestBadgeLabel, generateBadgePdf } from "./badges";

const visitor: Visitor = {
  id: "019c0000-0000-7000-8000-000000000001",
  qrToken: "persian-pdf-test-token",
  firstName: "علی",
  lastName: "رضایی",
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
  it("formats unique guest labels in Persian", () => {
    expect(formatGuestBadgeLabel(0)).toBe("مهمان ۱");
    expect(formatGuestBadgeLabel(11)).toBe("مهمان ۱۲");
  });

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

  it("renders fixed-size guest badges with Persian labels", async () => {
    const guestVisitors: Visitor[] = [
      {
        ...visitor,
        id: "019c0000-0000-7000-8000-000000000002",
        visitorType: "guest",
        firstName: null,
        lastName: null,
        company: null,
      },
      {
        ...visitor,
        id: "019c0000-0000-7000-8000-000000000003",
        visitorType: "guest",
        firstName: null,
        lastName: null,
        company: null,
      },
    ];

    const uploadsDir = mkdtempSync(join(tmpdir(), "badge-pdf-"));
    const logosDir = join(uploadsDir, "logos");
    mkdirSync(logosDir);
    writeFileSync(
      join(logosDir, "branding.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><rect width="100" height="40" fill="#123456"/></svg>',
    );
    const previousUploadsDir = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = uploadsDir;

    try {
      const pdf = await generateBadgePdf({
        visitorType: "guest",
        visitors: guestVisitors,
        eventSettings: { ...eventSettings, logoUrl: "/uploads/logos/branding.svg" },
      });

      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.byteLength).toBeGreaterThan(10_000);
      expect(pdf.toString("latin1")).toContain("/MediaBox [0 0 612 792]");
    } finally {
      if (previousUploadsDir === undefined) Reflect.deleteProperty(process.env, "UPLOADS_DIR");
      else process.env.UPLOADS_DIR = previousUploadsDir;
      rmSync(uploadsDir, { recursive: true, force: true });
    }
  });
});
