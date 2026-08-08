import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { Database, DatabaseTransaction } from "./client";
import { exhibitors, type Visit, visitors, visits, visitSyncEvents } from "./schema";

/**
 * The only way a Visit row should ever be written. Idempotent upsert on the
 * (exhibitorId, visitorId) composite primary key: a re-scan of the same
 * pair bumps scan_count/last_scanned_at instead of throwing a unique
 * violation. Event-level retry idempotency is added by syncVisitEvent below.
 */
export async function upsertVisit(
  db: Database | DatabaseTransaction,
  exhibitorId: string,
  visitorId: string,
  scannedAt?: Date,
): Promise<Visit> {
  const timestamp = scannedAt ?? new Date();
  const [row] = await db
    .insert(visits)
    .values({
      exhibitorId,
      visitorId,
      createdAt: timestamp,
      lastScannedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: [visits.exhibitorId, visits.visitorId],
      set: {
        scanCount: sql`${visits.scanCount} + 1`,
        // Never move last_scanned_at backwards if an out-of-order sync
        // retry replays an older scan after a newer one already landed.
        lastScannedAt: sql`GREATEST(${visits.lastScannedAt}, ${timestamp.toISOString()}::timestamptz)`,
      },
    })
    .returning();
  if (!row) throw new Error("Failed to upsert visit");
  return row;
}

/**
 * Atomically records a client scan event and updates its Visit. The localId
 * primary key is the event idempotency key: replaying the same request after
 * a lost response returns success without incrementing scan_count again.
 */
export async function syncVisitEvent(
  db: Database,
  localId: string,
  exhibitorId: string,
  visitorId: string,
  scannedAt: Date,
): Promise<{ duplicate: boolean }> {
  return db.transaction(async (tx) => {
    const [insertedEvent] = await tx
      .insert(visitSyncEvents)
      .values({ localId, exhibitorId, visitorId, scannedAt })
      .onConflictDoNothing({ target: visitSyncEvents.localId })
      .returning({ localId: visitSyncEvents.localId });

    if (!insertedEvent) return { duplicate: true };

    await upsertVisit(tx, exhibitorId, visitorId, scannedAt);
    return { duplicate: false };
  });
}

/**
 * Exhibitor's own "remove from my scanned list" action -- by design this is
 * a hard delete of exactly one Visit row, unlike everything else which
 * soft-deletes.
 */
export async function deleteVisit(
  db: Database,
  exhibitorId: string,
  visitorId: string,
): Promise<void> {
  await db
    .delete(visits)
    .where(and(eq(visits.exhibitorId, exhibitorId), eq(visits.visitorId, visitorId)));
}

export interface ScannedVisitorRow {
  visitorId: string;
  name: string | null;
  company: string | null;
  phoneNumber: string | null;
  email: string | null;
  visitorType: "invited" | "guest";
  qrToken: string;
  scanCount: number;
  lastScannedAt: Date;
  createdAt: Date;
}

export async function listVisitsForExhibitor(
  db: Database,
  exhibitorId: string,
  search?: string,
): Promise<ScannedVisitorRow[]> {
  const conditions: SQL[] = [eq(visits.exhibitorId, exhibitorId)];
  if (search) {
    const like = `%${search}%`;
    const searchCondition = or(ilike(visitors.name, like), ilike(visitors.company, like));
    if (searchCondition) conditions.push(searchCondition);
  }

  const rows = await db
    .select({
      visitorId: visitors.id,
      name: visitors.name,
      company: visitors.company,
      phoneNumber: visitors.phoneNumber,
      email: visitors.email,
      visitorType: visitors.visitorType,
      qrToken: visitors.qrToken,
      scanCount: visits.scanCount,
      lastScannedAt: visits.lastScannedAt,
      createdAt: visits.createdAt,
    })
    .from(visits)
    .innerJoin(visitors, eq(visits.visitorId, visitors.id))
    .where(and(...conditions))
    .orderBy(desc(visits.lastScannedAt));

  return rows;
}

export interface LeaderboardRow {
  exhibitorId: string;
  exhibitorName: string;
  totalVisits: number;
  totalScans: number;
}

export async function getExhibitorLeaderboard(db: Database): Promise<LeaderboardRow[]> {
  const rows = await db
    .select({
      exhibitorId: exhibitors.id,
      exhibitorName: exhibitors.name,
      totalVisits: sql<number>`count(${visits.visitorId})::int`,
      totalScans: sql<number>`coalesce(sum(${visits.scanCount}), 0)::int`,
    })
    .from(exhibitors)
    .leftJoin(visits, eq(visits.exhibitorId, exhibitors.id))
    .groupBy(exhibitors.id, exhibitors.name)
    .orderBy(desc(sql`count(${visits.visitorId})`));

  return rows;
}

export interface ExhibitorForVisitorRow {
  exhibitorId: string;
  exhibitorName: string;
  scanCount: number;
  lastScannedAt: Date;
}

export async function getExhibitorsForVisitor(
  db: Database,
  visitorId: string,
): Promise<ExhibitorForVisitorRow[]> {
  const rows = await db
    .select({
      exhibitorId: exhibitors.id,
      exhibitorName: exhibitors.name,
      scanCount: visits.scanCount,
      lastScannedAt: visits.lastScannedAt,
    })
    .from(visits)
    .innerJoin(exhibitors, eq(visits.exhibitorId, exhibitors.id))
    .where(eq(visits.visitorId, visitorId))
    .orderBy(desc(visits.lastScannedAt));

  return rows;
}

export async function countTotalVisits(db: Database): Promise<number> {
  return db.$count(visits);
}

export interface VisitExportRow {
  exhibitorId: string;
  exhibitorName: string;
  visitorId: string;
  visitorName: string | null;
  visitorCompany: string | null;
  visitorType: "invited" | "guest";
  scanCount: number;
  createdAt: Date;
  lastScannedAt: Date;
}

/** Unpaginated -- backs the admin "data export" feature (CSV/XLSX/JSON). */
export async function listAllVisitsForExport(db: Database): Promise<VisitExportRow[]> {
  const rows = await db
    .select({
      exhibitorId: exhibitors.id,
      exhibitorName: exhibitors.name,
      visitorId: visitors.id,
      visitorName: visitors.name,
      visitorCompany: visitors.company,
      visitorType: visitors.visitorType,
      scanCount: visits.scanCount,
      createdAt: visits.createdAt,
      lastScannedAt: visits.lastScannedAt,
    })
    .from(visits)
    .innerJoin(exhibitors, eq(visits.exhibitorId, exhibitors.id))
    .innerJoin(visitors, eq(visits.visitorId, visitors.id))
    .orderBy(desc(visits.lastScannedAt));
  return rows;
}
