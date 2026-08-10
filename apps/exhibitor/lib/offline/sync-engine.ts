import type { VisitSyncResponse } from "@repo/shared/schemas";
import {
  clearAllOutboxEntryErrors,
  getSyncableOutboxEntries,
  getUnsyncedOutboxEntries,
  markOutboxEntriesSynced,
  markOutboxEntryError,
  removeCachedVisitor,
} from "./idb";
import type { SyncStatus } from "./types";

type Listener = (state: { status: SyncStatus; pendingCount: number }) => void;

const INITIAL_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60_000;
const SAFETY_NET_INTERVAL_MS = 30_000;

/**
 * Owns pushing queued scans to POST /api/visits/sync. Only actually sends
 * anything when the exhibitor is authenticated AND online -- otherwise
 * entries simply accumulate on-device, exactly as specified. Kept as a
 * purpose-built module (not a generic offline-caching library) because its
 * semantics -- auth-gated, idempotent-safe retries, immediate full flush
 * on login -- are specific enough to be worth hand-rolling and testing
 * directly.
 */
export class SyncEngine {
  private listeners = new Set<Listener>();
  private status: SyncStatus = "idle";
  private inFlightFlush: Promise<void> | null = null;
  private flushRequested = false;
  private isAuthenticated = false;
  private backoffMs: number;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly fetchImpl: typeof fetch;
  private readonly initialBackoffMs: number;
  private readonly maxBackoffMs: number;

  constructor(
    fetchImpl: typeof fetch = fetch,
    options: { initialBackoffMs?: number; maxBackoffMs?: number } = {},
  ) {
    // `fetch` is a method of the global object: browsers throw
    // "Illegal invocation" when it runs with any other receiver, and storing
    // it on an instance field means `this.fetchImpl(...)` calls it with the
    // SyncEngine as `this`. Bind it once here so every call site is safe.
    this.fetchImpl = fetchImpl.bind(globalThis);
    this.initialBackoffMs = options.initialBackoffMs ?? INITIAL_BACKOFF_MS;
    this.maxBackoffMs = options.maxBackoffMs ?? MAX_BACKOFF_MS;
    this.backoffMs = this.initialBackoffMs;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Call this whenever the app learns whether the exhibitor is logged in
   * (on load, on login, on logout). Transitioning to authenticated
   * triggers an immediate flush of the ENTIRE outbox, including everything
   * accumulated before the account existed on this device.
   */
  setAuthenticated(value: boolean): void {
    const wasAuthenticated = this.isAuthenticated;
    this.isAuthenticated = value;
    if (value && !wasAuthenticated) {
      this.backoffMs = this.initialBackoffMs;
      // A prior app version may have permanently parked a token that is now
      // valid after normalization or an admin correction. Retry such entries
      // once per authenticated session, then park true misses again.
      void clearAllOutboxEntryErrors().finally(() => this.requestFlush());
    } else if (!value) {
      this.clearRetryTimer();
      void this.setStatus("signed-out");
    }
  }

  /** Fire-and-forget trigger, safe to call as often as you like. */
  requestFlush(): void {
    this.flushRequested = true;
    void this.flush();
  }

  /**
   * Concurrent callers (e.g. a scan firing requestFlush() right as the
   * `online` event also fires, or a caller explicitly awaiting flush()
   * right after triggering one indirectly via setAuthenticated) all await
   * the SAME in-flight operation rather than racing separate overlapping
   * requests -- this is what makes flush() safe to call as liberally as
   * the trigger points in §6 require.
   */
  async flush(): Promise<void> {
    if (this.inFlightFlush) return this.inFlightFlush;
    this.flushRequested = true;
    this.inFlightFlush = this.drainFlushRequests().finally(() => {
      this.inFlightFlush = null;
      if (this.flushRequested) this.requestFlush();
    });
    return this.inFlightFlush;
  }

  private async drainFlushRequests(): Promise<void> {
    while (this.flushRequested) {
      this.flushRequested = false;
      await this.doFlush();
    }
  }

  private async doFlush(): Promise<void> {
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await this.setStatus("offline");
        return;
      }

      if (!this.isAuthenticated) {
        await this.setStatus("signed-out");
        return;
      }

      const entries = await getSyncableOutboxEntries();
      if (entries.length === 0) {
        this.clearRetryTimer();
        const remaining = await getUnsyncedOutboxEntries();
        await this.setStatus(remaining.length > 0 ? "error" : "idle");
        return;
      }

      await this.setStatus("syncing");
      const response = await this.fetchImpl("/api/visits/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: entries.map((entry) => ({
            localId: entry.localId,
            qrToken: entry.qrToken,
            scannedAt: entry.scannedAt,
          })),
        }),
      });

      if (response.status === 401) {
        // Session expired/never existed -- not a transient failure, don't
        // back off, just wait for the next explicit login.
        this.isAuthenticated = false;
        await this.setStatus("signed-out");
        return;
      }

      if (!response.ok) {
        throw new Error(`Sync request failed with status ${response.status}`);
      }

      const data = (await response.json()) as VisitSyncResponse;
      const syncedIds: string[] = [];
      for (const result of data.results) {
        if (result.status === "synced") {
          syncedIds.push(result.localId);
        } else {
          // Structured codes avoid coupling retry behavior to translated or
          // rewritten error messages. Keep the legacy text fallback for
          // responses from an older server during rolling deployments.
          const permanent =
            result.errorCode === "visitor_not_found" || result.error === "Visitor not found";
          await markOutboxEntryError(result.localId, result.error ?? "Sync failed", permanent);
          if (permanent) {
            const entry = entries.find((candidate) => candidate.localId === result.localId);
            if (entry) await removeCachedVisitor(entry.qrToken);
          }
        }
      }
      if (syncedIds.length > 0) await markOutboxEntriesSynced(syncedIds);

      this.backoffMs = this.initialBackoffMs;
      const retryable = await getSyncableOutboxEntries();
      if (retryable.length > 0) {
        this.scheduleRetry();
        await this.setStatus("error");
      } else {
        this.clearRetryTimer();
        // Permanent errors (e.g. visitor_not_found) are already surfaced
        // per-item in the scanned list. The global chip should settle to
        // "idle" once there is nothing the sync loop can actually do.
        await this.setStatus("idle");
      }
    } catch (err) {
      // Surface the reason. A flush that dies before the request is even
      // sent is otherwise indistinguishable from a flaky network -- the UI
      // can only ever show a generic "sync issue" for both.
      console.warn("Visit sync flush failed", err);
      await this.setStatus("error");
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    this.clearRetryTimer();
    this.retryTimer = setTimeout(() => {
      this.requestFlush();
    }, this.backoffMs);
    this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
  }

  private clearRetryTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private async setStatus(status: SyncStatus): Promise<void> {
    this.status = status;
    await this.notify();
  }

  private async notify(): Promise<void> {
    const pendingCount = (await getUnsyncedOutboxEntries()).length;
    for (const listener of this.listeners) listener({ status: this.status, pendingCount });
  }
}

/** Singleton used by the whole app; tests construct their own instance. */
export const syncEngine = new SyncEngine();

/**
 * Wires up the trigger points from §6: right after a scan (callers do this
 * themselves via requestFlush), the browser `online` event, tab
 * `visibilitychange`, and a periodic safety-net interval. Returns a
 * cleanup function.
 */
export function registerSyncTriggers(engine: SyncEngine = syncEngine): () => void {
  if (typeof window === "undefined") return () => {};

  const onOnline = () => engine.requestFlush();
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") engine.requestFlush();
  };

  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisibilityChange);
  const interval = setInterval(() => engine.requestFlush(), SAFETY_NET_INTERVAL_MS);

  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    clearInterval(interval);
  };
}
