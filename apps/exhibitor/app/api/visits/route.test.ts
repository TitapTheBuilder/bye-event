process.env.DATABASE_URL = "postgres://build:build@127.0.0.1:5432/build";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { requireExhibitorSession, UnauthorizedError } from "@/lib/session";
import { listVisitsForExhibitor } from "@repo/db";
import { isSameOriginRequest } from "@/lib/http";

vi.mock("@/lib/session");
vi.mock("@repo/db");
vi.mock("@/lib/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http")>();
  return {
    ...actual,
    isSameOriginRequest: vi.fn(() => true),
    unauthorized: vi.fn(() => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })),
  };
});

function request(url: string, headers: Record<string, string> = {}): Request {
  const reqHeaders = new Headers(headers);
  return new Request(url, { headers: reqHeaders });
}

describe("GET /api/visits", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 Unauthorized if no valid exhibitor session exists", async () => {
    vi.mocked(requireExhibitorSession).mockRejectedValue(new UnauthorizedError());
    
    const res = await GET(request("https://scanner.example.com/api/visits"));
    expect(res.status).toBe(401);
  });

  it("filters visits strictly by the authenticated exhibitor ID (IDOR prevention)", async () => {
    vi.mocked(requireExhibitorSession).mockResolvedValue({ exhibitorId: "exhibitor-123" });
    vi.mocked(listVisitsForExhibitor).mockResolvedValue([]);
    
    const res = await GET(request("https://scanner.example.com/api/visits?q=test"));
    
    expect(res.status).toBe(200);
    // The handler must explicitly pass the session's exhibitorId, not anything from the request
    expect(listVisitsForExhibitor).toHaveBeenCalledWith(
      expect.anything(),
      "exhibitor-123",
      "test"
    );
  });

  it("rejects admin sessions (cross-realm isolation)", async () => {
    // If an admin token was passed, requireExhibitorSession will throw an UnauthorizedError
    // because it strictly validates the role='exhibitor' claim inside the JWT.
    vi.mocked(requireExhibitorSession).mockRejectedValue(new UnauthorizedError());
    
    const res = await GET(request("https://scanner.example.com/api/visits"));
    expect(res.status).toBe(401);
  });
});
