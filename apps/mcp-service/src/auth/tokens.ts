import { randomBytes } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";

import { config, RESOURCE_URL } from "../config.js";

const secret = new TextEncoder().encode(config.tokenSecret);

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export interface AccessClaims {
  email: string;
  role: string;
  scope: string;
  clientId: string;
  expiresAt: number;
}

export interface RefreshClaims {
  email: string;
  role: string;
  scope: string;
  clientId: string;
  jti: string;
  familyId: string;
}

export interface AccessIssue {
  token: string;
  expiresIn: number;
}

export interface RefreshIssue {
  token: string;
  jti: string;
  familyId: string;
  expiresAt: number;
}

export async function signAccessToken(opts: {
  email: string;
  role: string;
  scope: string;
  clientId: string;
}): Promise<AccessIssue> {
  const exp = nowSec() + config.accessTokenSeconds;
  const token = await new SignJWT({
    role: opts.role,
    scope: opts.scope,
    cid: opts.clientId,
    typ: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(opts.email)
    .setIssuer(config.issuerUrl)
    .setAudience(RESOURCE_URL)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret);
  return { token, expiresIn: config.accessTokenSeconds };
}

export async function signRefreshToken(opts: {
  email: string;
  role: string;
  scope: string;
  clientId: string;
  familyId?: string;
}): Promise<RefreshIssue> {
  const jti = randomBytes(16).toString("hex");
  const familyId = opts.familyId ?? randomBytes(16).toString("hex");
  const expiresAt = nowSec() + config.refreshTokenTtlDays * 24 * 3600;
  const token = await new SignJWT({
    role: opts.role,
    scope: opts.scope,
    cid: opts.clientId,
    fam: familyId,
    typ: "refresh",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(opts.email)
    .setIssuer(config.issuerUrl)
    .setAudience(RESOURCE_URL)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret);
  return { token, jti, familyId, expiresAt };
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, secret, {
    audience: RESOURCE_URL,
    issuer: config.issuerUrl,
  });
  const email = asString(payload.sub);
  const exp = typeof payload.exp === "number" ? payload.exp : undefined;
  if (!email || exp === undefined || payload.typ !== "access") {
    throw new Error("invalid access token");
  }
  return {
    email,
    role: asString(payload.role) ?? "user",
    scope: asString(payload.scope) ?? "",
    clientId: asString(payload.cid) ?? "",
    expiresAt: exp,
  };
}

export async function verifyRefreshToken(token: string): Promise<RefreshClaims> {
  const { payload } = await jwtVerify(token, secret, {
    audience: RESOURCE_URL,
    issuer: config.issuerUrl,
  });
  const email = asString(payload.sub);
  const jti = asString(payload.jti);
  const familyId = asString(payload.fam);
  if (!email || !jti || !familyId || payload.typ !== "refresh") {
    throw new Error("invalid refresh token");
  }
  return {
    email,
    role: asString(payload.role) ?? "user",
    scope: asString(payload.scope) ?? "",
    clientId: asString(payload.cid) ?? "",
    jti,
    familyId,
  };
}
