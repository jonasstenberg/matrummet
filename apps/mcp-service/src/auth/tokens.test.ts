import { describe, expect, it } from "vitest";

import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "./tokens.js";

const base = { email: "user@example.com", role: "user", scope: "api", clientId: "client-1" };

describe("tokens", () => {
  it("signs and verifies an access token with a numeric expiry", async () => {
    const { token, expiresIn } = await signAccessToken(base);
    expect(expiresIn).toBeGreaterThan(0);
    const claims = await verifyAccessToken(token);
    expect(claims.email).toBe(base.email);
    expect(claims.role).toBe("user");
    expect(claims.clientId).toBe("client-1");
    expect(typeof claims.expiresAt).toBe("number");
  });

  it("rejects a refresh token presented as an access token", async () => {
    const { token } = await signRefreshToken(base);
    await expect(verifyAccessToken(token)).rejects.toThrow();
  });

  it("rejects an access token presented as a refresh token", async () => {
    const { token } = await signAccessToken(base);
    await expect(verifyRefreshToken(token)).rejects.toThrow();
  });

  it("carries jti + family on refresh tokens", async () => {
    const { token, jti, familyId } = await signRefreshToken(base);
    const claims = await verifyRefreshToken(token);
    expect(claims.jti).toBe(jti);
    expect(claims.familyId).toBe(familyId);
  });

  it("rejects a tampered token", async () => {
    const { token } = await signAccessToken(base);
    await expect(verifyAccessToken(`${token}x`)).rejects.toThrow();
  });
});
