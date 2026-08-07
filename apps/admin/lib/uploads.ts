import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Local-disk storage for admin-uploaded assets (currently just the
 * business-customer logo). Kept behind a small, disk-specific module so
 * swapping to S3-compatible storage later (per the build spec, either is
 * acceptable) only means rewriting this one file.
 *
 * Storage location is UPLOADS_DIR (wired to a Docker volume in
 * docker-compose.yml so it survives container recreation) -- deliberately
 * NOT apps/admin/public, since files written there at container runtime
 * aren't guaranteed to be served by the standalone Next.js output. Files
 * are served back out by app/uploads/[...path]/route.ts instead.
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
  return process.env.UPLOADS_DIR ?? path.join(process.cwd(), ".uploads");
}

function getAdminPublicOrigin(): string {
  // No trailing slash. Falls back to a relative path in dev, which works
  // fine as long as the exhibitor app is proxied behind the same origin;
  // for a real multi-subdomain deployment, set ADMIN_PUBLIC_URL so the
  // stored logo_url is absolute and resolvable from the exhibitor app too.
  return process.env.ADMIN_PUBLIC_URL?.replace(/\/+$/, "") ?? "";
}

export interface SavedUpload {
  /** Absolute path on disk -- useful for passing straight to node-vibrant. */
  filePath: string;
  /** Absolute, publicly-reachable URL to store in event_settings.logo_url. */
  url: string;
}

export async function saveLogoUpload(buffer: Buffer, contentType: string): Promise<SavedUpload> {
  const extension = EXTENSION_BY_CONTENT_TYPE[contentType];
  if (!extension) throw new Error(`Unsupported logo content type: ${contentType}`);

  const dir = path.join(/* turbopackIgnore: true */ getUploadsDir(), "logos");
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${extension}`;
  const filePath = path.join(/* turbopackIgnore: true */ dir, filename);
  await writeFile(filePath, buffer);

  const relativePath = `/uploads/logos/${filename}`;
  return { filePath, url: `${getAdminPublicOrigin()}${relativePath}` };
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
