# Production Runtime Inventory

Authoritative inventory of the packages that make up a production deployment:
their runtime role, ports, health surface, Drizzle-schema ownership, required
environment, and external dependencies. This is the factual baseline the
`establish-production-deployment-foundation` work builds Docker images, Kamal
units, and migration jobs on top of.

Snapshot date: 2026-05-29. Verify against `package/*/package.json` and each
service's `src/env.ts` before relying on a specific value.

## Role Classification

| Package | Role | Notes |
|---|---|---|
| `@rezics/server` | backend-http-service | Main API; owns the primary schema; issues JWTs |
| `@rezics/auth` | backend-http-service | Authentication; separate schema; issues JWKS |
| `@rezics/notify` | backend-http-service | Notifications + DM storage |
| `@rezics/reaction` | backend-http-service | Reactions; own DB; CDC source |
| `@rezics/history` | backend-http-service | Editorial revision history |
| `@rezics/ranking` | backend-http-service | Ranking projections; **internal-only** |
| `@rezics/job-runner` | worker + http (role-switched) | Single binary; role via `JOB_RUNNER_ROLE` |
| `@rezics/preview` | tooling/non-production | SSR preview; **excluded** from the first production set (see below) |
| `@rezics/app` | static-frontend | Main SPA (Vite build) |
| `@rezics/admin` | static-frontend | Admin SPA (Vite build) |
| `@rezics/contract`, `@rezics/api`, `@rezics/shared`, `@rezics/job`, `@rezics/jwt`, `@rezics/search`, `@rezics/email`, `@rezics/i18n`, `@rezics/ui`, `@rezics/editor`, `@rezics/folio` | library-only | Built into consumers; no standalone runtime |
| `@rezics/utils`, `@rezics/storybook-config` | tooling/non-production | Seeding/CLI and Storybook config |

## Backend Services

Each backend service compiles to a single Linux amd64 binary via its
`build:linux` script (`bun build … --target bun-linux-x64`). `server` and
`auth` additionally ship a cluster entrypoint (`src/cluster.ts`); the rest are
single-process (`src/index.ts`).

### `@rezics/server`

- **Entrypoint**: `src/index.ts` (single), `src/cluster.ts` (cluster). `build:linux` compiles `cluster.ts`.
- **Port**: `PORT`, default `3000`.
- **Health**: `/health` (always 200). System aggregator at `/diagnostic/system`; `/meili/health`. No dedicated `/ready`.
- **Schema owner**: yes — `package/server/src/db/schema` (PostgreSQL, the primary application DB; largest schema). `ranking` and `history` read this DB.
- **Key env**: `DATABASE_URL`, `AUTH_INTERNAL_BASE_URL`, `AUTH_PUBLIC_BASE_URL`, `AUTH_PUBLIC_ISSUER_URL`, `AUTH_INTERNAL_TOKEN_GATEWAY_SECRET`, `SMTP_HOST/USER/PASSWORD`, `TURNSTILE_SECRET`, `MEILI_HOST`, `MEILI_MASTER_KEY`, `NOTIFY_BASE_URL`, `NOTIFY_INTERNAL_SECRET`, `REACTION_BASE_URL`, `REACTION_INTERNAL_SECRET`. Optional: `HISTORY_BASE_URL`, `JOB_RUNNER_BASE_URL`, `JOB_RUNNER_INTERNAL_SECRET`.
- **External deps**: PostgreSQL (primary), Meilisearch, SMTP, Cloudflare Turnstile; internal HTTP to auth/notify/reaction/history/job-runner.
- **Routing**: public.

### `@rezics/auth`

- **Entrypoint**: `src/index.ts` / `src/cluster.ts` (build:linux compiles `cluster.ts`).
- **Port**: `PORT`, default `3001`.
- **Health**: `/health`. No `/ready`.
- **Schema owner**: yes — `package/auth/src/db/schema` (PostgreSQL; Better Auth user/session/account). Separate DB from server.
- **Key env**: `DATABASE_URL`, `BETTER_AUTH_URL`, `AUTH_PUBLIC_BASE_URL`, `AUTH_PUBLIC_ISSUER_URL`, `BETTER_AUTH_SECRET`, `AUTH_INTERNAL_TOKEN_GATEWAY_SECRET`, `SMTP_HOST/USER/PASSWORD`, `TURNSTILE_SECRET`. Optional OAuth provider client id/secret pairs (Google, Microsoft, GitHub, Twitter, Telegram).
- **External deps**: PostgreSQL (auth), SMTP, Turnstile, external OAuth providers.
- **Routing**: public.

### `@rezics/notify`

- **Entrypoint**: `src/index.ts` (single-process).
- **Port**: `PORT` (no in-code default; must be set).
- **Health**: `/health`. No `/ready`.
- **Schema owner**: yes — `package/notify/src/db/schema` (Notification, Conversation, ConversationMessage). DB via `NOTIFY_DATABASE_URL`.
- **Key env**: `NOTIFY_DATABASE_URL`, `NOTIFY_INTERNAL_SECRET`, `SERVER_JWKS_URL`, `SERVER_ISSUER` (default `rezics-server`). Optional SMTP (`SMTP_*`).
- **External deps**: PostgreSQL (notify), optional SMTP, server JWKS for JWT validation.
- **Routing**: proxied (internal callers + JWT-bearing clients).

### `@rezics/reaction`

- **Entrypoint**: `src/index.ts` (single-process).
- **Port**: `PORT` (no in-code default).
- **Health**: `/health`. No `/ready`.
- **Schema owner**: yes — `package/reaction/src/db/schema` (Reaction, ReactionSummary). DB via `REACTION_DATABASE_URL`. **CDC source** (Sequin) alongside the main DB.
- **Key env**: `REACTION_DATABASE_URL`, `REACTION_INTERNAL_SECRET`, `SERVER_JWKS_URL`, `SERVER_ISSUER`, `REACTION_TYPES` (default `like,dislike`).
- **External deps**: PostgreSQL (reaction), server JWKS.
- **Routing**: proxied.

### `@rezics/history`

- **Entrypoint**: `src/index.ts` (single-process).
- **Port**: `PORT` (no in-code default).
- **Health**: `/health` **and** `/ready`.
- **Schema owner**: yes — `package/history/src/db/schema` (UnitRevision, RevisionContent, UnitRevisionPath). DB via `HISTORY_DATABASE_URL`; also reads the main DB via `SERVER_DATABASE_URL`.
- **Key env**: `HISTORY_DATABASE_URL`, `SERVER_DATABASE_URL`, `HISTORY_INTERNAL_SECRET`.
- **External deps**: PostgreSQL (history) + read on the main DB.
- **Routing**: proxied.

### `@rezics/ranking`

- **Entrypoint**: `src/index.ts` (single-process).
- **Port**: `PORT`, default `3006`.
- **Health**: `/health`, `/ready` (observability), and `/ranking/ready` (service readiness; 503 until warm).
- **Schema owner**: yes — `package/ranking/src/db/schema` (ranking projections and signal buckets). DB via `RANKING_DATABASE_URL`; reads the main DB via `SERVER_DATABASE_URL`.
- **Key env**: `RANKING_DATABASE_URL`, `SERVER_DATABASE_URL`, `REACTION_BASE_URL`, `REACTION_INTERNAL_SECRET`, `MEILI_HOST`, `MEILI_MASTER_KEY`. Optional: `RANKING_FULL_SYNC_LIMIT`.
- **External deps**: PostgreSQL (ranking) + read on main DB, Meilisearch, reaction service.
- **Routing**: **internal-only** — no public proxy route, no public CORS.

### `@rezics/job-runner`

- **Entrypoint**: `src/index.ts`. Behavior is selected by `JOB_RUNNER_ROLE` ∈ `{all, http, worker}` (default `all`) — **one binary, not separate `job-runner-http`/`job-runner-worker` artifacts**. `worker` runs the pg-boss consumers; `http` exposes the enqueue/admin/webhook surface; `all` runs both.
- **Port**: `PORT`, default `3005` (only bound when the role includes HTTP).
- **Health**: `/health` and `/ready`. HTTP surface also exposes `/admin/*`, `/enqueue/*` (internal), `/webhooks/sequin`.
- **Schema owner**: no application schema; uses pg-boss tables in `JOB_DATABASE_URL`.
- **Key env**: `JOB_DATABASE_URL`, `SERVER_DATABASE_URL`, `HISTORY_DATABASE_URL`, `MEILI_HOST`, `MEILI_MASTER_KEY`, `JOB_RUNNER_INTERNAL_SECRET`, `SEQUIN_WEBHOOK_SECRET`. Optional: `RANKING_BASE_URL`, `RANKING_INTERNAL_SECRET`, `SEQUIN_HEALTH_URL`, `JOB_RUNNER_ROLE`.
- **External deps**: PostgreSQL (job queue) + reads on main and history DBs, Meilisearch, Sequin CDC, ranking service.
- **Routing**: internal-only (HTTP role), workers have no inbound routing.

## Static Frontends

- `@rezics/app` and `@rezics/admin` both build with `vite build` to static assets. Public runtime config is build-time `VITE_*` (Cloudflare build variables); **no secrets in static assets**. Served by the edge/proxy, not as containers in the backend service set.

## Shared Observability Env Contract

All backend services declare the same observability variables in their
`src/env.ts` (validated with `@t3-oss/env-core` + Valibot) and feed them into
`createObservabilityConfig()` / `createTelemetryConfig()` from
`package/shared/src/observability/config.ts`:

| Variable | Values | Default | Purpose |
|---|---|---|---|
| `OBSERVABILITY_LOG_FORMAT` | `local` \| `json` | `json` in prod, `local` in dev | Log output format |
| `OBSERVABILITY_COLOR` | boolean | `true` (local only) | ANSI color in local logs |
| `OBSERVABILITY_SLOW_REQUEST_MS` | number | `500` | Slow-request log threshold |
| `OBSERVABILITY_TELEMETRY` | `auto` \| `disabled` \| `enabled` \| `required` | `auto` | OpenTelemetry mode |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | URL | unset | OTLP HTTP trace endpoint |

Production guidance: set `OBSERVABILITY_LOG_FORMAT=json` on every service, and
set `OTEL_EXPORTER_OTLP_ENDPOINT` (with `OBSERVABILITY_TELEMETRY=enabled` or
`required`) only when the opt-in `infra-observability` unit is deployed.

## `@rezics/preview` — Non-Production

`@rezics/preview` is SSR preview tooling: it has only a `dev` script (no
`build`/`build:linux`), requires `SERVER_PORT` (no default) and read-only
`DATABASE_URL`. It is **excluded from the first production service set** and is
not given a Docker image, Kamal unit, or migration job in this foundation.

## Health/Readiness and Graceful-Shutdown Gaps

Current state vs. the production target (every backend service should expose
`/health` + `/ready` and handle SIGTERM with connection draining):

| Service | `/health` | `/ready` | Gap |
|---|---|---|---|
| server | ✓ | ✓ | confirm graceful shutdown |
| auth | ✓ | ✓ | confirm graceful shutdown |
| notify | ✓ | ✓ | set an explicit default `PORT` |
| reaction | ✓ | ✓ | set an explicit default `PORT` |
| history | ✓ | ✓ | confirm graceful shutdown |
| ranking | ✓ | ✓ (`/ready`, `/ranking/ready`) | reference for the others |
| job-runner | ✓ | ✓ | confirm pg-boss drain on SIGTERM |

All backend services now expose both `/health` and `/ready` (added to
server/auth/notify/reaction). The readiness route is a process-liveness check
matching the existing `history` pattern; dependency-aware readiness (DB ping)
is a possible refinement.

Spec-assumption corrections surfaced by this inventory:

- There is **no** separate `job-runner-http` / `job-runner-worker` binary — the split is the `JOB_RUNNER_ROLE` env switch on one image. Kamal should run two roles off the same image rather than two build targets.
- There is **no** standalone `ranking-worker` today. Ranking is a single internal HTTP service; ranking jobs are dispatched through `job-runner`'s ranking runtime. A dedicated `ranking-worker` role (task 2.4) would be net-new.
- `notify` and `reaction` have **no in-code default port**; deployment env must set `PORT` explicitly for them.
- Cross-package database reads go through explicit `@rezics/server/db/*`
  surfaces; do not import generated ORM internals across package boundaries.

## Image Build Status

Verified locally (`docker build` from repo root, after building `docker/base.Dockerfile`):

| Image | Builds | Boots (no real DB) | Notes |
|---|---|---|---|
| reaction | ✓ | ✓ `/health` 200 | self-contained schema |
| notify | ✓ | ✓ `/health` 200 | self-contained schema |
| history | ✓ | ✓ `/health` + `/ready` 200 | cross-schema (server client) |
| auth | ✓ | ✓ `/health` 200 | cluster entry |
| ranking | ✓ | ✓ `/health` 200 | cross-schema, internal-only |
| server | ✓ | binary runs to DB connect | eager DB at boot; needs Postgres |
| job-runner | ✓ | binary runs to DB connect | eager pg-boss connect; needs Postgres |

Runtime images are ~75–110 MB (slim Debian + the self-contained compiled
binary; Drizzle uses the pure-JS `pg` driver, so no query engine is shipped).
