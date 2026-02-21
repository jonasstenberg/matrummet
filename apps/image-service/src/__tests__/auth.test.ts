import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { authenticateRequest } from "../auth.js";

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const SECRET = process.env.JWT_SECRET!;

function signToken(
  payload: Record<string, unknown>,
  options?: jwt.SignOptions,
): string {
  return jwt.sign(payload, SECRET, { algorithm: "HS256", ...options });
}

describe("authenticateRequest", () => {
  it("extracts Bearer token from Authorization header", () => {
    const token = signToken({ role: "authenticated", email: "test@test.com" });
    const request = new Request("http://localhost/upload", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const payload = authenticateRequest(request);
    expect(payload.role).toBe("authenticated");
    expect(payload.email).toBe("test@test.com");
  });

  it("falls back to auth-token cookie", () => {
    const token = signToken({
      role: "authenticated",
      email: "cookie@test.com",
    });
    const request = new Request("http://localhost/upload", {
      headers: { Cookie: `auth-token=${token}` },
    });

    const payload = authenticateRequest(request);
    expect(payload.role).toBe("authenticated");
    expect(payload.email).toBe("cookie@test.com");
  });

  it("extracts auth-token cookie when other cookies are present", () => {
    const token = signToken({ role: "authenticated", email: "multi@test.com" });
    const request = new Request("http://localhost/upload", {
      headers: { Cookie: `other=value; auth-token=${token}; foo=bar` },
    });

    const payload = authenticateRequest(request);
    expect(payload.email).toBe("multi@test.com");
  });

  it("prefers Authorization header over cookie", () => {
    const headerToken = signToken({
      role: "authenticated",
      email: "header@test.com",
    });
    const cookieToken = signToken({
      role: "authenticated",
      email: "cookie@test.com",
    });
    const request = new Request("http://localhost/upload", {
      headers: {
        Authorization: `Bearer ${headerToken}`,
        Cookie: `auth-token=${cookieToken}`,
      },
    });

    const payload = authenticateRequest(request);
    expect(payload.email).toBe("header@test.com");
  });

  it("throws when no token is provided", () => {
    const request = new Request("http://localhost/upload");

    expect(() => authenticateRequest(request)).toThrow(
      "No authentication token provided",
    );
  });

  it("throws when Authorization header has no Bearer prefix", () => {
    const request = new Request("http://localhost/upload", {
      headers: { Authorization: "Basic abc123" },
    });

    expect(() => authenticateRequest(request)).toThrow(
      "No authentication token provided",
    );
  });

  it("throws on invalid token", () => {
    const request = new Request("http://localhost/upload", {
      headers: { Authorization: "Bearer not-a-valid-jwt" },
    });

    expect(() => authenticateRequest(request)).toThrow();
  });

  it("throws on expired token", () => {
    const token = signToken(
      { role: "authenticated", email: "expired@test.com" },
      { expiresIn: -10 },
    );
    const request = new Request("http://localhost/upload", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(() => authenticateRequest(request)).toThrow();
  });

  it("throws on token signed with wrong secret", () => {
    const token = jwt.sign(
      { role: "authenticated", email: "wrong@test.com" },
      "wrong-secret-that-is-also-long-enough",
      { algorithm: "HS256" },
    );
    const request = new Request("http://localhost/upload", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(() => authenticateRequest(request)).toThrow();
  });
});
