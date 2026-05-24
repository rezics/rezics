# Deployment Guide

## Architecture Overview

```
                   ┌──────────────┐
                   │    Nginx     │
                   │ (reverse     │
                   │  proxy)      │
                   └──┬───┬───┬──┘
                      │   │   │
        ┌─────────────┘   │   └─────────────┐
        ▼                 ▼                 ▼
  ┌──────────┐    ┌──────────┐     ┌──────────────┐
  │ App SPA  │    │ Server   │     │ Auth Service │
  │ (static) │    │ :3000    │     │ :3001        │
  └──────────┘    └────┬─────┘     └──────┬───────┘
                       │                  │
                  ┌────▼─────┐      ┌─────▼──────┐
                  │ Server   │      │ Auth       │
                  │ Postgres │      │ Postgres   │
                  └──────────┘      └────────────┘
                       │
                  ┌────▼─────┐
                  │Meilisearch│
                  │ :7700     │
                  └───────────┘
```

| Service | Port | Systemd Unit | Binary Path |
|---|---|---|---|
| Main API Server | 3000 | `rezbooklib.service` | `/www/wwwroot/Library.Book/server/server` |
| Auth Service | 3001 | `rezbookauth.service` | `/www/wwwroot/Library.Book/auth/server` |
| Meilisearch | 7700 | `meilisearch.service` | `/www/wwwroot/meilisearch/meilisearch` |
| App Frontend | static | - | `/opt/1panel/www/sites/book.rezics.com/index/` |
| Admin Frontend | static | - | `/opt/1panel/www/sites/admin.rezics.com/index/` |

## VPS Directory Structure

```
/www/wwwroot/Library.Book/
  server/
    server              # Compiled Elysia binary (main API)
    server.bak          # Previous binary (auto-created by CI for rollback)
    .env.production     # Runtime environment (manually provisioned)
  auth/
    server              # Compiled Elysia binary (auth service)
    server.bak          # Previous binary
    .env.production     # Runtime environment (manually provisioned)

/opt/1panel/www/sites/
  book.rezics.com/index/    # App SPA (Vite build output)
  admin.rezics.com/index/   # Admin SPA (Vite build output)

/www/wwwroot/meilisearch/
  meilisearch               # Meilisearch binary
  config.toml               # Meilisearch config

/etc/systemd/system/
  rezbooklib.service        # Server systemd unit
  rezbookauth.service       # Auth systemd unit
  meilisearch.service       # Meilisearch systemd unit
```

## CI/CD Pipeline

### CI (Pull Requests)

Triggers on PRs to `dev`. Runs:
- `bun run knip` -- detect unused exports/dependencies
- `bun run check:runtime-env` -- validate env isolation

### CD (Deploy on Push to `dev`)

```
push to dev
    │
    ├── build-frontend  ─┐
    ├── build-server    ─┤  (parallel)
    └── build-auth      ─┘
                          │
                          ▼
                       deploy  (sequential)
                          │
                          ├─ 1. Prisma migrations (server + auth)
                          ├─ 2. Server custom SQL (triggers/functions)
                          ├─ 3. Deploy app frontend (rsync)
                          ├─ 4. Deploy admin frontend (rsync)
                          ├─ 5. Deploy server binary (stop → replace → start)
                          ├─ 6. Deploy auth binary (stop → replace → start)
                          └─ 7. Health check
```

The deploy job includes **service self-healing**: if a systemd unit doesn't exist on the VPS, it is automatically installed and enabled from `tool/install-services/`.

### Meilisearch Entity Eligibility Resync

Deploys that include the Entity role eligibility index change must refresh the
`entities` index after Prisma migrations run. Initialize/update the index
settings, then run a full Entity sync so every document contains
`eligibleCreditRoles` and `eligibleSubjectRoles` and no longer relies on
actual-role history facets.

Use the server Meili admin endpoints or the equivalent deployment automation for:

1. `POST /meili/entities/init`
2. `POST /meili/entities/sync`

### GitHub Secrets

Configure these in the repository settings under **Settings > Secrets and variables > Actions**:

| Secret | Example | Purpose |
|---|---|---|
| `VPS_HOST` | `203.0.113.10` | VPS hostname or IP |
| `VPS_USER` | `root` | SSH user with sudo access |
| `VPS_SSH_KEY` | `-----BEGIN OPENSSH...` | SSH private key |
| `VPS_SSH_PORT` | `22` | SSH port |
| `VITE_API_URL` | `https://book-server.rezics.com` | Production API URL |
| `VITE_AUTH_API_URL` | `https://auth.rezics.com` | Production auth URL |
| `VITE_TURNSTILE_SITE_KEY` | `0x4AAA...` | Cloudflare Turnstile site key |

Backend secrets (DATABASE_URL, BETTER_AUTH_SECRET, etc.) are **not** GitHub secrets -- they live in `.env.production` files on the VPS.

## Environment Files

| File | Tracked | Where | Purpose |
|---|---|---|---|
| `package/*/.env.example` | Yes (git) | Package directories | Reference templates |
| `.env` | No | Developer machine | Dev defaults, loaded by `bun dev` / `vite dev` / `prisma` |
| `.env.production` | No | VPS (backend) or CI (frontend) | Production config |

**Backend (server, auth):** `.env.production` is manually provisioned on the VPS. Bun loads it automatically when `NODE_ENV=production` (set by the systemd unit).

**Frontend (app, admin):** `.env.production` is written by the CI workflow from GitHub secrets at build time. Vite embeds the values into the static build output.

## First-Time VPS Setup

### Prerequisites

- Linux server (tested on Fedora/RHEL)
- Bun runtime installed (`curl -fsSL https://bun.sh/install | bash`)
- PostgreSQL with two databases created
- Meilisearch installed and running
- Nginx configured as reverse proxy
- SSH access with key-based auth

### 1. Create directories

```bash
sudo mkdir -p /www/wwwroot/Library.Book/server
sudo mkdir -p /www/wwwroot/Library.Book/auth
sudo mkdir -p /opt/1panel/www/sites/book.rezics.com/index
sudo mkdir -p /opt/1panel/www/sites/admin.rezics.com/index
sudo chown -R www:www /www/wwwroot/Library.Book
```

### 2. Provision environment files

Create `/www/wwwroot/Library.Book/server/.env.production`:

```bash
NODE_ENV=production
DATABASE_URL="postgresql://user:pass@localhost:5432/rezics_booklib?schema=public"
AUTH_INTERNAL_BASE_URL=https://auth.rezics.com
AUTH_PUBLIC_BASE_URL=https://book-server.rezics.com/auth
AUTH_PUBLIC_ISSUER_URL=https://book-server.rezics.com
AUTH_INTERNAL_TOKEN_GATEWAY_SECRET=<same-value-as-auth>
MEILI_HOST=http://127.0.0.1:7700
MEILI_MASTER_KEY=<your-meili-key>
TURNSTILE_SECRET=<your-turnstile-secret>
SMTP_HOST=smtp.example.com
SMTP_USER=support@rezics.com
SMTP_USER_NAME="REZICS Support"
SMTP_PASSWORD=<your-smtp-password>
NOTIFY_BASE_URL=http://localhost:3002
NOTIFY_INTERNAL_SECRET=<your-notify-internal-secret>
REACTION_BASE_URL=http://localhost:3003
REACTION_INTERNAL_SECRET=<your-reaction-internal-secret>
SERVER_INTERNAL_SECRET=<your-server-internal-secret>
```

Create `/www/wwwroot/Library.Book/auth/.env.production`:

```bash
NODE_ENV=production
DATABASE_URL="postgresql://user:pass@localhost:5432/rezics_auth?schema=public"
BETTER_AUTH_URL=https://auth.rezics.com
AUTH_PUBLIC_BASE_URL=https://book-server.rezics.com/auth
AUTH_PUBLIC_ISSUER_URL=https://book-server.rezics.com
BETTER_AUTH_SECRET=<generate-with: openssl rand -base64 32>
AUTH_INTERNAL_TOKEN_GATEWAY_SECRET=<generate-with: openssl rand -base64 32>
AUTH_TRUSTED_ORIGINS="https://book.rezics.com,https://admin.rezics.com"
SMTP_HOST=smtp.example.com
SMTP_USER=support@rezics.com
SMTP_USER_NAME="REZICS Support"
SMTP_PASSWORD=<your-smtp-password>
TURNSTILE_SECRET=<your-turnstile-secret>
# OAuth providers (optional)
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
```

### 3. Install systemd services

On the VPS (or let CI do it automatically via self-healing):

```bash
# From the repo root
cd tool/install-services
bun run install-services.ts
```

### 4. Initialize databases

```bash
# Run initial migrations
cd /www/wwwroot/Library.Book/server
bunx prisma migrate deploy --schema prisma/schema.prisma

cd /www/wwwroot/Library.Book/auth
bunx prisma migrate deploy --schema prisma/schema.prisma

# Run server custom SQL (triggers, functions, indexes)
cd /www/wwwroot/Library.Book/server
bun run prisma/db/index.ts

# Create initial admin user
cd /www/wwwroot/Library.Book/auth
bun run prisma/seed/init-admin.ts
```

### 5. Configure Nginx

See existing Nginx documentation:
- App frontend: `package/app/docs/nginx.md`
- Server backend: `package/server/doc/nginx.md`
- Auth and admin require similar reverse proxy / static serving configuration.

## Rollback

### Binary Rollback

Each deploy creates a `server.bak` backup of the previous binary. To rollback:

```bash
# Server
sudo systemctl stop rezbooklib.service
cp /www/wwwroot/Library.Book/server/server.bak /www/wwwroot/Library.Book/server/server
sudo systemctl start rezbooklib.service

# Auth
sudo systemctl stop rezbookauth.service
cp /www/wwwroot/Library.Book/auth/server.bak /www/wwwroot/Library.Book/auth/server
sudo systemctl start rezbookauth.service
```

### Frontend Rollback

Re-run the deploy workflow on the previous commit, or manually revert and push to `master`.

### Database Rollback

Prisma `migrate deploy` does not support automatic rollback. Mitigations:
- Always write **additive** migrations (add columns/tables, never drop)
- For destructive changes, deploy in two phases: remove code usage first, then drop the column
- For emergencies, restore from a PostgreSQL backup

## Manual Operations

### Run database migrations manually

```bash
cd /www/wwwroot/Library.Book/server
source .env.production
bunx prisma migrate deploy
bun run prisma/db/index.ts   # custom SQL triggers

cd /www/wwwroot/Library.Book/auth
source .env.production
bunx prisma migrate deploy
```

### View service logs

```bash
journalctl -u rezbooklib.service -f    # Server logs
journalctl -u rezbookauth.service -f   # Auth logs
journalctl -u meilisearch.service -f   # Meilisearch logs
```

### Restart services

```bash
sudo systemctl restart rezbooklib.service
sudo systemctl restart rezbookauth.service
```

### Check service status

```bash
systemctl status rezbooklib.service rezbookauth.service meilisearch.service
```
