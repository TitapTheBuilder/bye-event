import { beforeEach, describe, expect, it, vi } from "vitest";
import { _clearAllForTests, getAllOutboxEntries } from "./idb";
import { recordScan } from "./scan";
import { syncEngine } from "./sync-engine";

beforeEach(async () => {
  await _clearAllForTests();
});

describe("recordScan", () => {
  it("writes to the outbox immediately, before any network/login check", async () => {
    const requestFlushSpy = vi.spyOn(syncEngine, "requestFlush").mockImplementation(() => {});

    const { localId } = await recordScan("tok-1");

    const entries = await getAllOutboxEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.localId).toBe(localId);
    expect(entries[0]?.qrToken).toBe("tok-1");
    expect(entries[0]?.synced).toBe(false);
    expect(requestFlushSpy).toHaveBeenCalled();

    requestFlushSpy.mockRestore();
  });

  it("normalizes surrounding whitespace before writing the event", async () => {
    vi.spyOn(syncEngine, "requestFlush").mockImplementation(() => {});

    await recordScan("  tok-1\n");

    const [entry] = await getAllOutboxEntries();
    expect(entry?.qrToken).toBe("tok-1");
    vi.restoreAllMocks();
  });

  it("generates a distinct localId per scan, even of the same badge", async () => {
    vi.spyOn(syncEngine, "requestFlush").mockImplementation(() => {});

    const first = await recordScan("tok-1");
    const second = await recordScan("tok-1");

    expect(first.localId).not.toBe(second.localId);
    const entries = await getAllOutboxEntries();
    expect(entries).toHaveLength(2);

    vi.restoreAllMocks();
  });
});
