import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { config } from "../config.js";

function loadKey(): Buffer {
  const raw = config.encryptionKey;
  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("MCP_ENCRYPTION_KEY must decode to 32 bytes (64 hex chars or base64)");
  }
  return key;
}

const KEY = loadKey();

export interface Encrypted {
  iv: string;
  tag: string;
  ciphertext: string;
}

/** AES-256-GCM encrypt with a fresh random 96-bit IV per call. */
export function encrypt(plaintext: string): Encrypted {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

/** Throws on tamper / wrong key (GCM auth tag mismatch). */
export function decrypt(enc: Encrypted): string {
  const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(enc.iv, "base64"));
  decipher.setAuthTag(Buffer.from(enc.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(enc.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** SHA-256 hex — used to store authorization codes by hash, never in plaintext. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
