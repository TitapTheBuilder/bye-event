import { eq } from "drizzle-orm";
import type { Database } from "./client";
import { type Upload, uploads } from "./schema";

/**
 * Read/write access to admin-uploaded assets. See the `uploads` table in
 * schema.ts for why these live in the database instead of on local disk:
 * the two apps are separate containers with no guaranteed shared volume.
 *
 * `path` is always the URL path relative to /uploads/, e.g.
 * "logos/abc123.png" for /uploads/logos/abc123.png.
 */
export async function putUpload(
  db: Database,
  path: string,
  contentType: string,
  data: Buffer,
): Promise<void> {
  await db
    .insert(uploads)
    .values({ path, contentType, data })
    .onConflictDoUpdate({ target: uploads.path, set: { contentType, data } });
}

export async function getUpload(db: Database, path: string): Promise<Upload | undefined> {
  const [row] = await db.select().from(uploads).where(eq(uploads.path, path)).limit(1);
  return row;
}
