process.env.DATABASE_URL = "postgres://build:build@127.0.0.1:5432/build";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>();
  return {
    ...actual,
    requireAdminSession: vi.fn().mockRejectedValue(new actual.UnauthorizedError()),
    getAdminSession: vi.fn().mockResolvedValue(null),
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

import { GET as getAdmins, POST as postAdmins } from "./admins/route";
import { DELETE as deleteAdmin } from "./admins/[id]/route";
import { GET as getAuthMe } from "./auth/me/route";
import { POST as postBadges } from "./badges/route";
import { GET as getBranding, PATCH as patchBranding } from "./branding/route";
import { POST as postBrandingLogo } from "./branding/logo/route";
import { GET as getDashboard } from "./dashboard/route";
import { GET as getExhibitors } from "./exhibitors/route";
import { PATCH as patchExhibitor } from "./exhibitors/[id]/route";
import { GET as getExport } from "./export/route";
import { GET as getVisitors, POST as postVisitors } from "./visitors/route";
import {
  GET as getVisitorById,
  PATCH as patchVisitorById,
  DELETE as deleteVisitorById,
} from "./visitors/[id]/route";
import { POST as postVisitorGuests } from "./visitors/guests/route";
import { POST as postImportPreview } from "./visitors/import/preview/route";
import { POST as postImportCommit } from "./visitors/import/commit/route";

const req = (url = "https://admin.example.com/api/test", options: RequestInit = {}) =>
  new Request(url, {
    headers: { Origin: "https://admin.example.com", ...options.headers },
    ...options,
  });

const paramsContext = (id: string) => ({ params: Promise.resolve({ id }) });

describe("Admin API Route Handlers - Comprehensive Authentication Gate", () => {
  it("rejects unauthenticated GET /api/admins", async () => {
    const res = await getAdmins();
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated POST /api/admins", async () => {
    const res = await postAdmins(req("https://admin.example.com/api/admins", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated DELETE /api/admins/[id]", async () => {
    const res = await deleteAdmin(
      req("https://admin.example.com/api/admins/123", { method: "DELETE" }),
      paramsContext("123"),
    );
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated GET /api/auth/me", async () => {
    const res = await getAuthMe();
    const data = await res.json();
    expect(data.admin).toBeNull();
  });

  it("rejects unauthenticated POST /api/badges", async () => {
    const res = await postBadges(req("https://admin.example.com/api/badges", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated GET /api/branding", async () => {
    const res = await getBranding();
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated PATCH /api/branding", async () => {
    const res = await patchBranding(
      req("https://admin.example.com/api/branding", { method: "PATCH" }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated POST /api/branding/logo", async () => {
    const res = await postBrandingLogo(
      req("https://admin.example.com/api/branding/logo", { method: "POST" }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated GET /api/dashboard", async () => {
    const res = await getDashboard();
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated GET /api/exhibitors", async () => {
    const res = await getExhibitors(req("https://admin.example.com/api/exhibitors"));
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated PATCH /api/exhibitors/[id]", async () => {
    const res = await patchExhibitor(
      req("https://admin.example.com/api/exhibitors/123", { method: "PATCH" }),
      paramsContext("123"),
    );
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated GET /api/export", async () => {
    const res = await getExport(req("https://admin.example.com/api/export"));
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated GET /api/visitors", async () => {
    const res = await getVisitors(req("https://admin.example.com/api/visitors"));
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated POST /api/visitors", async () => {
    const res = await postVisitors(
      req("https://admin.example.com/api/visitors", { method: "POST" }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated GET /api/visitors/[id]", async () => {
    const res = await getVisitorById(
      req("https://admin.example.com/api/visitors/123"),
      paramsContext("123"),
    );
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated PATCH /api/visitors/[id]", async () => {
    const res = await patchVisitorById(
      req("https://admin.example.com/api/visitors/123", { method: "PATCH" }),
      paramsContext("123"),
    );
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated DELETE /api/visitors/[id]", async () => {
    const res = await deleteVisitorById(
      req("https://admin.example.com/api/visitors/123", { method: "DELETE" }),
      paramsContext("123"),
    );
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated POST /api/visitors/guests", async () => {
    const res = await postVisitorGuests(
      req("https://admin.example.com/api/visitors/guests", { method: "POST" }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated POST /api/visitors/import/preview", async () => {
    const res = await postImportPreview(
      req("https://admin.example.com/api/visitors/import/preview", { method: "POST" }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated POST /api/visitors/import/commit", async () => {
    const res = await postImportCommit(
      req("https://admin.example.com/api/visitors/import/commit", { method: "POST" }),
    );
    expect(res.status).toBe(401);
  });
});
