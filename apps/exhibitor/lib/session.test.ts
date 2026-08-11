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
    getExhibitorSessionState: vi.fn(),
    bumpExhibitorSessionVersion: vi.fn(),
  };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mocks.cookieStore),
}));

vi.mock("@repo/db", () => ({
  db: mocks.db,
  getExhibitorSessionState: mocks.getExhibitorSessionState,
  bumpExhibitorSessionVersion: mocks.bumpExhibitorSessionVersion,
}));

import { clearExhibitorSession, getExhibitorSession } from "./session";

const SECRET = "exhibitor-test-secret-at-least-thirty-two-characters";

async function setToken(sessionVersion: number): Promise<void> {
  mocks.state.token = await createSessionToken(
    { sub: "exhibitor-1", role: "exhibitor", sessionVersion },
    SECRET,
    3600,
  );
}

describe("exhibitor sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("EXHIBITOR_SESSION_SECRET", SECRET);
    mocks.state.token = undefined;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a token only for an active exhibitor at the same version", async () => {
    await setToken(5);
    mocks.getExhibitorSessionState.mockResolvedValue({
      sessionVersion: 5,
      deactivatedAt: null,
    });

    await expect(getExhibitorSession()).resolves.toEqual({ exhibitorId: "exhibitor-1" });
    expect(mocks.getExhibitorSessionState).toHaveBeenCalledWith(mocks.db, "exhibitor-1");
  });

  it("rejects deleted, deactivated, and stale exhibitor sessions", async () => {
    await setToken(5);
    mocks.getExhibitorSessionState.mockResolvedValueOnce(undefined);
    await expect(getExhibitorSession()).resolves.toBeNull();

    mocks.getExhibitorSessionState.mockResolvedValueOnce({
      sessionVersion: 5,
      deactivatedAt: new Date(),
    });
    await expect(getExhibitorSession()).resolves.toBeNull();

    mocks.getExhibitorSessionState.mockResolvedValueOnce({
      sessionVersion: 6,
      deactivatedAt: null,
    });
    await expect(getExhibitorSession()).resolves.toBeNull();
  });

  it("bumps the database version before clearing the cookie on logout", async () => {
    await setToken(5);
    mocks.getExhibitorSessionState.mockResolvedValue({
      sessionVersion: 5,
      deactivatedAt: null,
    });
    mocks.bumpExhibitorSessionVersion.mockResolvedValue(6);

    await clearExhibitorSession();

    expect(mocks.bumpExhibitorSessionVersion).toHaveBeenCalledWith(mocks.db, "exhibitor-1");
    expect(mocks.cookieStore.delete).toHaveBeenCalledWith("exhibitor_session");
    expect(mocks.bumpExhibitorSessionVersion.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.cookieStore.delete.mock.invocationCallOrder[0] ?? 0,
    );
  });
});
