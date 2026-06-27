import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";

import type { StoredCode, StoredRefresh } from "./store.js";

// In-memory fake store so provider logic runs under node-vitest (no bun:sqlite).
const h = vi.hoisted(() => {
  const codes = new Map<string, StoredCode>();
  const refresh = new Map<string, StoredRefresh>();
  const store = {
    putCode: (hash: string, code: StoredCode) => codes.set(hash, code),
    getCode: (hash: string) => codes.get(hash),
    consumeCode: (hash: string) => {
      const c = codes.get(hash);
      codes.delete(hash);
      return c;
    },
    insertRefresh: (r: StoredRefresh) => refresh.set(r.jti, { ...r }),
    getRefresh: (jti: string) => refresh.get(jti),
    claimRefresh: (jti: string) => {
      const r = refresh.get(jti);
      if (r && !r.used) {
        r.used = true;
        return true;
      }
      return false;
    },
    revokeFamily: (familyId: string) => {
      for (const [k, v] of refresh) if (v.familyId === familyId) refresh.delete(k);
    },
    getClient: () => undefined,
    saveClient: () => undefined,
    putPending: () => undefined,
    getPending: () => undefined,
    deletePending: () => undefined,
  };
  return { codes, refresh, store };
});

vi.mock("./store.js", () => ({ store: h.store }));

const { oauthProvider } = await import("./provider.js");
const { sha256 } = await import("./crypto.js");

const client = {
  client_id: "client-1",
  redirect_uris: ["https://app.example/cb"],
} as unknown as OAuthClientInformationFull;

const codeFor = (clientId: string): StoredCode => ({
  clientId,
  redirectUri: "https://app.example/cb",
  codeChallenge: "challenge",
  email: "u@example.com",
  role: "user",
  scope: "api",
});

beforeEach(() => {
  h.codes.clear();
  h.refresh.clear();
});

describe("oauthProvider authorization codes", () => {
  it("exchanges a valid code once, then rejects reuse", async () => {
    h.store.putCode(sha256("code1"), codeFor("client-1"));
    const tokens = await oauthProvider.exchangeAuthorizationCode(client, "code1", "verifier", "https://app.example/cb");
    expect(tokens.access_token).toBeTruthy();
    expect(tokens.refresh_token).toBeTruthy();
    await expect(
      oauthProvider.exchangeAuthorizationCode(client, "code1", "verifier", "https://app.example/cb"),
    ).rejects.toThrow();
  });

  it("rejects a code issued to a different client", async () => {
    h.store.putCode(sha256("code2"), codeFor("client-2"));
    await expect(
      oauthProvider.exchangeAuthorizationCode(client, "code2", "verifier", "https://app.example/cb"),
    ).rejects.toThrow();
  });

  it("rejects a redirect_uri mismatch", async () => {
    h.store.putCode(sha256("code3"), codeFor("client-1"));
    await expect(
      oauthProvider.exchangeAuthorizationCode(client, "code3", "verifier", "https://evil.example/cb"),
    ).rejects.toThrow();
  });

  it("returns the PKCE challenge for the issuing client only", async () => {
    h.store.putCode(sha256("code4"), codeFor("client-1"));
    await expect(oauthProvider.challengeForAuthorizationCode(client, "code4")).resolves.toBe("challenge");
    const other = { ...client, client_id: "other" } as OAuthClientInformationFull;
    await expect(oauthProvider.challengeForAuthorizationCode(other, "code4")).rejects.toThrow();
  });
});

describe("oauthProvider refresh rotation", () => {
  it("rotates, then revokes the family on reuse", async () => {
    h.store.putCode(sha256("rc"), codeFor("client-1"));
    const t1 = await oauthProvider.exchangeAuthorizationCode(client, "rc", "v", "https://app.example/cb");
    const rt = t1.refresh_token as string;

    const t2 = await oauthProvider.exchangeRefreshToken(client, rt);
    expect(t2.access_token).toBeTruthy();
    expect(t2.refresh_token).not.toBe(rt);

    // Reusing the rotated-out token must fail …
    await expect(oauthProvider.exchangeRefreshToken(client, rt)).rejects.toThrow();
    // … and revoke the whole family, so the latest token is dead too.
    await expect(oauthProvider.exchangeRefreshToken(client, t2.refresh_token as string)).rejects.toThrow();
  });

  it("rejects a refresh token from another client", async () => {
    h.store.putCode(sha256("rc2"), codeFor("client-1"));
    const t1 = await oauthProvider.exchangeAuthorizationCode(client, "rc2", "v", "https://app.example/cb");
    const other = { ...client, client_id: "other" } as OAuthClientInformationFull;
    await expect(oauthProvider.exchangeRefreshToken(other, t1.refresh_token as string)).rejects.toThrow();
  });
});

describe("oauthProvider verifyAccessToken", () => {
  it("returns the user email in AuthInfo.extra and rejects refresh tokens", async () => {
    h.store.putCode(sha256("vc"), codeFor("client-1"));
    const t1 = await oauthProvider.exchangeAuthorizationCode(client, "vc", "v", "https://app.example/cb");
    const info = await oauthProvider.verifyAccessToken(t1.access_token);
    expect(info.extra?.email).toBe("u@example.com");
    expect(info.clientId).toBe("client-1");
    expect(typeof info.expiresAt).toBe("number");
    await expect(oauthProvider.verifyAccessToken(t1.refresh_token as string)).rejects.toThrow();
  });
});
