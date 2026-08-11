import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { createSessionToken, requireSessionSecret, verifySessionToken } from "./session";

const SECRET = "test-secret-at-least-this-long-for-hs256";
const PAYLOAD = { sub: "user-123", role: "exhibitor", sessionVersion: 4 } as const;

async function signExhibitorToken(
  claims: Record<string, unknown>,
  options: { algorithm?: "HS256" | "HS384"; issuer?: string; audience?: string } = {},
): Promise<string> {
  const algorithm = options.algorithm ?? "HS256";
  return new SignJWT(claims)
    .setProtectedHeader({ alg: algorithm })
    .setSubject("user-123")
    .setIssuer(options.issuer ?? "bye2-exhibitor")
    .setAudience(options.audience ?? "bye2-exhibitor-session")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(SECRET));
}

describe("session tokens", () => {
  it("round-trips id, role, and integer session version", async () => {
    const token = await createSessionToken(PAYLOAD, SECRET, 3600);
    const verified = await verifySessionToken(token, SECRET, "exhibitor");
    expect(verified).toMatchObject({
      sub: "user-123",
      role: "exhibitor",
      sessionVersion: 4,
    });
  });

  it("rejects a token verified against the wrong realm", async () => {
    const token = await createSessionToken(
      { sub: "admin-1", role: "admin", sessionVersion: 0 },
      SECRET,
      3600,
    );
    expect(await verifySessionToken(token, SECRET, "exhibitor")).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken(PAYLOAD, SECRET, 3600);
    expect(
      await verifySessionToken(token, "a-completely-different-secret-value", "exhibitor"),
    ).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await createSessionToken(PAYLOAD, SECRET, -10);
    expect(await verifySessionToken(token, SECRET, "exhibitor")).toBeNull();
  });

  it("rejects tokens without the expected issuer or audience", async () => {
    const wrongIssuer = await signExhibitorToken(
      { role: "exhibitor", sessionVersion: 1 },
      { issuer: "another-issuer" },
    );
    const wrongAudience = await signExhibitorToken(
      { role: "exhibitor", sessionVersion: 1 },
      { audience: "another-audience" },
    );

    expect(await verifySessionToken(wrongIssuer, SECRET, "exhibitor")).toBeNull();
    expect(await verifySessionToken(wrongAudience, SECRET, "exhibitor")).toBeNull();
  });

  it("rejects algorithms other than HS256", async () => {
    const token = await signExhibitorToken(
      { role: "exhibitor", sessionVersion: 1 },
      { algorithm: "HS384" },
    );
    expect(await verifySessionToken(token, SECRET, "exhibitor")).toBeNull();
  });

  it("rejects a missing or non-integer session version", async () => {
    const missing = await signExhibitorToken({ role: "exhibitor" });
    const fractional = await signExhibitorToken({ role: "exhibitor", sessionVersion: 1.5 });

    expect(await verifySessionToken(missing, SECRET, "exhibitor")).toBeNull();
    expect(await verifySessionToken(fractional, SECRET, "exhibitor")).toBeNull();
  });

  it("rejects invalid session versions when creating a token", async () => {
    await expect(
      createSessionToken({ ...PAYLOAD, sessionVersion: -1 }, SECRET, 3600),
    ).rejects.toThrow("sessionVersion");
  });

  it("requires a strong non-development production secret", () => {
    expect(() => requireSessionSecret("short", "ADMIN_SESSION_SECRET", "production")).toThrow(
      "at least 32 characters",
    );
    expect(() =>
      requireSessionSecret(
        "dev-secret-change-me-with-padding-123456789",
        "ADMIN_SESSION_SECRET",
        "production",
      ),
    ).toThrow("development value");
    expect(
      requireSessionSecret(
        "92zVJgKq8RY7XW4QmC3pL6sT1nB5hD0f",
        "ADMIN_SESSION_SECRET",
        "production",
      ),
    ).toHaveLength(32);
  });

  it("allows explicit short secrets outside production for tests", () => {
    expect(requireSessionSecret("injected", "SESSION_SECRET", "test")).toBe("injected");
  });

  it("never embeds PII", async () => {
    const token = await createSessionToken(PAYLOAD, SECRET, 3600);
    const [, payloadB64] = token.split(".");
    const payload = JSON.parse(Buffer.from(payloadB64 ?? "", "base64url").toString("utf8"));
    expect(Object.keys(payload).sort()).toEqual([
      "aud",
      "exp",
      "iat",
      "iss",
      "role",
      "sessionVersion",
      "sub",
    ]);
  });
});
