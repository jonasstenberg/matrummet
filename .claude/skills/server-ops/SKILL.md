---
name: server-ops
description: SSH into the Recept production VPS (37.27.181.252) to manage services, check logs, restart Next.js and PostgREST, and troubleshoot issues. Use when asked about server health, viewing logs, restarting services, or debugging production problems.
allowed-tools: Bash
context: fork
---

# Recept Server Operations

## Connection

```bash
ssh jonas@37.27.181.252
```

## Services

| Service       | Name               | Purpose                |
| ------------- | ------------------ | ---------------------- |
| Next.js app   | `recept`           | Main frontend          |
| Email service | `recept-email`     | Email queue processor  |
| API           | `postgrest-recept` | PostgREST database API |

### Common commands

```bash
# Check status
sudo systemctl status recept recept-email postgrest-recept

# View logs (follow mode)
sudo journalctl -u recept -f
sudo journalctl -u recept-email -f
sudo journalctl -u postgrest-recept -f

# View recent logs
sudo journalctl -u recept --since "10 minutes ago"
sudo journalctl -u recept-email --since "10 minutes ago"

# Restart services
sudo systemctl restart postgrest-recept recept recept-email
```

## Application layout

```
/opt/recept/
├── apps/
│   ├── frontend/         # Next.js application
│   │   ├── server.js
│   │   ├── .next/
│   │   ├── public/uploads/  # User images (persists across deploys)
│   │   └── scripts/
│   └── email-service/    # Email queue processor
│       └── dist/
├── flyway/               # Database migrations
├── .flyway.env           # Flyway credentials
└── .email-service.env    # Email service configuration
```

## Troubleshooting

### Application not responding

1. Check services: `sudo systemctl status recept postgrest-recept`
2. Check logs: `sudo journalctl -u recept -n 100`
3. Check nginx: `sudo nginx -t && sudo systemctl status nginx`
4. Restart: `sudo systemctl restart postgrest-recept recept`

### Database connection issues

1. Check PostgREST: `sudo systemctl status postgrest-recept`
2. View logs: `sudo journalctl -u postgrest-recept -n 50`
3. Restart: `sudo systemctl restart postgrest-recept`

For nginx configuration and deployment details, see [REFERENCE.md](REFERENCE.md).
