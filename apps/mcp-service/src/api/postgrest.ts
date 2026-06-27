import { z } from "zod";

import { config } from "../config.js";
import { store } from "../auth/store.js";

export interface ToolContext {
  email: string;
  role: string;
}

/** Structured PostgREST/image-service error surfaced to the model as isError. */
export class PostgrestError extends Error {
  readonly status: number;
  readonly hint?: string;
  readonly details?: string;
  readonly code?: string;

  constructor(
    message: string,
    status: number,
    opts?: { hint?: string; details?: string; code?: string },
  ) {
    super(message);
    this.name = "PostgrestError";
    this.status = status;
    this.hint = opts?.hint;
    this.details = opts?.details;
    this.code = opts?.code;
  }
}

const loginUserSchema = z.object({
  email: z.string(),
  name: z.string().nullable().optional(),
  role: z.string(),
});
export type LoginUser = z.infer<typeof loginUserSchema>;

const pgErrorSchema = z.object({
  message: z.string().optional(),
  hint: z.string().nullable().optional(),
  details: z.string().nullable().optional(),
  code: z.string().nullable().optional(),
});

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function buildPgError(status: number, body: unknown): PostgrestError {
  const parsed = pgErrorSchema.safeParse(body);
  if (parsed.success && parsed.data.message) {
    return new PostgrestError(parsed.data.message, status, {
      hint: parsed.data.hint ?? undefined,
      details: parsed.data.details ?? undefined,
      code: parsed.data.code ?? undefined,
    });
  }
  return new PostgrestError(`PostgREST request failed (HTTP ${String(status)})`, status);
}

/** Whether an error means the stored key is no longer valid (self-heal trigger).
 *  A bare 403 is usually RLS / permission-denied (SQLSTATE 42501) with a valid
 *  key, so we must NOT drop the key on 403 — only on genuine credential-invalid
 *  signals (401, or PostgreSQL auth SQLSTATEs 28000 / 28P01). */
function isAuthError(status: number, err: PostgrestError): boolean {
  return status === 401 || err.code === "28000" || err.code === "28P01";
}

function apiKeyFor(email: string): string {
  const key = store.getKey(email);
  if (!key) {
    throw new PostgrestError(
      "No API key on file for your account — please sign in again via the MCP client.",
      401,
    );
  }
  return key;
}

function authHeaders(email: string, homeId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKeyFor(email),
  };
  if (homeId) headers["X-Active-Home-Id"] = homeId;
  return headers;
}

async function handleAuthedResponse(
  ctx: ToolContext,
  res: Response,
): Promise<unknown> {
  if (res.ok) return readBody(res);
  const err = buildPgError(res.status, await readBody(res));
  if (isAuthError(res.status, err)) {
    // Stored key revoked/expired: forget it so the next sign-in re-mints one.
    store.deleteKey(ctx.email);
  }
  throw err;
}

/** POST /rpc/<fn> as the authenticated user (x-api-key). */
export async function callRpc(
  ctx: ToolContext,
  fn: string,
  body: Record<string, unknown>,
  opts?: { homeId?: string },
): Promise<unknown> {
  const res = await fetch(`${config.postgrestUrl}/rpc/${fn}`, {
    method: "POST",
    headers: authHeaders(ctx.email, opts?.homeId),
    body: JSON.stringify(body),
  });
  return handleAuthedResponse(ctx, res);
}

/** GET /<view>?<params> as the authenticated user. */
export async function queryView(
  ctx: ToolContext,
  view: string,
  params: URLSearchParams,
  opts?: { homeId?: string },
): Promise<unknown> {
  const res = await fetch(`${config.postgrestUrl}/${view}?${params.toString()}`, {
    method: "GET",
    headers: authHeaders(ctx.email, opts?.homeId),
  });
  return handleAuthedResponse(ctx, res);
}

/** DELETE /<table>?<params> as the authenticated user (RLS gates ownership). */
export async function deleteFrom(
  ctx: ToolContext,
  table: string,
  params: URLSearchParams,
): Promise<unknown> {
  const headers = authHeaders(ctx.email);
  headers.Prefer = "return=representation";
  const res = await fetch(`${config.postgrestUrl}/${table}?${params.toString()}`, {
    method: "DELETE",
    headers,
  });
  return handleAuthedResponse(ctx, res);
}

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/** Multipart upload to the image service (base64 in → {filename} out). */
export async function uploadImage(
  ctx: ToolContext,
  opts: { dataBase64: string; filename?: string; mimeType?: string },
): Promise<unknown> {
  if (!config.imageServiceUrl) {
    throw new PostgrestError("Image uploads are not configured on this server.", 503);
  }
  const apiKey = apiKeyFor(ctx.email);
  // Buffer.from(..., "base64") silently drops invalid chars instead of throwing,
  // so validate the input explicitly. Strip an optional data: URL prefix first.
  const normalized = opts.dataBase64.replace(/^data:[^;]*;base64,/, "").replace(/\s+/g, "");
  if (normalized.length === 0) {
    throw new PostgrestError("Image data is empty.", 400);
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    throw new PostgrestError("Invalid base64 image data.", 400);
  }
  const bytes = Buffer.from(normalized, "base64");
  if (bytes.length === 0) {
    throw new PostgrestError("Image data is empty.", 400);
  }
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new PostgrestError("Image exceeds the 20 MB limit.", 413);
  }
  const form = new FormData();
  const blob = new Blob([Uint8Array.from(bytes)], {
    type: opts.mimeType ?? "application/octet-stream",
  });
  form.append("file", blob, opts.filename ?? "upload");
  const res = await fetch(`${config.imageServiceUrl}/upload`, {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: form,
  });
  return handleAuthedResponse(ctx, res);
}

/** POST /rpc/<fn> as anon (no x-api-key) — for publicly-granted preview RPCs. */
export async function callRpcAnon(
  fn: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${config.postgrestUrl}/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readBody(res);
  if (!res.ok) throw buildPgError(res.status, data);
  return data;
}

// ---- Anon (password-gated) bridge calls — no x-api-key ----

/** Verify credentials via /rpc/login. Returns the users row; mints no key. */
export async function login(email: string, password: string): Promise<LoginUser> {
  const res = await fetch(`${config.postgrestUrl}/rpc/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login_email: email, login_password: password }),
  });
  const body = await readBody(res);
  if (!res.ok) throw buildPgError(res.status, body);
  const row = Array.isArray(body) ? (body[0] as unknown) : body;
  return loginUserSchema.parse(row);
}

/** Mint a fresh per-user API key via the anon /rpc/issue_api_key bootstrap. */
export async function issueApiKey(
  email: string,
  password: string,
  name: string,
): Promise<string> {
  const res = await fetch(`${config.postgrestUrl}/rpc/issue_api_key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_email: email, p_password: password, p_name: name }),
  });
  const body = await readBody(res);
  if (!res.ok) throw buildPgError(res.status, body);
  if (typeof body !== "string" || !body.startsWith("sk_")) {
    throw new PostgrestError("Unexpected issue_api_key response.", 502);
  }
  return body;
}
