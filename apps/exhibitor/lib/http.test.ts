import { describe, expect, it } from "vitest";
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

  it("accepts the external HTTPS origin behind a trusted reverse proxy", () => {
    expect(
      isSameOriginRequest(
        request("http://exhibitor:3000/api/visits/sync", {
          origin: "https://192.168.1.25",
          host: "exhibitor:3000",
          "x-forwarded-host": "192.168.1.25",
          "x-forwarded-proto": "https",
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
