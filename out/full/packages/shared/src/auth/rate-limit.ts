/**
 * Minimal fixed-window in-memory rate limiter. Good enough for a
 * single-instance self-hosted deployment (the target per the build spec).
 * If this ever needs to run behind a multi-instance/horizontally-scaled
 * deployment, swap the Map for a shared store (Redis/Upstash) behind this
 * same `checkRateLimit` signature -- callers don't need to change.
 */

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

// Periodically forget old buckets so this can't grow unbounded.
const SWEEP_INTERVAL_MS = 5 * 60_000;
let lastSweep = Date.now();

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > windowMs) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  options: { windowMs: number; maxRequests: number },
): RateLimitResult {
  const now = Date.now();
  sweep(now, options.windowMs);

  const existing = buckets.get(key);
  if (!existing || now - existing.windowStart >= options.windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: options.maxRequests - 1, resetAt: now + options.windowMs };
  }

  existing.count += 1;
  const allowed = existing.count <= options.maxRequests;
  return {
    allowed,
    remaining: Math.max(0, options.maxRequests - existing.count),
    resetAt: existing.windowStart + options.windowMs,
  };
}

/** Test-only escape hatch. */
export function _resetRateLimitsForTests(): void {
  buckets.clear();
}
