import { randomBytes } from "node:crypto";

import express, { type Request, type RequestHandler, type Response, Router } from "express";

import { logger } from "../logger.js";
import { issueApiKey, login as postgrestLogin, PostgrestError } from "../api/postgrest.js";
import { sha256 } from "./crypto.js";
import { store, type PendingAuth } from "./store.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 0; display: grid; place-items: center; min-height: 100vh; background: #f6f6f4; }
  .card { background: #fff; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,.08); padding: 32px; width: min(92vw, 380px); }
  h1 { font-size: 1.25rem; margin: 0 0 4px; }
  p.sub { color: #666; font-size: .9rem; margin: 0 0 20px; }
  label { display: block; font-size: .85rem; margin: 14px 0 6px; font-weight: 600; }
  input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #ccc; border-radius: 10px; font-size: 1rem; }
  button { width: 100%; margin-top: 20px; padding: 11px; border: 0; border-radius: 10px; background: #1f7a4d; color: #fff; font-size: 1rem; font-weight: 600; cursor: pointer; }
  .grant { background: #f0f4f1; border-radius: 10px; padding: 12px 14px; font-size: .85rem; color: #333; margin-bottom: 8px; }
  .grant strong { color: #1f7a4d; }
  .err { background: #fdecec; color: #b3261e; border-radius: 10px; padding: 10px 12px; font-size: .85rem; margin-bottom: 12px; }
  @media (prefers-color-scheme: dark) {
    body { background: #16181a; } .card { background: #1f2225; color: #eee; }
    input { background: #15171a; color: #eee; border-color: #3a3f44; }
    .grant { background: #23282b; color: #ddd; } p.sub { color: #aaa; }
  }
</style>
</head>
<body><div class="card">${body}</div></body>
</html>`;
}

function loginPage(opts: {
  rid: string;
  clientName: string;
  redirectUri: string;
  scopes: string[];
  error?: string;
}): string {
  let host = opts.redirectUri;
  try {
    host = new URL(opts.redirectUri).host || opts.redirectUri;
  } catch {
    /* keep raw */
  }
  const scopeText = opts.scopes.length > 0 ? opts.scopes.join(", ") : "api";
  return page(
    "Logga in – Matrummet MCP",
    `<h1>Matrummet</h1>
<p class="sub">Logga in för att ge åtkomst via MCP.</p>
<div class="grant">
  <strong>${escapeHtml(opts.clientName)}</strong> begär åtkomst till ditt Matrummet-konto
  (omfattning: ${escapeHtml(scopeText)}) och skickar dig tillbaka till
  <strong>${escapeHtml(host)}</strong>.
</div>
${opts.error ? `<div class="err">${escapeHtml(opts.error)}</div>` : ""}
<form method="post" action="/login" autocomplete="on">
  <input type="hidden" name="rid" value="${escapeHtml(opts.rid)}">
  <label for="email">E-post</label>
  <input id="email" name="email" type="email" autocomplete="username" required autofocus>
  <label for="password">Lösenord</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required>
  <button type="submit">Logga in och godkänn</button>
</form>`,
  );
}

function errorPage(message: string): string {
  return page(
    "Fel – Matrummet MCP",
    `<h1>Något gick fel</h1><p class="sub">${escapeHtml(message)}</p>`,
  );
}

/** Reuse an existing per-user key, otherwise mint one via the anon bootstrap. */
async function ensureApiKey(email: string, password: string): Promise<void> {
  if (store.getKey(email)) return;
  let name = "mcp-server";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const raw = await issueApiKey(email, password, name);
      store.setKey(email, raw);
      return;
    } catch (err) {
      if (err instanceof PostgrestError && err.message.includes("key-name-already-exists")) {
        // A prior key with this name exists in the DB but isn't in our store
        // (e.g. fresh sqlite). Use a unique name so we get one we hold.
        name = `mcp-server-${randomBytes(4).toString("hex")}`;
        continue;
      }
      throw err;
    }
  }
  throw new Error("Could not allocate an API key name");
}

function field(body: unknown, key: string): string {
  if (typeof body !== "object" || body === null) return "";
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function clientNameFor(pending: PendingAuth): string {
  return store.getClient(pending.clientId)?.client_name ?? pending.clientId;
}

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

export const loginRouter = Router();
loginRouter.use(express.urlencoded({ extended: false }));

loginRouter.get("/login", (req, res) => {
  const rid = typeof req.query.rid === "string" ? req.query.rid : "";
  const pending = rid ? store.getPending(rid) : undefined;
  if (!pending) {
    res
      .status(400)
      .type("html")
      .send(errorPage("Den här inloggningslänken har gått ut. Starta om från din MCP-klient."));
    return;
  }
  res.type("html").send(
    loginPage({
      rid,
      clientName: clientNameFor(pending),
      redirectUri: pending.redirectUri,
      scopes: pending.scopes,
    }),
  );
});

loginRouter.post(
  "/login",
  wrap(async (req, res) => {
    const rid = field(req.body, "rid");
    const email = field(req.body, "email").trim();
    const password = field(req.body, "password");

    const pending = rid ? store.getPending(rid) : undefined;
    if (!pending) {
      res
        .status(400)
        .type("html")
        .send(errorPage("Din inloggningssession har gått ut. Starta om från din MCP-klient."));
      return;
    }

    const rerender = (status: number, error: string): void => {
      res
        .status(status)
        .type("html")
        .send(
          loginPage({
            rid,
            clientName: clientNameFor(pending),
            redirectUri: pending.redirectUri,
            scopes: pending.scopes,
            error,
          }),
        );
    };

    if (!email || !password) {
      rerender(400, "Fyll i både e-post och lösenord.");
      return;
    }

    // Failed credentials issue NO authorization code.
    const user = await postgrestLogin(email, password).catch(() => null);
    if (!user) {
      rerender(401, "Fel e-post eller lösenord.");
      return;
    }

    try {
      await ensureApiKey(email, password);
    } catch (err) {
      logger.error({ err }, "failed to provision API key");
      res
        .status(500)
        .type("html")
        .send(errorPage("Kunde inte skapa API-åtkomst. Försök igen."));
      return;
    }

    const code = randomBytes(32).toString("hex");
    store.putCode(
      sha256(code),
      {
        clientId: pending.clientId,
        redirectUri: pending.redirectUri,
        codeChallenge: pending.codeChallenge,
        email: user.email,
        role: user.role,
        scope: pending.scopes.join(" "),
        resource: pending.resource,
      },
      60,
    );
    store.deletePending(rid);

    const redirect = new URL(pending.redirectUri);
    redirect.searchParams.set("code", code);
    if (pending.state) redirect.searchParams.set("state", pending.state);
    res.redirect(redirect.toString());
  }),
);
