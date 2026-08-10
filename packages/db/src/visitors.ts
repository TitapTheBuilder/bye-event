import { and, asc, desc, eq, ilike, inArray, isNull, or, type SQL, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Database } from "./client";
import { type NewVisitor, type Visitor, visitors } from "./schema";

export interface CreateVisitorInput {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  visitorType?: "invited" | "guest";
}

function generateQrToken(): string {
  // 32 URL-safe characters (~190 bits of entropy): long, unguessable, and
  // deliberately unrelated to the row's uuidv7 `id` so the printed badge
  // never leaks creation order or becomes enumerable.
  return nanoid(32);
}

/**
 * THE single insert path for creating a Visitor row. Every code path that
 * creates a visitor -- manual add, bulk import, guest generation -- must
 * go through this function (or createVisitorsBulk below). Never insert
 * into `visitors` directly anywhere else; that's how a fresh, independently
 * random `qr_token` is guaranteed on every row.
 */
export async function createVisitor(db: Database, input: CreateVisitorInput): Promise<Visitor> {
  const [row] = await createVisitorsBulk(db, [input]);
  if (!row) throw new Error("Failed to create visitor");
  return row;
}

export async function createVisitorsBulk(
  db: Database,
  inputs: CreateVisitorInput[],
): Promise<Visitor[]> {
  if (inputs.length === 0) return [];
  const values: NewVisitor[] = inputs.map((input) => ({
    firstName: input.firstName?.trim() || null,
    lastName: input.lastName?.trim() || null,
    company: input.company?.trim() || null,
    phoneNumber: input.phoneNumber?.trim() || null,
    email: input.email?.trim() || null,
    visitorType: input.visitorType ?? "invited",
    qrToken: generateQrToken(),
  }));
  return db.insert(visitors).values(values).returning();
}

/** Create `count` blank guest rows, each with its own freshly generated qr_token. */
export async function createGuestVisitors(db: Database, count: number): Promise<Visitor[]> {
  return createVisitorsBulk(
    db,
    Array.from({ length: count }, () => ({ visitorType: "guest" as const })),
  );
}

export async function getVisitorByQrToken(
  db: Database,
  qrToken: string,
): Promise<Visitor | undefined> {
  const [row] = await db
    .select()
    .from(visitors)
    .where(and(eq(visitors.qrToken, qrToken), isNull(visitors.deactivatedAt)))
    .limit(1);
  return row;
}

export async function getVisitorById(db: Database, id: string): Promise<Visitor | undefined> {
  const [row] = await db.select().from(visitors).where(eq(visitors.id, id)).limit(1);
  return row;
}

export interface UpdateVisitorInput {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  visitorType?: "invited" | "guest";
}

export async function updateVisitor(
  db: Database,
  id: string,
  input: UpdateVisitorInput,
): Promise<Visitor | undefined> {
  const normalize = (value: string | null | undefined) =>
    value === undefined ? undefined : value?.trim() || null;
  const [row] = await db
    .update(visitors)
    .set({
      ...input,
      firstName: normalize(input.firstName),
      lastName: normalize(input.lastName),
      company: normalize(input.company),
      phoneNumber: normalize(input.phoneNumber),
      email: normalize(input.email),
    })
    .where(eq(visitors.id, id))
    .returning();
  return row;
}

/** Soft-delete: keeps historical visit analytics intact. */
export async function deactivateVisitor(db: Database, id: string): Promise<void> {
  await db.update(visitors).set({ deactivatedAt: new Date() }).where(eq(visitors.id, id));
}

export async function reactivateVisitor(db: Database, id: string): Promise<void> {
  await db.update(visitors).set({ deactivatedAt: null }).where(eq(visitors.id, id));
}

export interface ListVisitorsOptions {
  search?: string;
  visitorType?: "invited" | "guest";
  includeDeactivated?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "firstName" | "lastName" | "company";
  sortDir?: "asc" | "desc";
}

export async function listVisitors(db: Database, options: ListVisitorsOptions = {}) {
  const {
    search,
    visitorType,
    includeDeactivated = false,
    limit = 50,
    offset = 0,
    sortBy = "createdAt",
    sortDir = "desc",
  } = options;

  const conditions: SQL[] = [];
  if (!includeDeactivated) conditions.push(isNull(visitors.deactivatedAt));
  if (visitorType) conditions.push(eq(visitors.visitorType, visitorType));
  if (search) {
    const like = `%${search}%`;
    const searchCondition = or(
      ilike(visitors.firstName, like),
      ilike(visitors.lastName, like),
      ilike(visitors.company, like),
      ilike(visitors.email, like),
      ilike(visitors.phoneNumber, like),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const orderColumn = visitors[sortBy];
  const orderFn = sortDir === "asc" ? asc : desc;

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(visitors)
    .where(where)
    .orderBy(orderFn(orderColumn))
    .limit(limit)
    .offset(offset);

  return rows;
}

/**
 * Unpaginated read path for admin bulk operations (CSV/XLSX/JSON export,
 * badge PDF generation) where every matching row is genuinely needed, not
 * just a page of them.
 */
export async function listAllVisitorsForExport(
  db: Database,
  options: { visitorType?: "invited" | "guest"; includeDeactivated?: boolean } = {},
): Promise<Visitor[]> {
  const { visitorType, includeDeactivated = false } = options;
  const conditions: SQL[] = [];
  if (!includeDeactivated) conditions.push(isNull(visitors.deactivatedAt));
  if (visitorType) conditions.push(eq(visitors.visitorType, visitorType));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(visitors).where(where).orderBy(desc(visitors.createdAt));
}

export async function getVisitorsByIds(db: Database, ids: string[]): Promise<Visitor[]> {
  if (ids.length === 0) return [];
  return db.select().from(visitors).where(inArray(visitors.id, ids));
}

export async function countVisitors(
  db: Database,
  options: Pick<ListVisitorsOptions, "search" | "visitorType" | "includeDeactivated"> = {},
): Promise<number> {
  const { search, visitorType, includeDeactivated = false } = options;
  const conditions: SQL[] = [];
  if (!includeDeactivated) conditions.push(isNull(visitors.deactivatedAt));
  if (visitorType) conditions.push(eq(visitors.visitorType, visitorType));
  if (search) {
    const like = `%${search}%`;
    const searchCondition = or(
      ilike(visitors.firstName, like),
      ilike(visitors.lastName, like),
      ilike(visitors.company, like),
      ilike(visitors.email, like),
      ilike(visitors.phoneNumber, like),
    );
    if (searchCondition) conditions.push(searchCondition);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db.$count(visitors, where);
  return rows;
}
