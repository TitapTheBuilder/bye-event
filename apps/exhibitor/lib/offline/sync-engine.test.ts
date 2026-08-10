import { beforeEach, describe, expect, it, vi } from "vitest";
import { _clearAllForTests, addOutboxEntry, getAllOutboxEntries } from "./idb";
import { SyncEngine } from "./sync-engine";

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", { value, configurable: true });
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

beforeEach(async () => {
  await _clearAllForTests();
  setOnline(true);
  vi.useRealTimers();
});

describe("SyncEngine", () => {
  it("does not call the network when not authenticated -- entries stay local", async () => {
    const fetchMock = vi.fn();
    const engine = new SyncEngine(fetchMock as unknown as typeof fetch);
    await addOutboxEntry({ localId: "a", qrToken: "tok-1", scannedAt: new Date().toISOString() });

    await engine.flush();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(engine.getStatus()).toBe("signed-out");
  });

  it("does not call the network while offline, even if authenticated", async () => {
    setOnline(false);
    const fetchMock = vi.fn();
    const engine = new SyncEngine(fetchMock as unknown as typeof fetch);
    engine.setAuthenticated(true);
    await addOutboxEntry({ localId: "a", qrToken: "tok-1", scannedAt: new Date().toISOString() });

    await engine.flush();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(engine.getStatus()).toBe("offline");
  });

  it("flushes queued entries once authenticated and online, marking them synced", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ results: [{ localId: "a", status: "synced" }] }));
    const engine = new SyncEngine(fetchMock as unknown as typeof fetch);
    await addOutboxEntry({ localId: "a", qrToken: "tok-1", scannedAt: new Date().toISOString() });

    engine.setAuthenticated(true);
    await engine.flush();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/visits/sync",
      expect.objectContaining({ method: "POST" }),
    );
    const [entry] = await getAllOutboxEntries();
    expect(entry?.synced).toBe(true);
    expect(engine.getStatus()).toBe("idle");
  });

  it("drains a scan queued while another flush is in flight", async () => {
    let resolveFirstResponse: ((response: Response) => void) | undefined;
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirstResponse = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => firstResponse)
      .mockResolvedValueOnce(jsonResponse({ results: [{ localId: "b", status: "synced" }] }));
    const engine = new SyncEngine(fetchMock as unknown as typeof fetch);
    await addOutboxEntry({ localId: "a", qrToken: "tok-1", scannedAt: new Date().toISOString() });

    engine.setAuthenticated(true);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await addOutboxEntry({ localId: "b", qrToken: "tok-2", scannedAt: new Date().toISOString() });
    engine.requestFlush();
    resolveFirstResponse?.(jsonResponse({ results: [{ localId: "a", status: "synced" }] }));

    await vi.waitFor(async () => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect((await getAllOutboxEntries()).every((entry) => entry.synced)).toBe(true);
    });
  });

  it("logging in flushes the ENTIRE outbox accumulated before login, not just new entries", async () => {
    await addOutboxEntry({
      localId: "pre-1",
      qrToken: "tok-1",
      scannedAt: new Date().toISOString(),
    });
    await addOutboxEntry({
      localId: "pre-2",
      qrToken: "tok-2",
      scannedAt: new Date().toISOString(),
    });

    const fetchMock = vi.fn().mockImplementation(async (_url, init) => {
      const body = JSON.parse((init as RequestInit).body as string) as {
        entries: { localId: string }[];
      };
      return jsonResponse({
        results: body.entries.map((e) => ({ localId: e.localId, status: "synced" })),
      });
    });
    const engine = new SyncEngine(fetchMock as unknown as typeof fetch);

    // setAuthenticated(true) triggers the flush itself (fire-and-forget);
    // wait a tick then explicitly flush to make the assertion deterministic.
    engine.setAuthenticated(true);
    await engine.flush();

    const sentBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(sentBody.entries.map((e: { localId: string }) => e.localId).sort()).toEqual([
      "pre-1",
      "pre-2",
    ]);
    const all = await getAllOutboxEntries();
    expect(all.every((e) => e.synced)).toBe(true);
  });

  it("never sends anything while signed out, then flushes everything on login", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ results: [{ localId: "a", status: "synced" }] }));
    const engine = new SyncEngine(fetchMock as unknown as typeof fetch);

    await addOutboxEntry({ localId: "a", qrToken: "tok-1", scannedAt: new Date().toISOString() });
    await engine.flush();
    expect(fetchMock).not.toHaveBeenCalled();

    engine.setAuthenticated(true);
    await engine.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats a 401 response as signed-out without throwing, and stops trying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    const engine = new SyncEngine(fetchMock as unknown as typeof fetch);
    await addOutboxEntry({ localId: "a", qrToken: "tok-1", scannedAt: new Date().toISOString() });
    engine.setAuthenticated(true);

    await engine.flush();

    expect(engine.getStatus()).toBe("signed-out");
    const [entry] = await getAllOutboxEntries();
    expect(entry?.synced).toBe(false);
  });

  it("retries with backoff on a network failure, without losing the scan", async () => {
    // Deliberately real timers (not vi.useFakeTimers): fake-indexeddb's
    // internal scheduling relies on real macrotasks, so faking global
    // timers here would also freeze IDB request dispatch. Instead we inject
    // a tiny backoff via the constructor and wait for it in real time.
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(jsonResponse({ results: [{ localId: "a", status: "synced" }] }));
    const engine = new SyncEngine(fetchMock as unknown as typeof fetch, {
      initialBackoffMs: 20,
      maxBackoffMs: 100,
    });
    engine.setAuthenticated(true);
    await engine.flush();
    await addOutboxEntry({
      localId: "a",
      qrToken: "tok-1",
      scannedAt: new Date().toISOString(),
    });

    await engine.flush();
    expect(engine.getStatus()).toBe("error");
    expect((await getAllOutboxEntries())[0]?.synced).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await getAllOutboxEntries())[0]?.synced).toBe(true);
  });

  it("marks a permanently-unresolvable entry (unknown qrToken) so it stops being auto-retried", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        results: [
          {
            localId: "a",
            status: "error",
            error: "Visitor not found",
            errorCode: "visitor_not_found",
          },
        ],
      }),
    );
    const engine = new SyncEngine(fetchMock as unknown as typeof fetch);
    engine.setAuthenticated(true);
    await engine.flush();
    await addOutboxEntry({ localId: "a", qrToken: "tok-bad", scannedAt: new Date().toISOString() });

    await engine.flush();
    expect(engine.getStatus()).toBe("error");

    fetchMock.mockClear();
    await engine.flush();
    // A second flush shouldn't even bother calling the network again for
    // an entry the server already told us can never succeed.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries a transient per-entry server failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            { localId: "a", status: "error", error: "Sync failed", errorCode: "sync_failed" },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ results: [{ localId: "a", status: "synced" }] }));
    const engine = new SyncEngine(fetchMock as unknown as typeof fetch, {
      initialBackoffMs: 20,
      maxBackoffMs: 100,
    });
    engine.setAuthenticated(true);
    await engine.flush();
    await addOutboxEntry({ localId: "a", qrToken: "tok-1", scannedAt: new Date().toISOString() });

    await engine.flush();
    expect(engine.getStatus()).toBe("error");

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await getAllOutboxEntries())[0]?.synced).toBe(true);
  });

  it("retries a previously parked token once on the next authenticated session", async () => {
    await addOutboxEntry({ localId: "a", qrToken: "tok-1", scannedAt: new Date().toISOString() });
    const { markOutboxEntryError } = await import("./idb");
    await markOutboxEntryError("a", "Visitor not found", true);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ results: [{ localId: "a", status: "synced" }] }));
    const engine = new SyncEngine(fetchMock as unknown as typeof fetch);

    engine.setAuthenticated(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await engine.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await getAllOutboxEntries())[0]?.synced).toBe(true);
  });

  it("notifies subscribers of status and pending-count changes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ results: [{ localId: "a", status: "synced" }] }));
    const engine = new SyncEngine(fetchMock as unknown as typeof fetch);
    const updates: { status: string; pendingCount: number }[] = [];
    engine.subscribe((state) => updates.push(state));

    await addOutboxEntry({ localId: "a", qrToken: "tok-1", scannedAt: new Date().toISOString() });
    engine.setAuthenticated(true);
    await engine.flush();

    expect(updates.some((u) => u.status === "syncing")).toBe(true);
    expect(updates.at(-1)).toEqual({ status: "idle", pendingCount: 0 });
  });

  it("is idempotent-safe: flushing the same already-synced entries again is a no-op", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ results: [{ localId: "a", status: "synced" }] }));
    const engine = new SyncEngine(fetchMock as unknown as typeof fetch);
    await addOutboxEntry({ localId: "a", qrToken: "tok-1", scannedAt: new Date().toISOString() });
    engine.setAuthenticated(true);

    await engine.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await engine.flush();
    // Nothing left to sync -- no second network call.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
