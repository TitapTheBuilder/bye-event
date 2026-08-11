import { afterEach, describe, expect, it, vi } from "vitest";
import { isSameOriginRequest } from "./http";

function request(url: string, headers: Record<string, string>): Request {
  const normalized = new Map(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
  return {
    url,
    headers: {
      get(name: string) {
        return normalized.get(name.toLowerCase()) ?? null;
      },
    },
  } as Request;
}

afterEach(() => vi.unstubAllEnvs());

describe("isSameOriginRequest", () => {
  it("accepts a direct same-origin mutation", () => {
    expect(
      isSameOriginRequest(
        request("https://scanner.example.com/api/visits/sync", {
          origin: "https://scanner.example.com",
          host: "scanner.example.com",
        }),
      ),
    ).toBe(true);
  });

  it("accepts the configured public origin behind a trusted reverse proxy", () => {
    vi.stubEnv("EXHIBITOR_PUBLIC_ORIGIN", "https://scanner.example.com");
    expect(
      isSameOriginRequest(
        request("http://exhibitor:3000/api/visits/sync", {
          origin: "https://scanner.example.com",
          host: "exhibitor:3000",
          "x-forwarded-host": "attacker.example",
          "x-forwarded-proto": "http",
        }),
      ),
    ).toBe(true);
  });

  it("rejects a different origin even when forwarded headers are present", () => {
    expect(
      isSameOriginRequest(
        request("http://exhibitor:3000/api/visits/sync", {
          origin: "https://attacker.example",
          host: "exhibitor:3000",
          "x-forwarded-host": "scanner.example.com",
          "x-forwarded-proto": "https",
        }),
      ),
    ).toBe(false);
  });

  it("rejects mutation requests without an Origin header", () => {
    expect(
      isSameOriginRequest(
        request("https://scanner.example.com/api/visits/sync", {
          host: "scanner.example.com",
        }),
      ),
    ).toBe(false);
  });
});
