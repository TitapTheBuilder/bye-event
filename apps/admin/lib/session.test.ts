import { createSessionToken } from "@repo/shared/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = { token: undefined as string | undefined };
  const cookieStore = {
    get: vi.fn(() => (state.token ? { value: state.token } : undefined)),
    set: vi.fn(),
    delete: vi.fn(),
  };
  return {
    state,
    cookieStore,
    db: {},
    getAdminSessionState: vi.fn(),
    bumpAdminSessionVersion: vi.fn(),
  };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mocks.cookieStore),
}));

vi.mock("@repo/db", () => ({
  db: mocks.db,
  getAdminSessionState: mocks.getAdminSessionState,
  bumpAdminSessionVersion: mocks.bumpAdminSessionVersion,
}));

import { clearAdminSession, getAdminSession } from "./session";

const SECRET = "admin-test-secret-at-least-thirty-two-characters";

async function setToken(sessionVersion: number): Promise<void> {
  mocks.state.token = await createSessionToken(
    { sub: "admin-1", role: "admin", sessionVersion },
    SECRET,
    3600,
  );
}

describe("admin sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_SESSION_SECRET", SECRET);
    mocks.state.token = undefined;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a token only while the admin exists at the same version", async () => {
    await setToken(2);
    mocks.getAdminSessionState.mockResolvedValue({ sessionVersion: 2 });

    await expect(getAdminSession()).resolves.toEqual({ adminId: "admin-1" });
    expect(mocks.getAdminSessionState).toHaveBeenCalledWith(mocks.db, "admin-1");
  });

  it("rejects deleted admins and stale session versions", async () => {
    await setToken(2);
    mocks.getAdminSessionState.mockResolvedValueOnce(undefined);
    await expect(getAdminSession()).resolves.toBeNull();

    mocks.getAdminSessionState.mockResolvedValueOnce({ sessionVersion: 3 });
    await expect(getAdminSession()).resolves.toBeNull();
  });

  it("bumps the database version before clearing the cookie on logout", async () => {
    await setToken(2);
    mocks.getAdminSessionState.mockResolvedValue({ sessionVersion: 2 });
    mocks.bumpAdminSessionVersion.mockResolvedValue(3);

    await clearAdminSession();

    expect(mocks.bumpAdminSessionVersion).toHaveBeenCalledWith(mocks.db, "admin-1");
    expect(mocks.cookieStore.delete).toHaveBeenCalledWith("admin_session");
    expect(mocks.bumpAdminSessionVersion.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.cookieStore.delete.mock.invocationCallOrder[0] ?? 0,
    );
  });
});
