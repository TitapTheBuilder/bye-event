import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Database } from "./client";
import { rateLimitBuckets } from "./schema";

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Atomically consumes one request from a fixed-window bucket shared by all
 * application instances using the same Postgres database.
 */
export async function consumeRateLimit(
  db: Database,
  key: string,
  options: RateLimitOptions,
  nowMs = Date.now(),
): Promise<RateLimitResult> {
  if (!key) throw new Error("Rate-limit key must not be empty");
  if (!Number.isSafeInteger(options.windowMs) || options.windowMs <= 0) {
    throw new Error("Rate-limit windowMs must be a positive integer");
  }
  if (!Number.isSafeInteger(options.maxRequests) || options.maxRequests <= 0) {
    throw new Error("Rate-limit maxRequests must be a positive integer");
  }

  const now = new Date(nowMs);
  const expiresAt = new Date(nowMs + options.windowMs);
  const nowStr = now.toISOString();
  const expiresAtStr = expiresAt.toISOString();
  // Rate-limit identifiers can include an IP address or normalized account
  // name. Persist only a one-way digest so this abuse-control table does not
  // become another source of personal data.
  const digest = createHash("sha256").update(key).digest("hex");
  const [bucket] = await db
    .insert(rateLimitBuckets)
    .values({ key: digest, requestCount: 1, expiresAt })
    .onConflictDoUpdate({
      target: rateLimitBuckets.key,
      set: {
        requestCount: sql<number>`case
          when ${rateLimitBuckets.expiresAt} <= ${nowStr} then 1
          else ${rateLimitBuckets.requestCount} + 1
        end`,
        expiresAt: sql<Date>`case
          when ${rateLimitBuckets.expiresAt} <= ${nowStr} then ${expiresAtStr}
          else ${rateLimitBuckets.expiresAt}
        end`,
      },
    })
    .returning({
      requestCount: rateLimitBuckets.requestCount,
      expiresAt: rateLimitBuckets.expiresAt,
    });

  if (!bucket) throw new Error("Failed to consume rate-limit bucket");

  return {
    allowed: bucket.requestCount <= options.maxRequests,
    remaining: Math.max(0, options.maxRequests - bucket.requestCount),
    resetAt: bucket.expiresAt.getTime(),
  };
}
