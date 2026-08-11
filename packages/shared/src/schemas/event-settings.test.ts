import { describe, expect, it } from "vitest";
import { MAX_LOGO_UPLOAD_BYTES, logoUploadSchema } from "./event-settings";

describe("logoUploadSchema", () => {
  it.each(["image/png", "image/jpeg", "image/webp"])("accepts %s raster uploads", (contentType) => {
    expect(logoUploadSchema.safeParse({ contentType, sizeBytes: 1024 }).success).toBe(true);
  });

  it("rejects SVG uploads", () => {
    expect(
      logoUploadSchema.safeParse({ contentType: "image/svg+xml", sizeBytes: 1024 }).success,
    ).toBe(false);
  });

  it("enforces the upload byte limit", () => {
    expect(
      logoUploadSchema.safeParse({
        contentType: "image/png",
        sizeBytes: MAX_LOGO_UPLOAD_BYTES + 1,
      }).success,
    ).toBe(false);
  });
});
