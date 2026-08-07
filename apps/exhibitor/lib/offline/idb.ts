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
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ExhibitionSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<ExhibitionSchema>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this environment"));
  }
  if (!dbPromise) {
    dbPromise = openDB<ExhibitionSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("visitorCache")) {
          db.createObjectStore("visitorCache", { keyPath: "qrToken" });
        }
        if (!db.objectStoreNames.contains("visitOutbox")) {
          db.createObjectStore("visitOutbox", { keyPath: "localId" });
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
}

export async function getCachedVisitor(qrToken: string): Promise<CachedVisitor | undefined> {
  const db = await getDb();
  return db.get("visitorCache", qrToken);
}

// ---- visitOutbox -------------------------------------------------------

export async function addOutboxEntry(entry: {
  localId: string;
  qrToken: string;
  scannedAt: string;
}): Promise<void> {
  const db = await getDb();
  const record: OutboxEntry = { ...entry, synced: false };
  await db.put("visitOutbox", record);
}

export async function getAllOutboxEntries(): Promise<OutboxEntry[]> {
  const db = await getDb();
  const all = await db.getAll("visitOutbox");
  return all.sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
}

/** Entries the auto-sync loop should attempt to push right now. */
export async function getSyncableOutboxEntries(): Promise<OutboxEntry[]> {
  const all = await getAllOutboxEntries();
  return all.filter((entry) => !entry.synced && !entry.permanentError);
}

/** All not-yet-successfully-synced entries, including permanent errors --
 * used for the "N pending" UI count. */
export async function getUnsyncedOutboxEntries(): Promise<OutboxEntry[]> {
  const all = await getAllOutboxEntries();
  return all.filter((entry) => !entry.synced);
}

export async function markOutboxEntriesSynced(localIds: string[]): Promise<void> {
  if (localIds.length === 0) return;
  const db = await getDb();
  const tx = db.transaction("visitOutbox", "readwrite");
  await Promise.all(
    localIds.map(async (localId) => {
      const existing = await tx.store.get(localId);
      if (!existing) return;
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
): Promise<void> {
  const db = await getDb();
  const existing = await db.get("visitOutbox", localId);
  if (!existing) return;
  await db.put("visitOutbox", {
    ...existing,
    lastError: error,
    lastAttemptAt: new Date().toISOString(),
    permanentError: permanent,
  });
}

/** Manual retry from the scanned-list UI: clears a permanent error so the
 * entry becomes syncable again on the next flush. */
export async function clearOutboxEntryError(localId: string): Promise<void> {
  const db = await getDb();
  const existing = await db.get("visitOutbox", localId);
  if (!existing) return;
  await db.put("visitOutbox", { ...existing, permanentError: false, lastError: undefined });
}

export async function removeOutboxEntry(localId: string): Promise<void> {
  const db = await getDb();
  await db.delete("visitOutbox", localId);
}

export async function getOutboxEntryByQrToken(qrToken: string): Promise<OutboxEntry | undefined> {
  const all = await getAllOutboxEntries();
  return all.find((entry) => entry.qrToken === qrToken);
}

/** Test-only escape hatch. */
export async function _clearAllForTests(): Promise<void> {
  const db = await getDb();
  await db.clear("visitorCache");
  await db.clear("visitOutbox");
}
