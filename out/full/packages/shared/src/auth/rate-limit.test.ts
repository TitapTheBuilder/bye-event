import { beforeEach, describe, expect, it, vi } from "vitest";
import { _resetRateLimitsForTests, checkRateLimit } from "./rate-limit";

describe("rate limiting", () => {
  beforeEach(() => {
    _resetRateLimitsForTests();
  });

  it("allows requests under the limit", () => {
    const opts = { windowMs: 60_000, maxRequests: 3 };
    expect(checkRateLimit("ip-1", opts).allowed).toBe(true);
    expect(checkRateLimit("ip-1", opts).allowed).toBe(true);
    expect(checkRateLimit("ip-1", opts).allowed).toBe(true);
  });

  it("blocks requests once the limit is exceeded", () => {
    const opts = { windowMs: 60_000, maxRequests: 2 };
    expect(checkRateLimit("ip-2", opts).allowed).toBe(true);
    expect(checkRateLimit("ip-2", opts).allowed).toBe(true);
    expect(checkRateLimit("ip-2", opts).allowed).toBe(false);
  });

  it("tracks separate keys independently", () => {
    const opts = { windowMs: 60_000, maxRequests: 1 };
    expect(checkRateLimit("ip-a", opts).allowed).toBe(true);
    expect(checkRateLimit("ip-b", opts).allowed).toBe(true);
    expect(checkRateLimit("ip-a", opts).allowed).toBe(false);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    try {
      const opts = { windowMs: 1000, maxRequests: 1 };
      expect(checkRateLimit("ip-3", opts).allowed).toBe(true);
      expect(checkRateLimit("ip-3", opts).allowed).toBe(false);
      vi.advanceTimersByTime(1001);
      expect(checkRateLimit("ip-3", opts).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
