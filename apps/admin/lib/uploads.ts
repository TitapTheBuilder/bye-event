import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { MAX_LOGO_UPLOAD_BYTES } from "@repo/shared/schemas";
import sharp from "sharp";

/**
 * Storage for admin-uploaded assets (currently just the business-customer
 * logo). Kept behind this one small module so swapping to S3-compatible
 * storage later (per the build spec, either is acceptable) only means
 * rewriting this file.
 *
 * The DATABASE is the system of record: the admin and exhibitor apps are
 * separate containers with no guaranteed shared filesystem (the app
 * Dockerfiles build self-contained single-container images; only
 * docker-compose happens to mount a shared uploads volume), so a logo
 * written only to local disk is a broken image in the other app. Both
 * apps' /uploads/[...path] routes read from the `uploads` table.
 *
 * That database write is done by the caller, not here -- this module is
 * pulled in by badge-PDF rendering, which must stay importable without a
 * live DB connection. What this module owns is the disk copy under
 * UPLOADS_DIR, which node-vibrant colour extraction and badge rendering
 * both need as a real file path.
 */

const ACCEPTED_LOGO_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ACCEPTED_LOGO_FORMATS = new Set(["png", "jpeg", "webp"]);

export const MAX_LOGO_DIMENSION = 4096;
export const MAX_LOGO_PIXELS = 16_000_000;
export const CANONICAL_LOGO_CONTENT_TYPE = "image/png" as const;

export class InvalidLogoUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLogoUploadError";
  }
}

/**
 * Decodes an accepted raster image before trusting it, rejects animated or
 * oversized inputs, and re-encodes it as a metadata-free PNG. The output is
 * what gets persisted and served; neither the client filename nor MIME type
 * determines the stored extension or response content type.
 */
export async function canonicalizeLogoUpload(
  buffer: Buffer,
  declaredContentType: string,
): Promise<Buffer> {
  if (!ACCEPTED_LOGO_CONTENT_TYPES.has(declaredContentType)) {
    throw new InvalidLogoUploadError("Logo must be a PNG, JPEG, or WebP image");
  }
  if (buffer.length === 0 || buffer.length > MAX_LOGO_UPLOAD_BYTES) {
    throw new InvalidLogoUploadError("Logo must be non-empty and under 5MB");
  }

  const image = sharp(buffer, {
    animated: true,
    failOn: "error",
    limitInputPixels: MAX_LOGO_PIXELS,
    sequentialRead: true,
  });

  let metadata: Awaited<ReturnType<typeof image.metadata>>;
  try {
    metadata = await image.metadata();
  } catch {
    throw new InvalidLogoUploadError("Logo could not be decoded as an image");
  }

  if (!metadata.format || !ACCEPTED_LOGO_FORMATS.has(metadata.format)) {
    throw new InvalidLogoUploadError("Logo must be a PNG, JPEG, or WebP image");
  }
  if ((metadata.pages ?? 1) !== 1) {
    throw new InvalidLogoUploadError("Animated or multi-frame logos are not supported");
  }

  const width = metadata.width ?? 0;
  const height = metadata.pageHeight ?? metadata.height ?? 0;
  if (
    width <= 0 ||
    height <= 0 ||
    width > MAX_LOGO_DIMENSION ||
    height > MAX_LOGO_DIMENSION ||
    width * height > MAX_LOGO_PIXELS
  ) {
    throw new InvalidLogoUploadError(
      `Logo dimensions must be at most ${MAX_LOGO_DIMENSION}×${MAX_LOGO_DIMENSION}`,
    );
  }

  let canonical: Buffer;
  try {
    canonical = await image
      .rotate()
      .png({ adaptiveFiltering: true, compressionLevel: 9 })
      .toBuffer();
  } catch {
    throw new InvalidLogoUploadError("Logo could not be converted to PNG");
  }

  if (canonical.length > MAX_LOGO_UPLOAD_BYTES) {
    throw new InvalidLogoUploadError("Converted logo must be under 5MB");
  }
  return canonical;
}

export function getUploadsDir(): string {
  // turbopackIgnore: this is a runtime-only path to a Docker volume /
  // dev-local scratch directory, never part of the app's source tree, so
  // Next's build-time file tracer must not attempt to resolve or bundle
  // whatever it happens to point to.
  return process.env.UPLOADS_DIR ?? path.join(process.cwd(), "../../.uploads");
}

export interface SavedUpload {
  /** Absolute path on disk -- useful for passing straight to node-vibrant. */
  filePath: string;
  /** Origin-relative URL to store in event_settings.logo_url. */
  url: string;
  /** Key for the `uploads` table -- the URL path relative to /uploads/. */
  storagePath: string;
  /** Canonical bytes to persist in the database. */
  data: Buffer;
  contentType: typeof CANONICAL_LOGO_CONTENT_TYPE;
}

export async function saveLogoUpload(buffer: Buffer, contentType: string): Promise<SavedUpload> {
  const data = await canonicalizeLogoUpload(buffer, contentType);
  const dir = path.join(/* turbopackIgnore: true */ getUploadsDir(), "logos");
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.png`;
  const filePath = path.join(/* turbopackIgnore: true */ dir, filename);
  await writeFile(filePath, data);

  // Deliberately origin-RELATIVE, so each app resolves it against whatever
  // host the browser is actually on. Baking in an absolute origin here
  // breaks the moment that origin isn't reachable from the viewer's device
  // (the classic case: a `localhost` default, which on a phone means the
  // phone itself).
  return {
    filePath,
    url: `/uploads/logos/${filename}`,
    storagePath: `logos/${filename}`,
    data,
    contentType: CANONICAL_LOGO_CONTENT_TYPE,
  };
}

const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;

/**
 * Resolves a request path (e.g. ["logos", "abc123.png"]) to an absolute
 * file path, rejecting anything that isn't a single flat filename per
 * segment -- no `..`, no embedded slashes -- so this can never be used to
 * read arbitrary files off the host.
 */
export function resolveUploadPath(segments: string[]): string | null {
  if (segments.length === 0 || !segments.every((s) => SAFE_SEGMENT.test(s))) return null;
  const uploadsDir = path.resolve(/* turbopackIgnore: true */ getUploadsDir());
  const resolved = path.resolve(uploadsDir, ...segments);
  if (!resolved.startsWith(`${uploadsDir}${path.sep}`) && resolved !== uploadsDir) return null;
  return resolved;
}

export async function readUploadedFile(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

/**
 * Maps a stored event_settings.logo_url back to a local disk path when it
 * points at this app's own /uploads/ route -- used by badge PDF generation
 * to hand @react-pdf/renderer a local file path instead of round-tripping
 * the logo back through HTTP to itself.
 */
export function getLocalUploadPathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const marker = "/uploads/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const segments = url
    .slice(index + marker.length)
    .split("/")
    .filter(Boolean);
  return resolveUploadPath(segments);
}
