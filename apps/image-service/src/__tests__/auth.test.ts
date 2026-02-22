import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { authenticateRequest, authenticateServiceRequest } from "../auth.js";

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const SECRET = process.env.JWT_SECRET!;

function signToken(
  payload: Record<string, unknown>,
  options?: jwt.SignOptions,
): string {
  return jwt.sign(payload, SECRET, { algorithm: "HS256", ...options });
}

describe("authenticateRequest", () => {
  it("extracts Bearer token from Authorization header", async () => {
    const token = signToken({ role: "authenticated", email: "test@test.com" });
    const request = new Request("http://localhost/upload", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const payload = await authenticateRequest(request);
    expect(payload.role).toBe("authenticated");
    expect(payload.email).toBe("test@test.com");
  });

  it("falls back to auth-token cookie", async () => {
    const token = signToken({
      role: "authenticated",
      email: "cookie@test.com",
    });
    const request = new Request("http://localhost/upload", {
      headers: { Cookie: `auth-token=${token}` },
    });

    const payload = await authenticateRequest(request);
    expect(payload.role).toBe("authenticated");
    expect(payload.email).toBe("cookie@test.com");
  });

  it("extracts auth-token cookie when other cookies are present", async () => {
    const token = signToken({ role: "authenticated", email: "multi@test.com" });
    const request = new Request("http://localhost/upload", {
      headers: { Cookie: `other=value; auth-token=${token}; foo=bar` },
    });

    const payload = await authenticateRequest(request);
    expect(payload.email).toBe("multi@test.com");
  });

  it("prefers Authorization header over cookie", async () => {
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

    const payload = await authenticateRequest(request);
    expect(payload.email).toBe("header@test.com");
  });

  it("rejects when no token is provided", async () => {
    const request = new Request("http://localhost/upload");

    await expect(authenticateRequest(request)).rejects.toThrow(
      "No authentication token provided",
    );
  });

  it("rejects when Authorization header has no Bearer prefix", async () => {
    const request = new Request("http://localhost/upload", {
      headers: { Authorization: "Basic abc123" },
    });

    await expect(authenticateRequest(request)).rejects.toThrow(
      "No authentication token provided",
    );
  });

  it("rejects invalid token", async () => {
    const request = new Request("http://localhost/upload", {
      headers: { Authorization: "Bearer not-a-valid-jwt" },
    });

    await expect(authenticateRequest(request)).rejects.toThrow();
  });

  it("rejects expired token", async () => {
    const token = signToken(
      { role: "authenticated", email: "expired@test.com" },
      { expiresIn: -10 },
    );
    const request = new Request("http://localhost/upload", {
      headers: { Authorization: `Bearer ${token}` },
    });

    await expect(authenticateRequest(request)).rejects.toThrow();
  });

  it("rejects token signed with wrong secret", async () => {
    const token = jwt.sign(
      { role: "authenticated", email: "wrong@test.com" },
      "wrong-secret-that-is-also-long-enough",
      { algorithm: "HS256" },
    );
    const request = new Request("http://localhost/upload", {
      headers: { Authorization: `Bearer ${token}` },
    });

    await expect(authenticateRequest(request)).rejects.toThrow();
  });
});

describe("authenticateServiceRequest", () => {
  it("accepts service tokens", async () => {
    const token = signToken({ role: "service", service: "web" });
    const request = new Request("http://localhost/upload", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const payload = await authenticateServiceRequest(request);
    expect(payload.role).toBe("service");
  });

  it("rejects user tokens", async () => {
    const token = signToken({ role: "authenticated", email: "test@test.com" });
    const request = new Request("http://localhost/upload", {
      headers: { Authorization: `Bearer ${token}` },
    });

    await expect(authenticateServiceRequest(request)).rejects.toThrow(
      "Service token required",
    );
  });

  it("rejects unauthenticated requests", async () => {
    const request = new Request("http://localhost/upload");

    await expect(authenticateServiceRequest(request)).rejects.toThrow(
      "No authentication token provided",
    );
  });
});
