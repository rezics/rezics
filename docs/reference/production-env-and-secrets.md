# Production Env and Secrets Schema

Per-deployment-unit environment contract: which values each unit requires,
their default, the owning unit, and secret vs non-secret classification. The
exhaustive per-service variable lists live in
[Production Runtime Inventory](./production-runtime-inventory.md); this document
adds the deployment framing SOPS + Kamal consume.

Snapshot date: 2026-05-29.

## Classification Rules

- **Secret** — credentials or signing material; lives only in the SOPS-encrypted
  per-unit env file (age-decrypted at deploy, surfaced to Kamal as secrets).
  Never baked into an image layer or a static frontend bundle.
- **Non-secret** — endpoints, ports, mode flags, tuning. May live in plain Kamal
  env/config.
- **Frontend public config** (`VITE_*`) is build-time Cloudflare variables, not a
  backend deployment unit; it must never contain secrets.

## Shared Secrets (cross-unit)

These are referenced by multiple service units and must hold identical values
on each side of the call:

| Variable | Secret | Producers → Consumers |
|---|---|---|
| `AUTH_INTERNAL_TOKEN_GATEWAY_SECRET` | ✓ | auth ↔ server |
| `NOTIFY_INTERNAL_SECRET` | ✓ | server → notify |
| `REACTION_INTERNAL_SECRET` | ✓ | server, ranking → reaction |
| `HISTORY_INTERNAL_SECRET` | ✓ | server → history |
| `JOB_RUNNER_INTERNAL_SECRET` | ✓ | server → job-runner |
| `RANKING_INTERNAL_SECRET` | ✓ | job-runner → ranking |
| `SEQUIN_WEBHOOK_SECRET` | ✓ | infra-cdc → job-runner |
| `MEILI_MASTER_KEY` | ✓ | infra-search → server, ranking, job-runner |
| `BETTER_AUTH_SECRET` | ✓ | auth only |
| `TURNSTILE_SECRET` | ✓ | server, auth |
| `SMTP_PASSWORD` | ✓ | server, auth, notify |

Database URLs (`DATABASE_URL`, `NOTIFY_DATABASE_URL`, `REACTION_DATABASE_URL`,
`HISTORY_DATABASE_URL`, `RANKING_DATABASE_URL`, `JOB_DATABASE_URL`,
`SERVER_DATABASE_URL`) are **secret** (they embed credentials). Each is owned by
its schema's `infra-db` instance and consumed by the matching service plus any
read-only consumer (history/ranking/job-runner read `SERVER_DATABASE_URL`).

## Per-Unit Env Schema

Required = the service fails validation at boot without it. Defaults are the
in-code fallbacks; everything else must be supplied.

### `server` (public)

| Variable | Req | Secret | Default |
|---|---|---|---|
| `DATABASE_URL` | ✓ | ✓ | — |
| `AUTH_INTERNAL_BASE_URL`, `AUTH_PUBLIC_BASE_URL`, `AUTH_PUBLIC_ISSUER_URL` | ✓ | — | — |
| `AUTH_INTERNAL_TOKEN_GATEWAY_SECRET` | ✓ | ✓ | — |
| `SMTP_HOST`, `SMTP_USER` | ✓ | — | — |
| `SMTP_PASSWORD` | ✓ | ✓ | — |
| `TURNSTILE_SECRET` | ✓ | ✓ | — |
| `MEILI_HOST` | ✓ | — | — |
| `MEILI_MASTER_KEY` | ✓ | ✓ | — |
| `NOTIFY_BASE_URL`, `REACTION_BASE_URL` | ✓ | — | — |
| `NOTIFY_INTERNAL_SECRET`, `REACTION_INTERNAL_SECRET` | ✓ | ✓ | — |
| `HISTORY_BASE_URL`, `JOB_RUNNER_BASE_URL` | — | — | — |
| `JOB_RUNNER_INTERNAL_SECRET` | — | ✓ | — |
| `PORT` | — | — | `3000` |
| `WORKERS` | — | — | (cluster default) |

### `auth` (public)

| Variable | Req | Secret | Default |
|---|---|---|---|
| `DATABASE_URL` | ✓ | ✓ | — |
| `BETTER_AUTH_URL`, `AUTH_PUBLIC_BASE_URL`, `AUTH_PUBLIC_ISSUER_URL` | ✓ | — | — |
| `BETTER_AUTH_SECRET`, `AUTH_INTERNAL_TOKEN_GATEWAY_SECRET` | ✓ | ✓ | — |
| `SMTP_HOST`, `SMTP_USER` | ✓ | — | — |
| `SMTP_PASSWORD` | ✓ | ✓ | — |
| `TURNSTILE_SECRET` | ✓ | ✓ | — |
| `{GOOGLE,MICROSOFT,GITHUB,TWITTER,TELEGRAM}_CLIENT_ID` | — | — | — |
| `{GOOGLE,MICROSOFT,GITHUB,TWITTER,TELEGRAM}_CLIENT_SECRET` | — | ✓ | — |
| `PORT` | — | — | `3001` |

### `notify` (proxied)

| Variable | Req | Secret | Default |
|---|---|---|---|
| `NOTIFY_DATABASE_URL` | ✓ | ✓ | — |
| `NOTIFY_INTERNAL_SECRET` | ✓ | ✓ | — |
| `SERVER_JWKS_URL` | ✓ | — | — |
| `SERVER_ISSUER` | — | — | `rezics-server` |
| `SMTP_*` | — | mixed | — |
| `PORT` | ✓ (no default) | — | — |

### `reaction` (proxied)

| Variable | Req | Secret | Default |
|---|---|---|---|
| `REACTION_DATABASE_URL` | ✓ | ✓ | — |
| `REACTION_INTERNAL_SECRET` | ✓ | ✓ | — |
| `SERVER_JWKS_URL` | ✓ | — | — |
| `SERVER_ISSUER` | — | — | `rezics-server` |
| `REACTION_TYPES` | — | — | `like,dislike` |
| `PORT` | ✓ (no default) | — | — |

### `history` (proxied)

| Variable | Req | Secret | Default |
|---|---|---|---|
| `HISTORY_DATABASE_URL` | ✓ | ✓ | — |
| `SERVER_DATABASE_URL` | ✓ | ✓ | — |
| `HISTORY_INTERNAL_SECRET` | ✓ | ✓ | — |
| `HISTORY_QUEUE_INGESTION_ENABLED` | — | — | `true` |
| `HISTORY_OUTBOX_POLLER_FALLBACK`, `HISTORY_OUTBOX_POLL_MS` | — | — | — |
| `PORT` | — | — | (none) |

### `ranking` (internal-only)

| Variable | Req | Secret | Default |
|---|---|---|---|
| `RANKING_DATABASE_URL` | ✓ | ✓ | — |
| `SERVER_DATABASE_URL` | ✓ | ✓ | — |
| `REACTION_BASE_URL` | ✓ | — | — |
| `REACTION_INTERNAL_SECRET` | ✓ | ✓ | — |
| `MEILI_HOST` | ✓ | — | — |
| `MEILI_MASTER_KEY` | ✓ | ✓ | — |
| `RANKING_FULL_SYNC_LIMIT` | — | — | — |
| `PORT` | — | — | `3006` |

### `job-runner-http` / `job-runner-worker` (internal; same image, role-switched)

| Variable | Req | Secret | Default |
|---|---|---|---|
| `JOB_DATABASE_URL` | ✓ | ✓ | — |
| `SERVER_DATABASE_URL`, `HISTORY_DATABASE_URL` | ✓ | ✓ | — |
| `MEILI_HOST` | ✓ | — | — |
| `MEILI_MASTER_KEY` | ✓ | ✓ | — |
| `JOB_RUNNER_INTERNAL_SECRET` | ✓ | ✓ | — |
| `SEQUIN_WEBHOOK_SECRET` | ✓ | ✓ | — |
| `RANKING_BASE_URL` | — | — | — |
| `RANKING_INTERNAL_SECRET` | — | ✓ | — |
| `SEQUIN_HEALTH_URL` | — | — | — |
| `JOB_RUNNER_ROLE` | — | — | `all` (`http` / `worker` per role unit) |
| `PORT` | — | — | `3005` |

## Shared Observability (all backend units)

Non-secret except none. Defaults from `@rezics/shared`: see the
[runtime inventory](./production-runtime-inventory.md#shared-observability-env-contract).
Production sets `OBSERVABILITY_LOG_FORMAT=json`; `OTEL_EXPORTER_OTLP_ENDPOINT`
+ `OBSERVABILITY_TELEMETRY=enabled` only when the `infra-observability` unit is
deployed.

## Frontend Public Config (Cloudflare, build-time)

`package/app` and `package/admin` are static Vite SPAs deployed to Cloudflare
Pages (no Docker, no SSR). Their `VITE_*` values are **build-time** public
config — inlined into the bundle, never secret. Set them as Cloudflare build
environment variables; rebuild to change them.

| App | Variable | Points at |
|---|---|---|
| app | `VITE_API_URL` | public `server` |
| app | `VITE_NOTIFY_BASE_URL` | public `notify` |
| app | `VITE_REACTION_SERVICE_URL` | public `reaction` |
| app | `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile **site** key (public) |
| admin | `VITE_API_URL` | public `server` |
| admin | `VITE_AUTH_ADMIN_URL` | `auth` admin surface |
| admin | `VITE_REACTION_SERVICE_URL` | public `reaction` |

`ranking` is internal-only and is never a frontend endpoint. Deploy backends
before frontends so the API contract a new bundle expects already exists.

## Migration Jobs

One-shot jobs reuse their service's `*_DATABASE_URL` (secret) and run
`prisma migrate deploy` from the same image revision before the service rolls
out. `job-runner` has no schema; its DB prep is the pg-boss `db:ensure` step
against `JOB_DATABASE_URL`.
