---
name: boot-local
description: Kill all running local development processes (Next.js dev, email service, PostgREST), wait for termination, then restart them. Use when user says "boot local", "restart local", "reboot dev", or needs to refresh local services.
allowed-tools: Bash, TaskOutput
context: fork
---

# Boot Local

> Kill and restart all local development services when the dev environment needs a fresh start.

<when_to_use>

## When to Use

Invoke when user says:

- "boot local"
- "restart local"
- "reboot dev"
- "restart all services"
- "kill and restart"
</when_to_use>

<workflow>

## Workflow

| Phase | Action                                           |
| ----- | ------------------------------------------------ |
| 1     | Kill running processes on ports 3000, 4444       |
| 2     | Wait for termination, verify ports free           |
| 3     | Start all services in background                  |
| 4     | Verify startup (check logs and health)            |
| 5     | Display status report                             |

Use `run_in_background: true` for start commands to avoid blocking.
</workflow>

<services>

## Services

| Service        | Command                | Port | Health Check                |
| -------------- | ---------------------- | ---- | --------------------------- |
| Next.js dev    | `pnpm dev`             | 3000 | http://localhost:3000        |
| PostgREST API  | `./start-postgrest.sh` | 4444 | http://localhost:4444/       |

### Optional Services

| Service        | Command                     | Port | When Needed                |
| -------------- | --------------------------- | ---- | -------------------------- |
| Inbucket       | `docker compose up -d inbucket` | 9050 | Email testing              |
| Email service  | Part of `pnpm dev`          | -    | Runs via monorepo dev      |

Note: `pnpm dev` runs all apps in parallel (frontend + email-service) via `pnpm -r --parallel dev`.
</services>

<execution>

## Phase 1: Kill Running Processes

Find and kill processes on development ports:

```bash
# Find process on port 3000 (Next.js)
lsof -ti :3000 | xargs kill -9 2>/dev/null || true

# Find process on port 4444 (PostgREST)
lsof -ti :4444 | xargs kill -9 2>/dev/null || true
```

## Phase 2: Verify Ports Free

```bash
# Verify ports are free
lsof -ti :3000 && echo "Port 3000 still in use" || echo "Port 3000 free"
lsof -ti :4444 && echo "Port 4444 still in use" || echo "Port 4444 free"
```

Wait up to 5 seconds for processes to terminate. If ports still occupied, report to user.

## Phase 3: Start Services

Start services using `run_in_background: true`:

1. **PostgREST** (start first, frontend depends on API):
   ```bash
   cd /Users/jonasstenberg/Development/Private/recept && ./start-postgrest.sh
   ```

2. **All apps** (Next.js + email service):
   ```bash
   cd /Users/jonasstenberg/Development/Private/recept && pnpm dev
   ```

## Phase 4: Verify Startup

Wait for services to be available:

```bash
# Check PostgREST (should respond quickly)
curl -sf http://localhost:4444/ > /dev/null && echo "PostgREST OK" || echo "PostgREST NOT READY"

# Check Next.js (may take a few seconds for Turbopack)
curl -sf http://localhost:3000 > /dev/null && echo "Next.js OK" || echo "Next.js NOT READY"
```

## Phase 5: Status Report

Display summary:

```
Local Development Services
--------------------------
PostgREST API:  http://localhost:4444  [OK/FAILED]
Next.js:        http://localhost:3000  [OK/FAILED]
Email service:  running via pnpm dev   [OK/FAILED]
```

</execution>

<troubleshooting>

## Troubleshooting

| Issue                  | Cause                          | Fix                                      |
| ---------------------- | ------------------------------ | ---------------------------------------- |
| Port 3000 won't free   | Zombie Next.js process         | `kill -9 $(lsof -ti :3000)`              |
| PostgREST won't start  | PostgreSQL not running         | Start PostgreSQL first                   |
| PostgREST config error | Missing postgrest.cfg          | Check `postgrest.cfg` exists in root     |
| pnpm dev fails         | Missing dependencies           | Run `pnpm install` first                 |
| Port 4444 in use       | Another PostgREST instance     | `kill -9 $(lsof -ti :4444)`              |

</troubleshooting>

<approval_gates>

## Approval Gates

| Gate | Phase | Question                                             |
| ---- | ----- | ---------------------------------------------------- |
| None | -     | No destructive operations; all local process cleanup |

</approval_gates>
