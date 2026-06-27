import { describe, expect, it } from "vitest";

import { decrypt, encrypt, sha256 } from "./crypto.js";

describe("crypto", () => {
  it("round-trips plaintext through AES-256-GCM", () => {
    const secret = "sk_1234567890abcdef1234567890abcdef";
    const enc = encrypt(secret);
    expect(enc.ciphertext).not.toContain(secret);
    expect(decrypt(enc)).toBe(secret);
  });

  it("uses a fresh IV per encryption", () => {
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("throws on tampered ciphertext", () => {
    const enc = encrypt("secret");
    const tampered = { ...enc, ciphertext: Buffer.from("garbage").toString("base64") };
    expect(() => decrypt(tampered)).toThrow();
  });

  it("hashes deterministically", () => {
    expect(sha256("abc")).toBe(sha256("abc"));
    expect(sha256("abc")).not.toBe(sha256("abd"));
    expect(sha256("abc")).toMatch(/^[0-9a-f]{64}$/);
  });
});
