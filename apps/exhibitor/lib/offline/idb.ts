import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { CachedVisitor, OutboxEntry } from "./types";

/**
 * Client persistence is IndexedDB (via `idb`), never localStorage --
 * localStorage is synchronous, string-only, and too small for a visitor
 * directory cache plus an unbounded scan outbox.
 */
interface ExhibitionSchema extends DBSchema {
  visitorCache: {
    key: string; // qrToken
    value: CachedVisitor;
  };
  visitOutbox: {
    key: string; // localId
    value: OutboxEntry;
  };
}

const DB_NAME = "exhibition-scanner";
const DB_VERSION = 3;
export const VISITOR_CACHE_TTL_MS = 24 * 60 * 60_000;
export const VISITOR_CACHE_MAX_ENTRIES = 500;

let dbPromise: Promise<IDBPDatabase<ExhibitionSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<ExhibitionSchema>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this environment"));
  }
  if (!dbPromise) {
    dbPromise = openDB<ExhibitionSchema>(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains("visitorCache")) {
          db.createObjectStore("visitorCache", { keyPath: "qrToken" });
        }
        if (!db.objectStoreNames.contains("visitOutbox")) {
          db.createObjectStore("visitOutbox", { keyPath: "localId" });
        }

        if (oldVersion < 3) {
          const outbox = transaction.objectStore("visitOutbox");
          let cursor = await outbox.openCursor();
          while (cursor) {
            if (cursor.value.ownerExhibitorId === undefined) {
              await cursor.update({ ...cursor.value, ownerExhibitorId: null });
            }
            cursor = await cursor.continue();
          }
        }
      },
    });
  }
  return dbPromise;
}

// ---- visitorCache ----------------------------------------------------

export async function cacheVisitor(visitor: Omit<CachedVisitor, "cachedAt">): Promise<void> {
  const db = await getDb();
  await db.put("visitorCache", { ...visitor, cachedAt: new Date().toISOString() });

  const cached = await db.getAll("visitorCache");
  if (cached.length > VISITOR_CACHE_MAX_ENTRIES) {
    cached.sort((a, b) => a.cachedAt.localeCompare(b.cachedAt));
    const stale = cached.slice(0, cached.length - VISITOR_CACHE_MAX_ENTRIES);
    const tx = db.transaction("visitorCache", "readwrite");
    await Promise.all(stale.map((entry) => tx.store.delete(entry.qrToken)));
    await tx.done;
  }
}

export async function getCachedVisitor(qrToken: string): Promise<CachedVisitor | undefined> {
  const db = await getDb();
  const cached = (await db.get("visitorCache", qrToken)) as
    | (CachedVisitor & { name?: string })
    | undefined;
  if (!cached) return undefined;

  const cachedAt = Date.parse(cached.cachedAt);
  if (!Number.isFinite(cachedAt) || Date.now() - cachedAt > VISITOR_CACHE_TTL_MS) {
    await db.delete("visitorCache", qrToken);
    return undefined;
  }

  if (cached.firstName !== undefined && cached.lastName !== undefined) return cached;

  const { name, ...rest } = cached;
  const migrated: CachedVisitor = {
    ...rest,
    firstName: name?.trim() || null,
    lastName: null,
  };
  await db.put("visitorCache", migrated);
  return migrated;
}

export async function removeCachedVisitor(qrToken: string): Promise<void> {
  const db = await getDb();
  await db.delete("visitorCache", qrToken);
}

// ---- visitOutbox -------------------------------------------------------

export async function addOutboxEntry(entry: {
  localId: string;
  qrToken: string;
  scannedAt: string;
}): Promise<void> {
  const db = await getDb();
  const record: OutboxEntry = { ...entry, ownerExhibitorId: null, synced: false };
  await db.put("visitOutbox", record);
}

/**
 * Claims every legacy/pre-login entry in one read-write transaction. IndexedDB
 * serializes write transactions, so another account cannot claim a subset of
 * the same unowned batch concurrently.
 */
export async function claimUnownedOutboxEntries(ownerExhibitorId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("visitOutbox", "readwrite");
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (cursor.value.ownerExhibitorId == null) {
      await cursor.update({ ...cursor.value, ownerExhibitorId });
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function getAllOutboxEntries(): Promise<OutboxEntry[]> {
  const db = await getDb();
  const all = await db.getAll("visitOutbox");
  return all.sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
}

function matchesOwner(
  entry: OutboxEntry,
  ownerExhibitorId: string | null | undefined,
): boolean {
  if (ownerExhibitorId === undefined) return true;
  if (ownerExhibitorId === null) return entry.ownerExhibitorId == null;
  return entry.ownerExhibitorId === ownerExhibitorId;
}

/** Entries the auto-sync loop should attempt to push right now. */
export async function getSyncableOutboxEntries(
  ownerExhibitorId?: string | null,
): Promise<OutboxEntry[]> {
  const all = await getAllOutboxEntries();
  return all.filter(
    (entry) =>
      matchesOwner(entry, ownerExhibitorId) && !entry.synced && !entry.permanentError,
  );
}

/** All not-yet-successfully-synced entries, including permanent errors --
 * used for the "N pending" UI count. */
export async function getUnsyncedOutboxEntries(
  ownerExhibitorId?: string | null,
): Promise<OutboxEntry[]> {
  const all = await getAllOutboxEntries();
  return all.filter((entry) => matchesOwner(entry, ownerExhibitorId) && !entry.synced);
}

export async function markOutboxEntriesSynced(
  localIds: string[],
  ownerExhibitorId?: string,
): Promise<void> {
  if (localIds.length === 0) return;
  const db = await getDb();
  const tx = db.transaction("visitOutbox", "readwrite");
  await Promise.all(
    localIds.map(async (localId) => {
      const existing = await tx.store.get(localId);
      if (!existing || !matchesOwner(existing, ownerExhibitorId)) return;
      await tx.store.put({
        ...existing,
        synced: true,
        lastError: undefined,
        permanentError: false,
      });
    }),
  );
  await tx.done;
}

export async function markOutboxEntryError(
  localId: string,
  error: string,
  permanent: boolean,
  ownerExhibitorId?: string,
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("visitOutbox", "readwrite");
  const existing = await tx.store.get(localId);
  if (existing && matchesOwner(existing, ownerExhibitorId)) {
    await tx.store.put({
      ...existing,
      lastError: error,
      lastAttemptAt: new Date().toISOString(),
      permanentError: permanent,
    });
  }
  await tx.done;
}

/** Manual retry from the scanned-list UI: clears a permanent error so the
 * entry becomes syncable again on the next flush. */
export async function clearOutboxEntryError(localId: string): Promise<void> {
  const db = await getDb();
  const existing = await db.get("visitOutbox", localId);
  if (!existing) return;
  await db.put("visitOutbox", { ...existing, permanentError: false, lastError: undefined });
}

/** Retry previously permanent failures once after a fresh authenticated
 * session. This lets corrected/normalized tokens recover after an app update
 * without continuously hammering truly unknown badges. */
export async function clearAllOutboxEntryErrors(ownerExhibitorId?: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("visitOutbox", "readwrite");
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (cursor.value.permanentError && matchesOwner(cursor.value, ownerExhibitorId)) {
      await cursor.update({
        ...cursor.value,
        permanentError: false,
        lastError: undefined,
      });
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function removeOutboxEntriesByQrToken(qrToken: string): Promise<void> {
  const db = await getDb();
  const canonicalToken = qrToken.trim();
  const tx = db.transaction("visitOutbox", "readwrite");
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (cursor.value.qrToken.trim() === canonicalToken) await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function getOutboxEntryByQrToken(qrToken: string): Promise<OutboxEntry | undefined> {
  const all = await getAllOutboxEntries();
  return all.find((entry) => entry.qrToken === qrToken);
}

/**
 * Clears cached visitor PII and already-synced history on logout while
 * preserving unsynced scans so a temporary sync failure cannot lose data.
 */
export async function clearScannerDataAfterLogout(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["visitorCache", "visitOutbox"], "readwrite");
  await tx.objectStore("visitorCache").clear();
  let cursor = await tx.objectStore("visitOutbox").openCursor();
  while (cursor) {
    if (cursor.value.synced) await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

/** Clears every local record; reserved for explicit resets and tests. */
export async function clearLocalScannerData(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["visitorCache", "visitOutbox"], "readwrite");
  await Promise.all([
    tx.objectStore("visitorCache").clear(),
    tx.objectStore("visitOutbox").clear(),
  ]);
  await tx.done;
}

/** Clears scanner IndexedDB plus runtime caches after the user explicitly asks. */
export async function clearDeviceData(): Promise<void> {
  await clearLocalScannerData();
  if (typeof caches !== "undefined") {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  }
}

/** Test-only escape hatch. */
export async function _clearAllForTests(): Promise<void> {
  await clearLocalScannerData();
}

/** Test-only escape hatch for exercising version upgrades. */
export async function _deleteDatabaseForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.addEventListener("success", () => resolve());
    request.addEventListener("error", () => reject(request.error));
    request.addEventListener("blocked", () => reject(new Error("Database deletion was blocked")));
  });
}
