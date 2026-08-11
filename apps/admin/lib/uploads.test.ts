import { MAX_LOGO_UPLOAD_BYTES } from "@repo/shared/schemas";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  canonicalizeLogoUpload,
  InvalidLogoUploadError,
  MAX_LOGO_DIMENSION,
} from "./uploads";

async function raster(format: "png" | "jpeg" | "webp"): Promise<Buffer> {
  const image = sharp({
    create: {
      width: 32,
      height: 24,
      channels: 4,
      background: { r: 20, g: 40, b: 60, alpha: 0.75 },
    },
  });
  return image[format]().toBuffer();
}

describe("canonicalizeLogoUpload", () => {
  it.each([
    ["png", "image/png"],
    ["jpeg", "image/jpeg"],
    ["webp", "image/webp"],
  ] as const)("decodes %s and emits a canonical PNG", async (format, contentType) => {
    const canonical = await canonicalizeLogoUpload(await raster(format), contentType);
    const metadata = await sharp(canonical).metadata();

    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(32);
    expect(metadata.height).toBe(24);
  });

  it("rejects SVG bytes even when the declared MIME type is allowed", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');

    await expect(canonicalizeLogoUpload(svg, "image/png")).rejects.toBeInstanceOf(
      InvalidLogoUploadError,
    );
  });

  it("rejects animated WebP images", async () => {
    const red = await sharp({
      create: { width: 8, height: 8, channels: 4, background: "red" },
    })
      .png()
      .toBuffer();
    const blue = await sharp({
      create: { width: 8, height: 8, channels: 4, background: "blue" },
    })
      .png()
      .toBuffer();
    const animated = await sharp([red, blue], { join: { animated: true } })
      .webp({ delay: [100, 100], loop: 0 })
      .toBuffer();

    await expect(canonicalizeLogoUpload(animated, "image/webp")).rejects.toThrow(/multi-frame/);
  });

  it("rejects images over the maximum dimensions", async () => {
    const oversized = await sharp({
      create: {
        width: MAX_LOGO_DIMENSION + 1,
        height: 1,
        channels: 3,
        background: "white",
      },
    })
      .png()
      .toBuffer();

    await expect(canonicalizeLogoUpload(oversized, "image/png")).rejects.toThrow(
      /dimensions/,
    );
  });

  it("rejects inputs over the byte limit before decoding", async () => {
    await expect(
      canonicalizeLogoUpload(Buffer.alloc(MAX_LOGO_UPLOAD_BYTES + 1), "image/png"),
    ).rejects.toThrow(/under 5MB/);
  });
});
