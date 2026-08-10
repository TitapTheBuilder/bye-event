import { eq } from "drizzle-orm";
import type { Database } from "./client";
import { type Admin, admins } from "./schema";

export interface CreateAdminInput {
  name: string;
  email: string;
  /** Argon2id hash -- callers must hash the password before reaching here. */
  passwordHash: string;
}

export async function createAdmin(db: Database, input: CreateAdminInput): Promise<Admin> {
  const [row] = await db.insert(admins).values(input).returning();
  if (!row) throw new Error("Failed to create admin");
  return row;
}

export async function getAdminByEmail(db: Database, email: string): Promise<Admin | undefined> {
  const [row] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
  return row;
}

export async function getAdminById(db: Database, id: string): Promise<Admin | undefined> {
  const [row] = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
  return row;
}

export async function listAdmins(db: Database): Promise<Admin[]> {
  return db.select().from(admins);
}

/**
 * The `admins` table has no deactivated_at column (unlike exhibitors and
 * visitors) -- admin accounts are hard-deleted by design. Guard against
 * an admin deleting their own last remaining account at the call site.
 */
export async function deleteAdmin(db: Database, id: string): Promise<void> {
  await db.delete(admins).where(eq(admins.id, id));
}
