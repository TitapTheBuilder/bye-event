import { beforeEach, describe, expect, it } from "vitest";
import {
  _clearAllForTests,
  addOutboxEntry,
  cacheVisitor,
  clearAllOutboxEntryErrors,
  clearLocalScannerData,
  clearOutboxEntryError,
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

describe("visitorCache", () => {
  it("caches and retrieves a visitor by qrToken", async () => {
    await cacheVisitor({
      qrToken: "tok-1",
      name: "Ada Lovelace",
      company: "Analytical Engines Inc",
      phoneNumber: null,
      email: null,
      visitorType: "invited",
    });

    const cached = await getCachedVisitor("tok-1");
    expect(cached?.name).toBe("Ada Lovelace");
    expect(cached?.cachedAt).toBeTruthy();
  });

  it("returns undefined for an uncached token", async () => {
    expect(await getCachedVisitor("missing")).toBeUndefined();
  });

  it("removes a stale cached visitor rejected by the server", async () => {
    await cacheVisitor({
      qrToken: "tok-stale",
      name: "Stale visitor",
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
    await addOutboxEntry({ localId: "b", qrToken: "  tok-1 ", scannedAt: new Date().toISOString() });
    await addOutboxEntry({ localId: "c", qrToken: "tok-2", scannedAt: new Date().toISOString() });

    await removeOutboxEntriesByQrToken("tok-1");

    expect((await getAllOutboxEntries()).map((entry) => entry.localId)).toEqual(["c"]);
  });

  it("clears cached visitor details and every outbox entry on logout", async () => {
    await cacheVisitor({
      qrToken: "tok-private",
      name: "Private visitor",
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

    await clearLocalScannerData();

    expect(await getCachedVisitor("tok-private")).toBeUndefined();
    expect(await getAllOutboxEntries()).toHaveLength(0);
  });

  it("keeps transient errors syncable (they were never marked permanent)", async () => {
    await addOutboxEntry({ localId: "a", qrToken: "tok-1", scannedAt: new Date().toISOString() });
    await markOutboxEntryError("a", "Sync failed", false);

    expect(await getSyncableOutboxEntries()).toHaveLength(1);
  });
});
