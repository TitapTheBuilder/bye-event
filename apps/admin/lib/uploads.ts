import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

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
}

export async function saveLogoUpload(buffer: Buffer, contentType: string): Promise<SavedUpload> {
  const extension = EXTENSION_BY_CONTENT_TYPE[contentType];
  if (!extension) throw new Error(`Unsupported logo content type: ${contentType}`);

  const dir = path.join(/* turbopackIgnore: true */ getUploadsDir(), "logos");
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${extension}`;
  const filePath = path.join(/* turbopackIgnore: true */ dir, filename);
  await writeFile(filePath, buffer);

  // Deliberately origin-RELATIVE, so each app resolves it against whatever
  // host the browser is actually on. Baking in an absolute origin here
  // breaks the moment that origin isn't reachable from the viewer's device
  // (the classic case: a `localhost` default, which on a phone means the
  // phone itself).
  return { filePath, url: `/uploads/logos/${filename}`, storagePath: `logos/${filename}` };
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
