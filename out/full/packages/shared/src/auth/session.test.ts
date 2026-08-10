import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./session";

const SECRET = "test-secret-at-least-this-long-for-hs256";

describe("session tokens", () => {
  it("round-trips id + role", async () => {
    const token = await createSessionToken({ sub: "user-123", role: "exhibitor" }, SECRET, 3600);
    const verified = await verifySessionToken(token, SECRET, "exhibitor");
    expect(verified?.sub).toBe("user-123");
    expect(verified?.role).toBe("exhibitor");
  });

  it("rejects a token verified against the wrong role", async () => {
    const token = await createSessionToken({ sub: "admin-1", role: "admin" }, SECRET, 3600);
    const verified = await verifySessionToken(token, SECRET, "exhibitor");
    expect(verified).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken({ sub: "user-123", role: "exhibitor" }, SECRET, 3600);
    const verified = await verifySessionToken(token, "a-completely-different-secret-value", "exhibitor");
    expect(verified).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await createSessionToken({ sub: "user-123", role: "exhibitor" }, SECRET, -10);
    const verified = await verifySessionToken(token, SECRET, "exhibitor");
    expect(verified).toBeNull();
  });

  it("rejects a token with no role claim", async () => {
    const bareToken = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-123")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(SECRET));
    const verified = await verifySessionToken(bareToken, SECRET, "exhibitor");
    expect(verified).toBeNull();
  });

  it("never embeds PII -- only role and subject are present as claims", async () => {
    const token = await createSessionToken({ sub: "user-123", role: "exhibitor" }, SECRET, 3600);
    const [, payloadB64] = token.split(".");
    const payload = JSON.parse(Buffer.from(payloadB64 ?? "", "base64url").toString("utf8"));
    expect(Object.keys(payload).sort()).toEqual(["exp", "iat", "role", "sub"]);
  });
});
