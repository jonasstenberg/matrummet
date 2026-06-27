# @matrummet/mcp-service

An MCP (Model Context Protocol) server that exposes the **documented Matrummet API**
(`/api/docs`) as MCP tools over **Streamable HTTP**, protected by a self-hosted
**OAuth 2.1 authorization server** with **dynamic client registration (DCR)** and **PKCE**.

A compatible MCP client can connect to `https://mcp.matrummet.se/mcp`, self-register,
send the user through a login/consent page, and then call ~80 tools (recipes, search,
collections, sharing, pantry, shopping lists, meal plans, household, credits, image
upload, …).

## How it works

```
MCP client ──HTTPS──> nginx (mcp.matrummet.se) ──> bun :4008
                                                    ├─ OAuth AS: /authorize /token /register /revoke + /.well-known/*
                                                    ├─ /login   (credential + consent page)
                                                    └─ POST /mcp (StreamableHTTP, requireBearerAuth)
                                                          └─ per call: x-api-key ──> PostgREST (api.matrummet.se)
```

- **Auth bridge, no master secret.** The login page verifies the password via PostgREST
  `/rpc/login`, then mints a per-user API key via the anon `/rpc/issue_api_key` bootstrap
  (migration `V61`). The key is stored **AES-256-GCM encrypted** in a local SQLite file and
  sent as `x-api-key` on every tool call. **This service never holds `POSTGREST_JWT_SECRET`**,
  so a compromise cannot mint admin tokens — only the authenticated-role keys of users who
  signed in here, which are individually revocable.
- **Own OAuth tokens.** Access/refresh tokens are HS256 JWTs signed with `MCP_TOKEN_SECRET`,
  audience-bound to `<issuer>/mcp`. Refresh tokens rotate with **reuse detection** (a replayed
  token revokes its whole family). Authorization codes are single-use, ≤60s, and bound to the
  client + redirect_uri.
- **Stateless transport.** Each request gets a fresh `McpServer` + `StreamableHTTPServerTransport`.

## Environment

See `.env.example`. Required: `POSTGREST_URL`, `MCP_ISSUER_URL`, `MCP_TOKEN_SECRET` (≥32
chars), `MCP_ENCRYPTION_KEY` (32 bytes, `openssl rand -hex 32`). Optional: `IMAGE_SERVICE_URL`
(enables `upload_image`), `SQLITE_PATH`, `PORT`.

## Local development

```bash
cp .env.example .env   # fill MCP_TOKEN_SECRET + MCP_ENCRYPTION_KEY
# PostgREST must be running on POSTGREST_URL for login/tool calls
bun src/index.ts       # or: pnpm --filter @matrummet/mcp-service dev
```

Quick checks:

```bash
curl -i localhost:4008/mcp                                  # 401 + WWW-Authenticate
curl localhost:4008/.well-known/oauth-authorization-server  # RFC 8414 metadata
curl localhost:4008/.well-known/oauth-protected-resource/mcp
```

## Deployment

Production runs under **systemd on the VPS** (no Docker). On push to `main`, CI
(`.github/workflows/deploy.yml`) automatically:

1. runs unit tests, applies the `V61` migration (via the existing migrations job),
2. `pnpm deploy`s a self-contained bundle and rsyncs it to `/opt/matrummet/apps/mcp-service/`,
3. `systemctl restart matrummet-mcp`,
4. deploys `infra/nginx/mcp.conf` and reloads nginx.

### One-time VPS prerequisites (NOT automated — do these once before the first push)

1. **DNS**: create an `A`/`AAAA` record for `mcp.matrummet.se` → the VPS.
2. **TLS cert** (the deploy runs `nginx -t`, which fails — and blocks *all* deploys — if the
   cert dir is missing). Issue it with the same acme.sh + HTTP-01 webroot the other hosts use:
   ```bash
   acme.sh --issue -d mcp.matrummet.se -w /var/www/html --ecc
   ```
   (produces `/home/jonas/.acme.sh/mcp.matrummet.se_ecc/{fullchain.cer,mcp.matrummet.se.key}`).
3. **Env file**: create `/opt/matrummet/.mcp-service.env` (outside the rsync target). Use the
   INTERNAL PostgREST/image ports so MCP traffic doesn't take a public round-trip (and so the
   `/login` brute-force throttle lives at the MCP edge, not a shared api.matrummet.se bucket):
   ```
   POSTGREST_URL=http://127.0.0.1:4444
   IMAGE_SERVICE_URL=http://127.0.0.1:4006
   MCP_ISSUER_URL=https://mcp.matrummet.se
   MCP_TOKEN_SECRET=<openssl rand -hex 32>
   MCP_ENCRYPTION_KEY=<openssl rand -hex 32>
   SQLITE_PATH=/opt/matrummet/data/mcp.sqlite
   PORT=4008
   NODE_ENV=production
   ```
4. **systemd unit**: install `infra/systemd/matrummet-mcp.service` (units are not auto-deployed):
   ```bash
   sudo cp infra/systemd/matrummet-mcp.service /etc/systemd/system/
   sudo systemctl daemon-reload && sudo systemctl enable --now matrummet-mcp
   ```
   (the unit's `ExecStartPre` creates `/opt/matrummet/data`).
5. **GitHub repo variable**: add `SERVICE_MCP=matrummet-mcp` (Settings → Variables) — the restart
   step uses `${{ vars.SERVICE_MCP }}`.
6. **sudoers**: the deploy user needs passwordless `systemctl restart matrummet-mcp`. The rule is
   already added to `infra/sudoers/deploy_recept`; apply it on the VPS:
   ```bash
   sudo cp infra/sudoers/deploy_recept /etc/sudoers.d/deploy_recept   # then: sudo visudo -c
   ```
   (The nginx `cp … /etc/nginx/sites-enabled/*` rule already covers `mcp.matrummet.se`.)
7. **promtail** (optional, for log labels): the Pino selector edit in `infra/promtail/config.yml`
   is not auto-deployed. Logs already reach Loki via the journal keep-regex; to get level/module
   labels, copy the file to the VPS promtail config path and `sudo systemctl restart promtail`.

### After any nginx change

Run `./infra/nginx/test/test.sh` (Docker) per the repo convention — it now validates
`mcp.conf` routing, header forwarding, and security headers.

## Operational notes

- **Single instance only.** State lives in a WAL SQLite file with one writer. Never run more
  than one instance and never put it behind a load-balancer pool.
- **SQLite contents are non-critical** (OAuth clients, codes, refresh-token state, encrypted
  keys). Worst case on loss = users re-authenticate once. It is not in the backup timers; add a
  `sqlite3 .backup` line to `backup-matrummet.service` if you want it persisted.
- Logs are redacted (no passwords/tokens/keys) and shipped to Loki via promtail
  (`matrummet-mcp.service` is in the Pino selector).
- **Brute-force protection** on the login bridge is per-IP at nginx (`limit_req zone=login` on
  `mcp.conf` `/login` and on `/rpc/issue_api_key`) plus the per-call bcrypt cost. A per-email
  lockout (resistant to distributed IPs) is a known residual hardening, not yet implemented.

## Scope

Tools cover the documented PostgREST API only. **Excluded**: AI generation / meal-plan AI /
substitutions (web-app surface, consume credits), Stripe, Google OAuth, and all admin endpoints.
`delete_recipe` is included as an explicit out-of-docs, destructive tool (requires `confirm:true`).
