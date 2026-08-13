process.env.DATABASE_URL = "postgres://build:build@127.0.0.1:5432/build";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>();
  return {
    ...actual,
    requireExhibitorSession: vi.fn().mockRejectedValue(new actual.UnauthorizedError()),
    getExhibitorSession: vi.fn().mockResolvedValue(null),
  };
});

vi.mock("@repo/db");
vi.mock("@/lib/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http")>();
  return {
    ...actual,
    isSameOriginRequest: vi.fn(() => true),
  };
});

import { GET as getAuthMe } from "./auth/me/route";
import { GET as getVisits } from "./visits/route";
import { DELETE as deleteVisit } from "./visits/[visitorId]/route";
import { GET as getVisitsExport } from "./visits/export/route";
import { POST as postVisitsSync } from "./visits/sync/route";

const req = (url = "https://scan.example.com/api/test", options: RequestInit = {}) =>
  new Request(url, {
    headers: { Origin: "https://scan.example.com", ...options.headers },
    ...options,
  });

const paramsContext = (visitorId: string) => ({ params: Promise.resolve({ visitorId }) });

describe("Exhibitor API Route Handlers - Comprehensive Authentication Gate", () => {
  it("rejects unauthenticated GET /api/auth/me", async () => {
    const res = await getAuthMe();
    const data = await res.json();
    expect(data.exhibitor).toBeNull();
  });

  it("rejects unauthenticated GET /api/visits", async () => {
    const res = await getVisits(req("https://scan.example.com/api/visits"));
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated DELETE /api/visits/[visitorId]", async () => {
    const res = await deleteVisit(
      req("https://scan.example.com/api/visits/123", { method: "DELETE" }),
      paramsContext("123"),
    );
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated GET /api/visits/export", async () => {
    const res = await getVisitsExport(req("https://scan.example.com/api/visits/export"));
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated POST /api/visits/sync", async () => {
    const res = await postVisitsSync(
      req("https://scan.example.com/api/visits/sync", { method: "POST" }),
    );
    expect(res.status).toBe(401);
  });
});
