process.env.DATABASE_URL = "postgres://build:build@127.0.0.1:5432/build";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { consumeRateLimit, getVisitorByQrToken, getVisitorByShortCode } from "@repo/db";

vi.mock("@repo/db");
vi.mock("@/lib/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http")>();
  return {
    ...actual,
    isSameOriginRequest: vi.fn(() => true),
    forbiddenOrigin: vi.fn(() => new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })),
    getClientIp: vi.fn(() => "127.0.0.1"),
  };
});

function request(body: any): Request {
  return new Request("https://scanner.example.com/api/visitors/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/visitors/lookup", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns 404 for deactivated visitors (implicit via DB exclusion logic)", async () => {
    // getVisitorByQrToken returns undefined for deactivated visitors by design
    vi.mocked(getVisitorByQrToken).mockResolvedValue(undefined);
    vi.mocked(consumeRateLimit).mockResolvedValue({ allowed: true, remaining: 9, resetAt: 0 });

    const res = await POST(request({ identifier: "a".repeat(32) }));
    expect(res.status).toBe(404);
  });

  it("enforces rate limits on high-entropy QR lookups", async () => {
    // Mock the rate limit to deny access
    vi.mocked(consumeRateLimit).mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 10000 });

    const res = await POST(request({ identifier: "a".repeat(32) }));
    expect(res.status).toBe(429);
    expect(consumeRateLimit).toHaveBeenCalledTimes(1);
  });

  it("bypasses rate limits and allows unlimited lookups for 6-digit short codes", async () => {
    vi.mocked(getVisitorByShortCode).mockResolvedValue({
      id: "visitor-1",
      qrToken: "a".repeat(32),
      shortCode: "123456",
      firstName: "Test",
      lastName: "User",
      company: "Company",
      phoneNumber: "123",
      email: "test@example.com",
      color: null,
      visitorType: "invited",
      createdAt: new Date(),
      deactivatedAt: null,
    });

    const res = await POST(request({ identifier: "123456" }));
    expect(res.status).toBe(200);
    
    // consumeRateLimit should NEVER be called for short codes
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(getVisitorByShortCode).toHaveBeenCalledWith(expect.anything(), "123456");

    const json = await res.json();
    expect(json.visitor).toEqual({
      qrToken: "123456",
      firstName: "Test",
      lastName: "User",
      company: "Company",
      phoneNumber: "123",
      email: "test@example.com",
      visitorType: "invited",
    });
    // Ensure sensitive IDs like uuidv7 are not exposed
    expect(json.visitor.id).toBeUndefined();
  });
});
