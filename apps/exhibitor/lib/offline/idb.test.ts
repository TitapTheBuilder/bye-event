import { beforeEach, describe, expect, it } from "vitest";
import {
  _clearAllForTests,
  _deleteDatabaseForTests,
  addOutboxEntry,
  cacheVisitor,
  claimUnownedOutboxEntries,
  clearAllOutboxEntryErrors,
  clearOutboxEntryError,
  clearScannerDataAfterLogout,
  getAllOutboxEntries,
  getCachedVisitor,
  getSyncableOutboxEntries,
  getUnsyncedOutboxEntries,
  markOutboxEntriesSynced,
  markOutboxEntryError,
  removeCachedVisitor,
  removeOutboxEntriesByQrToken,
} from "./idb";

beforeEach(async () => {
  await _clearAllForTests();
});

async function createVersionTwoDatabaseWithLegacyEntry(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("exhibition-scanner", 2);
    request.addEventListener("upgradeneeded", () => {
      request.result.createObjectStore("visitorCache", { keyPath: "qrToken" });
      request.result.createObjectStore("visitOutbox", { keyPath: "localId" });
    });
    request.addEventListener("error", () => reject(request.error));
    request.addEventListener("success", () => {
      const db = request.result;
      const tx = db.transaction("visitOutbox", "readwrite");
      tx.objectStore("visitOutbox").put({
        localId: "legacy",
        qrToken: "tok-legacy",
        scannedAt: "2026-01-01T00:00:00.000Z",
        synced: false,
      });
      tx.addEventListener("complete", () => {
        db.close();
        resolve();
      });
      tx.addEventListener("error", () => reject(tx.error));
    });
  });
}

describe("visitorCache", () => {
  it("caches and retrieves a visitor by qrToken", async () => {
    await cacheVisitor({
      qrToken: "tok-1",
      firstName: "Ada",
      lastName: "Lovelace",
      company: "Analytical Engines Inc",
      phoneNumber: null,
      email: null,
      visitorType: "invited",
    });

    const cached = await getCachedVisitor("tok-1");
    expect(cached?.firstName).toBe("Ada");
    expect(cached?.lastName).toBe("Lovelace");
    expect(cached?.cachedAt).toBeTruthy();
  });

  it("returns undefined for an uncached token", async () => {
    expect(await getCachedVisitor("missing")).toBeUndefined();
  });

  it("removes a stale cached visitor rejected by the server", async () => {
    await cacheVisitor({
      qrToken: "tok-stale",
      firstName: "Stale",
      lastName: "Visitor",
      company: null,
      phoneNumber: null,
      email: null,
      visitorType: "invited",
    });

    await removeCachedVisitor("tok-stale");

    expect(await getCachedVisitor("tok-stale")).toBeUndefined();
  });
});

describe("visitOutbox", () => {
  it("writes an entry immediately, unsynced", async () => {
    await addOutboxEntry({ localId: "a", qrToken: "tok-1", scannedAt: new Date().toISOString() });
    const all = await getAllOutboxEntries();
    expect(all).toHaveLength(1);
    expect(all[0]?.synced).toBe(false);
    expect(all[0]?.ownerExhibitorId).toBeNull();
  });

  it("migrates existing records without an owner as unowned", async () => {
    await _deleteDatabaseForTests();
    await createVersionTwoDatabaseWithLegacyEntry();

    const [legacy] = await getAllOutboxEntries();

    expect(legacy).toMatchObject({
      localId: "legacy",
      ownerExhibitorId: null,
      synced: false,
    });
  });

  it("atomically claims only unowned entries", async () => {
    await addOutboxEntry({ localId: "a", qrToken: "tok-1", scannedAt: new Date().toISOString() });
    await addOutboxEntry({ localId: "b", qrToken: "tok-2", scannedAt: new Date().toISOString() });
    await claimUnownedOutboxEntries("exhibitor-a");
    await addOutboxEntry({ localId: "c", qrToken: "tok-3", scannedAt: new Date().toISOString() });

    await claimUnownedOutboxEntries("exhibitor-b");

    const byId = new Map((await getAllOutboxEntries()).map((entry) => [entry.localId, entry]));
    expect(byId.get("a")?.ownerExhibitorId).toBe("exhibitor-a");
    expect(byId.get("b")?.ownerExhibitorId).toBe("exhibitor-a");
    expect(byId.get("c")?.ownerExhibitorId).toBe("exhibitor-b");
  });

  it("marks entries synced and excludes them from unsynced/syncable lists", async () => {
    await addOutboxEntry({ localId: "a", qrToken: "tok-1", scannedAt: new Date().toISOString() });
    await addOutboxEntry({ localId: "b", qrToken: "tok-2", scannedAt: new Date().toISOString() });

    await markOutboxEntriesSynced(["a"]);

    const unsynced = await getUnsyncedOutboxEntries();
    expect(unsynced.map((e) => e.localId)).toEqual(["b"]);

    const syncable = await getSyncableOutboxEntries();
    expect(syncable.map((e) => e.localId)).toEqual(["b"]);
  });

  it("excludes permanent errors from syncable but keeps them in unsynced", async () => {
    await addOutboxEntry({ localId: "a", qrToken: "tok-1", scannedAt: new Date().toISOString() });
    await markOutboxEntryError("a", "Visitor not found", true);

    expect(await getSyncableOutboxEntries()).toHaveLength(0);
    expect(await getUnsyncedOutboxEntries()).toHaveLength(1);
  });

  it("a new authenticated session can retry all previously permanent errors", async () => {
    await addOutboxEntry({ localId: "a", qrToken: "tok-1", scannedAt: new Date().toISOString() });
    await addOutboxEntry({ localId: "b", qrToken: "tok-2", scannedAt: new Date().toISOString() });
    await markOutboxEntryError("a", "Visitor not found", true);
    await markOutboxEntryError("b", "Visitor not found", true);

    await clearAllOutboxEntryErrors();

    expect(await getSyncableOutboxEntries()).toHaveLength(2);
  });

  it("a manual retry clears a permanent error, making it syncable again", async () => {
    await addOutboxEntry({ localId: "a", qrToken: "tok-1", scannedAt: new Date().toISOString() });
    await markOutboxEntryError("a", "Visitor not found", true);
    expect(await getSyncableOutboxEntries()).toHaveLength(0);

    await clearOutboxEntryError("a");
    expect(await getSyncableOutboxEntries()).toHaveLength(1);
  });

  it("removes all duplicate local events for a QR token", async () => {
    await addOutboxEntry({ localId: "a", qrToken: "tok-1", scannedAt: new Date().toISOString() });
    await addOutboxEntry({
      localId: "b",
      qrToken: "  tok-1 ",
      scannedAt: new Date().toISOString(),
    });
    await addOutboxEntry({ localId: "c", qrToken: "tok-2", scannedAt: new Date().toISOString() });

    await removeOutboxEntriesByQrToken("tok-1");

    expect((await getAllOutboxEntries()).map((entry) => entry.localId)).toEqual(["c"]);
  });

  it("clears cached visitor details but preserves unsynced entries on logout", async () => {
    await cacheVisitor({
      qrToken: "tok-private",
      firstName: "Private",
      lastName: "Visitor",
      company: null,
      phoneNumber: null,
      email: null,
      visitorType: "invited",
    });
    await addOutboxEntry({
      localId: "private-scan",
      qrToken: "tok-private",
      scannedAt: new Date().toISOString(),
    });
    await addOutboxEntry({
      localId: "synced-scan",
      qrToken: "tok-synced",
      scannedAt: new Date().toISOString(),
    });
    await claimUnownedOutboxEntries("exhibitor-a");
    await markOutboxEntriesSynced(["synced-scan"], "exhibitor-a");

    await clearScannerDataAfterLogout();

    expect(await getCachedVisitor("tok-private")).toBeUndefined();
    const remaining = await getAllOutboxEntries();
    expect(remaining.map((entry) => entry.localId)).toEqual(["private-scan"]);
    expect(remaining[0]?.synced).toBe(false);
    expect(remaining[0]?.ownerExhibitorId).toBe("exhibitor-a");
  });

  it("keeps transient errors syncable (they were never marked permanent)", async () => {
    await addOutboxEntry({ localId: "a", qrToken: "tok-1", scannedAt: new Date().toISOString() });
    await markOutboxEntryError("a", "Sync failed", false);

    expect(await getSyncableOutboxEntries()).toHaveLength(1);
  });
});
