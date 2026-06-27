import { randomBytes } from "node:crypto";

import type { Response } from "express";

import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import {
  InvalidClientMetadataError,
  InvalidGrantError,
  InvalidTokenError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

import { MCP_SCOPE } from "../config.js";
import { logger } from "../logger.js";
import { sha256 } from "./crypto.js";
import { store } from "./store.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken as verifyAccessJwt,
  verifyRefreshToken as verifyRefreshJwt,
} from "./tokens.js";

const PENDING_TTL_SECONDS = 600;

const DANGEROUS_SCHEMES = new Set([
  "javascript:",
  "data:",
  "file:",
  "blob:",
  "vbscript:",
  "about:",
]);

/** Accept https, loopback http, and native/custom `scheme://host` redirects;
 *  reject fragments and dangerous pseudo-schemes (javascript:, data:, …). */
function isAllowedRedirect(uri: string): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === "https:") return true;
  if (
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]")
  ) {
    return true;
  }
  if (DANGEROUS_SCHEMES.has(url.protocol)) return false;
  // Native/custom app schemes must carry an authority (//host); this rejects the
  // opaque pseudo-schemes above while allowing e.g. com.example.app://callback.
  return url.host !== "";
}

const clientsStore: OAuthRegisteredClientsStore = {
  getClient(clientId: string): OAuthClientInformationFull | undefined {
    return store.getClient(clientId);
  },
  registerClient(client): OAuthClientInformationFull {
    // The SDK's registration handler has already assigned client_id.
    const full = client as OAuthClientInformationFull;
    for (const uri of full.redirect_uris) {
      if (!isAllowedRedirect(uri)) {
        throw new InvalidClientMetadataError(`Disallowed redirect_uri: ${uri}`);
      }
    }
    store.saveClient(full);
    return full;
  },
};

class MatrummetOAuthProvider implements OAuthServerProvider {
  // PKCE S256 is validated by the SDK's token handler between
  // challengeForAuthorizationCode and exchangeAuthorizationCode.
  readonly skipLocalPkceValidation = false;

  get clientsStore(): OAuthRegisteredClientsStore {
    return clientsStore;
  }

  /**
   * The SDK has already validated the client and redirect_uri. We can't read
   * credentials here (no req.body), so stash the validated params under a
   * one-time nonce and hand off to the separately-mounted /login route.
   */
  authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    logger.info(
      { client: client.client_id, redirect_uri: params.redirectUri, scopes: params.scopes ?? [] },
      "oauth authorize",
    );
    const rid = randomBytes(24).toString("hex");
    store.putPending(
      rid,
      {
        clientId: client.client_id,
        redirectUri: params.redirectUri,
        codeChallenge: params.codeChallenge,
        scopes: params.scopes && params.scopes.length > 0 ? params.scopes : [MCP_SCOPE],
        state: params.state,
        resource: params.resource?.href,
      },
      PENDING_TTL_SECONDS,
    );
    res.redirect(`/login?rid=${rid}`);
    return Promise.resolve();
  }

  // async so a thrown error surfaces as a rejected promise (the SDK awaits this)
  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const code = store.getCode(sha256(authorizationCode));
    if (!code || code.clientId !== client.client_id) {
      logger.warn(
        { client: client.client_id, codeFound: !!code },
        "challenge: code not found / client mismatch",
      );
      throw new InvalidGrantError("Invalid or expired authorization code");
    }
    return code.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
  ): Promise<OAuthTokens> {
    const code = store.consumeCode(sha256(authorizationCode));
    if (!code || code.clientId !== client.client_id) {
      logger.warn(
        { client: client.client_id, codeFound: !!code },
        "exchange: code not found / client mismatch",
      );
      throw new InvalidGrantError("Invalid or expired authorization code");
    }
    // We do NOT re-compare redirect_uri here. The SDK already validated it
    // against the client's registered redirect_uris at /authorize, and PKCE S256
    // (mandatory, verified by the SDK token handler BEFORE this runs) is the real
    // code↔client binding for public clients. A token-time re-comparison only
    // causes interop breakage — clients omit it, or normalize trailing-slash /
    // percent-encoding differently than the value we stored. Log differences for
    // visibility, but allow the exchange (redirect_uri is not a secret).
    if (redirectUri !== undefined && redirectUri !== code.redirectUri) {
      logger.info(
        { client: client.client_id, sent: redirectUri, bound: code.redirectUri },
        "token: redirect_uri differs from authorize — allowed (PKCE is the binding)",
      );
    }
    return this.issueTokens(code.email, code.role, code.scope, client.client_id);
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
  ): Promise<OAuthTokens> {
    const claims = await verifyRefreshJwt(refreshToken).catch((): never => {
      throw new InvalidGrantError("Invalid refresh token");
    });
    if (claims.clientId !== client.client_id) {
      throw new InvalidGrantError("Refresh token was issued to a different client");
    }
    const stored = store.getRefresh(claims.jti);
    if (!stored) {
      throw new InvalidGrantError("Unknown refresh token");
    }
    const refresh = await signRefreshToken({
      email: stored.email,
      role: stored.role,
      scope: stored.scope,
      clientId: client.client_id,
      familyId: stored.familyId,
    });
    // Atomically claim the presented token. A false result means it was already
    // rotated out (reuse) → revoke the whole family (RFC 9700). The conditional
    // UPDATE is a single statement, so concurrent presentations can't both win.
    if (!store.claimRefresh(stored.jti, refresh.jti)) {
      store.revokeFamily(stored.familyId);
      throw new InvalidGrantError("Refresh token reuse detected");
    }
    store.insertRefresh({
      jti: refresh.jti,
      familyId: stored.familyId,
      email: stored.email,
      role: stored.role,
      scope: stored.scope,
      clientId: client.client_id,
      used: false,
      expiresAt: refresh.expiresAt,
    });
    const access = await signAccessToken({
      email: stored.email,
      role: stored.role,
      scope: stored.scope,
      clientId: client.client_id,
    });
    return {
      access_token: access.token,
      token_type: "Bearer",
      expires_in: access.expiresIn,
      scope: stored.scope,
      refresh_token: refresh.token,
    };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const claims = await verifyAccessJwt(token).catch((): never => {
      throw new InvalidTokenError("Invalid or expired access token");
    });
    return {
      token,
      clientId: claims.clientId,
      scopes: claims.scope ? claims.scope.split(" ") : [],
      expiresAt: claims.expiresAt,
      extra: { email: claims.email, role: claims.role },
    };
  }

  async revokeToken(
    _client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    // Access tokens are stateless + short-lived; only refresh families are
    // revocable. Ignore unknown/invalid tokens (RFC 7009 §2.2).
    try {
      const claims = await verifyRefreshJwt(request.token);
      const stored = store.getRefresh(claims.jti);
      if (stored) store.revokeFamily(stored.familyId);
    } catch {
      // nothing to revoke
    }
  }

  private async issueTokens(
    email: string,
    role: string,
    scope: string,
    clientId: string,
  ): Promise<OAuthTokens> {
    const access = await signAccessToken({ email, role, scope, clientId });
    const refresh = await signRefreshToken({ email, role, scope, clientId });
    store.insertRefresh({
      jti: refresh.jti,
      familyId: refresh.familyId,
      email,
      role,
      scope,
      clientId,
      used: false,
      expiresAt: refresh.expiresAt,
    });
    return {
      access_token: access.token,
      token_type: "Bearer",
      expires_in: access.expiresIn,
      scope,
      refresh_token: refresh.token,
    };
  }
}

export const oauthProvider = new MatrummetOAuthProvider();
