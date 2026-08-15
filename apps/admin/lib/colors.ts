import { Vibrant } from "node-vibrant/node";

export interface ExtractedBrandColors {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

function isHex(value: string | undefined | null): value is string {
  return typeof value === "string" && HEX_PATTERN.test(value);
}

/**
 * Auto-extracts 3 brand colors from an uploaded logo file, per §7/§8 of the
 * build spec ("2-3 brand colors auto-extracted from the logo... manually
 * overridable via color pickers"). Returns null on failure (e.g. an SVG
 * logo, which node-vibrant/Jimp can't rasterize) so callers can fall back
 * to the existing/default palette rather than erroring the whole upload.
 */
export async function extractBrandColors(input: string | Buffer): Promise<ExtractedBrandColors | null> {
  try {
    const palette = await Vibrant.from(input).getPalette();
    const primary = palette.Vibrant?.hex ?? palette.Muted?.hex;
    const secondary = palette.DarkVibrant?.hex ?? palette.DarkMuted?.hex ?? primary;
    const accent = palette.LightVibrant?.hex ?? palette.LightMuted?.hex ?? primary;

    if (!isHex(primary) || !isHex(secondary) || !isHex(accent)) return null;

    return { primaryColor: primary, secondaryColor: secondary, accentColor: accent };
  } catch {
    return null;
  }
}
