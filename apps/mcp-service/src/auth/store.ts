import { Database } from "bun:sqlite";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";

import { config } from "../config.js";
import { decrypt, encrypt } from "./crypto.js";

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/** OAuth params stashed between GET /authorize and the /login form POST. */
export interface PendingAuth {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: string[];
  state?: string;
  resource?: string;
}

/** An issued (but not yet redeemed) authorization code. */
export interface StoredCode {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  email: string;
  role: string;
  scope: string;
  resource?: string;
}

export interface StoredRefresh {
  jti: string;
  familyId: string;
  email: string;
  role: string;
  scope: string;
  clientId: string;
  used: boolean;
  expiresAt: number;
}

interface ClientRow {
  client_json: string;
}
interface PendingRow {
  params_json: string;
  expires_at: number;
}
interface CodeRow {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  email: string;
  role: string;
  scope: string;
  resource: string | null;
  expires_at: number;
}
interface RefreshRow {
  jti: string;
  family_id: string;
  email: string;
  role: string;
  scope: string;
  client_id: string;
  used: number;
  expires_at: number;
}
interface KeyRow {
  iv: string;
  tag: string;
  ciphertext: string;
}

class Store {
  private readonly db: Database;

  constructor(path: string) {
    const dir = dirname(path);
    if (dir && dir !== ".") {
      mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(path, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA busy_timeout = 5000;");
    this.db.exec("PRAGMA synchronous = NORMAL;");
    this.migrate();
    try {
      chmodSync(path, 0o600);
    } catch {
      // best-effort; non-fatal on filesystems without POSIX perms
    }
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS oauth_clients (
        client_id   TEXT PRIMARY KEY,
        client_json TEXT NOT NULL,
        created_at  INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pending_auth (
        rid         TEXT PRIMARY KEY,
        params_json TEXT NOT NULL,
        expires_at  INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS auth_codes (
        code_hash      TEXT PRIMARY KEY,
        client_id      TEXT NOT NULL,
        redirect_uri   TEXT NOT NULL,
        code_challenge TEXT NOT NULL,
        email          TEXT NOT NULL,
        role           TEXT NOT NULL,
        scope          TEXT NOT NULL,
        resource       TEXT,
        expires_at     INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        jti         TEXT PRIMARY KEY,
        family_id   TEXT NOT NULL,
        email       TEXT NOT NULL,
        role        TEXT NOT NULL,
        scope       TEXT NOT NULL,
        client_id   TEXT NOT NULL,
        used        INTEGER NOT NULL DEFAULT 0,
        replaced_by TEXT,
        expires_at  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS refresh_family_idx ON refresh_tokens (family_id);
      CREATE TABLE IF NOT EXISTS user_keys (
        email      TEXT PRIMARY KEY,
        iv         TEXT NOT NULL,
        tag        TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  }

  // --- OAuth clients (DCR) ---
  saveClient(client: OAuthClientInformationFull): void {
    this.db.run(
      "INSERT OR REPLACE INTO oauth_clients (client_id, client_json, created_at) VALUES (?, ?, ?)",
      client.client_id,
      JSON.stringify(client),
      nowSec(),
    );
  }

  getClient(clientId: string): OAuthClientInformationFull | undefined {
    const row = this.db
      .query<ClientRow>("SELECT client_json FROM oauth_clients WHERE client_id = ?")
      .get(clientId);
    if (!row) return undefined;
    return JSON.parse(row.client_json) as OAuthClientInformationFull;
  }

  // --- pending authorize → login handoff ---
  putPending(rid: string, params: PendingAuth, ttlSec: number): void {
    this.db.run(
      "INSERT OR REPLACE INTO pending_auth (rid, params_json, expires_at) VALUES (?, ?, ?)",
      rid,
      JSON.stringify(params),
      nowSec() + ttlSec,
    );
  }

  getPending(rid: string): PendingAuth | undefined {
    const row = this.db
      .query<PendingRow>("SELECT params_json, expires_at FROM pending_auth WHERE rid = ?")
      .get(rid);
    if (!row || row.expires_at < nowSec()) return undefined;
    return JSON.parse(row.params_json) as PendingAuth;
  }

  deletePending(rid: string): void {
    this.db.run("DELETE FROM pending_auth WHERE rid = ?", rid);
  }

  // --- authorization codes (single-use, short TTL, client+redirect bound) ---
  putCode(codeHash: string, code: StoredCode, ttlSec: number): void {
    this.db.run(
      `INSERT OR REPLACE INTO auth_codes
       (code_hash, client_id, redirect_uri, code_challenge, email, role, scope, resource, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      codeHash,
      code.clientId,
      code.redirectUri,
      code.codeChallenge,
      code.email,
      code.role,
      code.scope,
      code.resource ?? null,
      nowSec() + ttlSec,
    );
  }

  /** Read a code without consuming it (used to return its PKCE challenge). */
  getCode(codeHash: string): StoredCode | undefined {
    const row = this.db
      .query<CodeRow>("SELECT * FROM auth_codes WHERE code_hash = ?")
      .get(codeHash);
    if (!row || row.expires_at < nowSec()) return undefined;
    return this.rowToCode(row);
  }

  /** Atomically read + delete a code (single use). */
  consumeCode(codeHash: string): StoredCode | undefined {
    const row = this.db
      .query<CodeRow>("SELECT * FROM auth_codes WHERE code_hash = ?")
      .get(codeHash);
    this.db.run("DELETE FROM auth_codes WHERE code_hash = ?", codeHash);
    if (!row || row.expires_at < nowSec()) return undefined;
    return this.rowToCode(row);
  }

  private rowToCode(row: CodeRow): StoredCode {
    return {
      clientId: row.client_id,
      redirectUri: row.redirect_uri,
      codeChallenge: row.code_challenge,
      email: row.email,
      role: row.role,
      scope: row.scope,
      resource: row.resource ?? undefined,
    };
  }

  // --- refresh tokens (rotation + reuse detection by family) ---
  insertRefresh(r: StoredRefresh): void {
    this.db.run(
      `INSERT OR REPLACE INTO refresh_tokens
       (jti, family_id, email, role, scope, client_id, used, replaced_by, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?)`,
      r.jti,
      r.familyId,
      r.email,
      r.role,
      r.scope,
      r.clientId,
      r.expiresAt,
    );
  }

  getRefresh(jti: string): StoredRefresh | undefined {
    const row = this.db
      .query<RefreshRow>("SELECT * FROM refresh_tokens WHERE jti = ?")
      .get(jti);
    if (!row) return undefined;
    return {
      jti: row.jti,
      familyId: row.family_id,
      email: row.email,
      role: row.role,
      scope: row.scope,
      clientId: row.client_id,
      used: row.used === 1,
      expiresAt: row.expires_at,
    };
  }

  /**
   * Atomically claim a refresh token for rotation. Returns true iff THIS call
   * flipped used 0→1 (i.e. we are the single legitimate rotator). A false result
   * means the token was already used (reuse) or gone. Single SQLite statement →
   * no read-modify-write race across concurrent /token requests.
   */
  claimRefresh(jti: string, replacedBy: string): boolean {
    const res = this.db
      .query("UPDATE refresh_tokens SET used = 1, replaced_by = ? WHERE jti = ? AND used = 0")
      .run(replacedBy, jti);
    return res.changes === 1;
  }

  /** Revoke an entire refresh-token family (called on reuse detection / revoke). */
  revokeFamily(familyId: string): void {
    this.db.run("DELETE FROM refresh_tokens WHERE family_id = ?", familyId);
  }

  // --- per-user PostgREST API keys (encrypted at rest) ---
  getKey(email: string): string | undefined {
    const row = this.db
      .query<KeyRow>("SELECT iv, tag, ciphertext FROM user_keys WHERE email = ?")
      .get(email);
    if (!row) return undefined;
    try {
      return decrypt({ iv: row.iv, tag: row.tag, ciphertext: row.ciphertext });
    } catch {
      // Undecryptable (MCP_ENCRYPTION_KEY rotated / row corrupted): drop it so the
      // next sign-in re-mints, instead of throwing a raw crypto error everywhere.
      this.deleteKey(email);
      return undefined;
    }
  }

  setKey(email: string, rawKey: string): void {
    const enc = encrypt(rawKey);
    this.db.run(
      "INSERT OR REPLACE INTO user_keys (email, iv, tag, ciphertext, created_at) VALUES (?, ?, ?, ?, ?)",
      email,
      enc.iv,
      enc.tag,
      enc.ciphertext,
      nowSec(),
    );
  }

  deleteKey(email: string): void {
    this.db.run("DELETE FROM user_keys WHERE email = ?", email);
  }

  /** Drop expired pending-auth and authorization codes. Called periodically. */
  sweepExpired(): void {
    const now = nowSec();
    this.db.run("DELETE FROM pending_auth WHERE expires_at < ?", now);
    this.db.run("DELETE FROM auth_codes WHERE expires_at < ?", now);
    this.db.run("DELETE FROM refresh_tokens WHERE expires_at < ?", now);
  }

  close(): void {
    try {
      this.db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
    } catch {
      // ignore checkpoint errors during shutdown
    }
    this.db.close();
  }
}

export const store = new Store(config.sqlitePath);
