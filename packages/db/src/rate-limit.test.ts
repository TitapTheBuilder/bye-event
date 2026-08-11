import { describe, expect, it, vi } from "vitest";
import type { Database } from "./client";
import { consumeRateLimit } from "./rate-limit";

function createDatabaseReturning(
  bucket: { requestCount: number; expiresAt: Date } | undefined,
): { db: Database; insert: ReturnType<typeof vi.fn> } {
  const returning = vi.fn().mockResolvedValue(bucket ? [bucket] : []);
  const onConflictDoUpdate = vi.fn(() => ({ returning }));
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));
  return { db: { insert } as unknown as Database, insert };
}

describe("consumeRateLimit", () => {
  it("maps the atomically returned bucket to a limit result", async () => {
    const now = Date.UTC(2026, 0, 1);
    const expiresAt = new Date(now + 60_000);
    const { db, insert } = createDatabaseReturning({ requestCount: 2, expiresAt });

    await expect(
      consumeRateLimit(db, "auth:admin-login:127.0.0.1", {
        windowMs: 60_000,
        maxRequests: 3,
      }, now),
    ).resolves.toEqual({ allowed: true, remaining: 1, resetAt: expiresAt.getTime() });
    expect(insert).toHaveBeenCalledOnce();
  });

  it("blocks once the returned atomic count exceeds the endpoint limit", async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const { db } = createDatabaseReturning({ requestCount: 4, expiresAt });

    const result = await consumeRateLimit(
      db,
      "auth:exhibitor-login:127.0.0.1",
      { windowMs: 60_000, maxRequests: 3 },
    );

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("rejects invalid options before querying Postgres", async () => {
    const { db, insert } = createDatabaseReturning(undefined);

    await expect(
      consumeRateLimit(db, "key", { windowMs: 0, maxRequests: 1 }),
    ).rejects.toThrow("windowMs");
    await expect(
      consumeRateLimit(db, "key", { windowMs: 1000, maxRequests: 0 }),
    ).rejects.toThrow("maxRequests");
    expect(insert).not.toHaveBeenCalled();
  });
});
