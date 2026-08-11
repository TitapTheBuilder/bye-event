import { eq, isNull, sql } from "drizzle-orm";
import type { Database } from "./client";
import { type Exhibitor, exhibitors } from "./schema";

export interface CreateExhibitorInput {
  firstName: string;
  lastName: string;
  username: string;
  phoneNumber: string;
  /** Argon2id hash -- callers must hash the password before reaching here. */
  passwordHash: string;
}

export async function createExhibitor(
  db: Database,
  input: CreateExhibitorInput,
): Promise<Exhibitor> {
  const [row] = await db
    .insert(exhibitors)
    .values({ ...input, firstName: input.firstName.trim(), lastName: input.lastName.trim() })
    .returning();
  if (!row) throw new Error("Failed to create exhibitor");
  return row;
}

export async function getExhibitorByUsername(
  db: Database,
  username: string,
): Promise<Exhibitor | undefined> {
  const [row] = await db
    .select()
    .from(exhibitors)
    .where(eq(exhibitors.username, username))
    .limit(1);
  return row;
}

export async function getExhibitorById(db: Database, id: string): Promise<Exhibitor | undefined> {
  const [row] = await db.select().from(exhibitors).where(eq(exhibitors.id, id)).limit(1);
  return row;
}

export async function getExhibitorSessionState(
  db: Database,
  id: string,
): Promise<{ sessionVersion: number; deactivatedAt: Date | null } | undefined> {
  const [row] = await db
    .select({
      sessionVersion: exhibitors.sessionVersion,
      deactivatedAt: exhibitors.deactivatedAt,
    })
    .from(exhibitors)
    .where(eq(exhibitors.id, id))
    .limit(1);
  return row;
}

export async function bumpExhibitorSessionVersion(
  db: Database,
  id: string,
): Promise<number | undefined> {
  const [row] = await db
    .update(exhibitors)
    .set({ sessionVersion: sql`${exhibitors.sessionVersion} + 1` })
    .where(eq(exhibitors.id, id))
    .returning({ sessionVersion: exhibitors.sessionVersion });
  return row?.sessionVersion;
}

export async function listExhibitors(
  db: Database,
  options: { includeDeactivated?: boolean } = {},
): Promise<Exhibitor[]> {
  const where = options.includeDeactivated ? undefined : isNull(exhibitors.deactivatedAt);
  return db.select().from(exhibitors).where(where);
}

/** Soft-delete: keeps historical visit analytics intact. */
export async function deactivateExhibitor(db: Database, id: string): Promise<void> {
  await db
    .update(exhibitors)
    .set({
      deactivatedAt: new Date(),
      sessionVersion: sql`${exhibitors.sessionVersion} + 1`,
    })
    .where(eq(exhibitors.id, id));
}

export async function reactivateExhibitor(db: Database, id: string): Promise<void> {
  await db
    .update(exhibitors)
    .set({
      deactivatedAt: null,
      sessionVersion: sql`${exhibitors.sessionVersion} + 1`,
    })
    .where(eq(exhibitors.id, id));
}
