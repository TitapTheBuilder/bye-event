process.env.DATABASE_URL = "postgres://build:build@127.0.0.1:5432/build";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";
import { requireAdminSession, UnauthorizedError } from "@/lib/session";
import { deleteAdmin } from "@repo/db";

vi.mock("@/lib/session");
vi.mock("@repo/db");
vi.mock("@/lib/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http")>();
  return {
    ...actual,
    isSameOriginRequest: vi.fn(() => true),
    unauthorized: vi.fn(() => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })),
    forbiddenOrigin: vi.fn(() => new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })),
  };
});

function request(url: string, headers: Record<string, string> = {}): Request {
  const reqHeaders = new Headers(headers);
  return new Request(url, { headers: reqHeaders });
}

describe("DELETE /api/admins/[id]", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 if the admin token is invalid, missing, or belongs to a deleted admin", async () => {
    // requireAdminSession naturally throws if the admin is deleted (session state check)
    vi.mocked(requireAdminSession).mockRejectedValue(new UnauthorizedError());
    
    const res = await DELETE(request("https://admin.example.com/api/admins/admin-456"), { params: Promise.resolve({ id: "admin-456" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 when attempting to delete one's own account (self-deletion protection)", async () => {
    vi.mocked(requireAdminSession).mockResolvedValue({ adminId: "admin-123" });
    
    const res = await DELETE(request("https://admin.example.com/api/admins/admin-123"), { params: Promise.resolve({ id: "admin-123" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("delete your own");
    expect(deleteAdmin).not.toHaveBeenCalled();
  });

  it("returns 400 when attempting to delete the last remaining admin", async () => {
    vi.mocked(requireAdminSession).mockResolvedValue({ adminId: "admin-123" });
    // deleteAdmin returns false if the constraint fails (e.g. last admin)
    vi.mocked(deleteAdmin).mockResolvedValue(false);
    
    const res = await DELETE(request("https://admin.example.com/api/admins/admin-456"), { params: Promise.resolve({ id: "admin-456" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("last remaining");
    expect(deleteAdmin).toHaveBeenCalledWith(expect.anything(), "admin-456");
  });

  it("returns 200 OK when successfully deleting another admin", async () => {
    vi.mocked(requireAdminSession).mockResolvedValue({ adminId: "admin-123" });
    vi.mocked(deleteAdmin).mockResolvedValue(true);
    
    const res = await DELETE(request("https://admin.example.com/api/admins/admin-456"), { params: Promise.resolve({ id: "admin-456" }) });
    expect(res.status).toBe(200);
    expect(deleteAdmin).toHaveBeenCalledWith(expect.anything(), "admin-456");
  });
});
