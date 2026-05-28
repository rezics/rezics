## Context

Rezics is a Bun + TypeScript monorepo with Vite static frontends and multiple
Elysia/Prisma backend services. Current deployment support is split between:

- `tool/external-services`, a local-development Docker Compose workflow for
  source PostgreSQL, Meilisearch, Sequin, Sequin-owned state services, and a
  local OpenTelemetry Collector;
- package-local `build:linux` scripts on some backend packages;
- an ad-hoc path (`tool/deploy-script` plus a `master`-triggered `deploy.yml`)
  that builds binaries in CI, then rsyncs them over SSH to a 1Panel VPS where
  services run as **systemd units** with a plaintext `.env.production`.

That model is not a production deployment foundation. It only covers `server`,
`auth`, and the two frontends; it does not run `notify`, `reaction`, `history`,
`job-runner`, or the newly added `ranking` service. It also predates the applied
`standardize-elysia-observability` and `introduce-ranking-service` changes, which
added shared observability helpers, a new `@rezics/ranking` HTTP service with its
own database, a dedicated ranking job lane, and a second Sequin CDC source for
the reaction database.

The target design assumes production may start on one host, but deployment units
must remain separable. Same-host placement is an implementation detail; lifecycle
boundaries are the architecture.

## Goals / Non-Goals

**Goals:**

- Build immutable production artifacts for every package-owned backend runtime
  service, including the `ranking` service.
- Compile Elysia HTTP services into Linux binaries and run them through
  production cluster entrypoints.
- Keep worker concurrency explicit and separate from HTTP cluster behavior,
  including a dedicated ranking worker role distinct from `job-runner-worker`.
- Deploy `package/app` and `package/admin` as Cloudflare static Vite outputs,
  without SSR and without Docker images.
- Split production deployment units by lifecycle at per-service granularity:
  database infrastructure, search infrastructure, CDC infrastructure, opt-in
  observability infrastructure, proxy, each backend HTTP service, each worker
  role, and migration jobs.
- Automate releases with repeatable image publishing, migration execution,
  service rollout, health verification, and rollback through a purpose-built
  deployment tool rather than hand-written scripts.
- Manage production env/secrets through an auditable, encrypted, GitOps-friendly
  workflow with per-unit schemas.

**Non-Goals:**

- Do not use the local `tool/external-services` compose project as the
  production deployment shape.
- Do not require Kubernetes, Docker Swarm, or Nomad as the baseline production
  target.
- Do not Dockerize `package/app` or `package/admin`.
- Do not introduce SSR.
- Do not make app container startup run schema migrations implicitly.
- Do not make the self-hosted observability analysis backend a hard runtime
  dependency of the application services.

## Decisions

### Decision: Deployment units are separated by lifecycle, per service

Production deployment units are split by lifecycle, and the application tier is
split per service rather than as one bundled group:

```text
production host or hosts
  proxy/              kamal-proxy (TLS + zero-downtime)
  infra-db/           one PostgreSQL instance, database-per-service
  infra-search/       Meilisearch
  infra-cdc/          Sequin + Redis + Sequin state DB; two sources (main + reaction)
  infra-observability/ OTel Collector + ClickStack (opt-in, off by default)
  services-api/       server | auth | notify | reaction | history | ranking
  workers/            job-runner-worker | ranking-worker
  migrations/         one-shot per-service migration jobs
  (frontends)         package/app + package/admin -> Cloudflare
```

Each unit has its own deployment configuration, env contract, state location,
deploy/rollback target, and health expectation. Each backend HTTP service and
each worker role is its own independently deployable unit so it can be released,
scaled, and rolled back without touching siblings. Units may share an external
Docker network on a single host, but service URLs MUST be explicit env values so
that any unit can move to another host or managed provider later.

Alternative considered: bundle all HTTP services into one `services-api` unit.
Rejected because the user requires per-service independent deployment, and
bundling re-couples release and rollback across unrelated services.

Alternative considered: one production compose file for everything. Rejected
because it couples unrelated rollouts and weakens secrets boundaries.

### Decision: Orchestration uses Kamal over a GHCR registry

Production deployment is orchestrated with **Kamal**, not hand-written `.sh` or a
bespoke TypeScript deploy CLI. Kamal fits the "Docker images on a VPS without
Kubernetes" target and provides, as configuration rather than custom code:

- registry-based rollout: pull immutable image tags from GHCR;
- per-service apps and roles (web roles and worker roles);
- `kamal-proxy` for TLS termination and health-gated zero-downtime swaps;
- built-in rollback to a previous image version;
- accessories for self-hosted infrastructure (PostgreSQL, Meilisearch, Sequin,
  Redis, OTel Collector/ClickStack);
- secret integration (see SOPS decision) so secrets are never baked into images.

Kamal runs from CI (GitHub Actions) or an operator laptop and installs nothing
persistent on the host beyond the app containers and `kamal-proxy`. A top-level
deploy invocation sequences the units in dependency order (infra → migrations →
services → workers), satisfying the "everything split, one command strings them
together" requirement.

Alternative considered: a typed Bun deploy CLI wrapping `docker compose`.
Rejected as more surface to build and maintain (proxy, zero-downtime, rollback,
secrets all hand-rolled) for no advantage over Kamal.

Alternative considered: a dashboard PaaS (Coolify/Dokploy). Rejected: it favors
UI-driven management over GitOps/code-defined config, and Coolify disclosed
multiple CVSS 10.0 vulnerabilities in early 2026.

### Decision: Backend services publish immutable images

Backend runtime packages publish images to **GHCR**. Image tags include the git
SHA and may also include release tags. Deployment units select image versions
through Kamal config; production hosts pull images rather than build source.

Affected runtime services:

- `package/server`
- `package/auth`
- `package/notify`
- `package/reaction`
- `package/history`
- `package/job-runner`
- `package/ranking`

`package/preview` is classified as non-production tooling and excluded from the
first production service set. Library packages remain build inputs and are not
deployed as standalone images.

Alternative considered: build binaries on the production host (the current
path). Rejected because it makes releases depend on mutable host state, slows
rollbacks, and obscures which source revision is running.

### Decision: Images use a shared base plus thin per-service Dockerfiles

A shared multi-stage base image installs the Bun workspace once; each service
adds a thin Dockerfile that compiles and packages only its artifact. The build
context is the repo root so workspace packages (including `@rezics/shared`
observability helpers, and `@rezics/server`'s generated Prisma client consumed by
ranking) are available. Bun + Prisma constraints are mandatory in the build:

- run `prisma generate` in a stage that has Node available (Prisma does not yet
  fully support the bare Bun image);
- supply a dummy `DATABASE_URL` at build time to satisfy the Prisma generator,
  never a real secret;
- `bun install --ignore-scripts` so install does not trigger generate;
- copy the generated Prisma client and query engine into the runtime image
  alongside the compiled binary;
- final runtime image is slim/distroless and runs as a non-root user;
- aggressive `.dockerignore` so the whole monorepo is not sent as build context.

Alternative considered: a fully independent Dockerfile per service. Rejected
because the recipe is identical across seven services and would drift; a shared
base keeps one source of truth while each service still produces its own image.

### Decision: Elysia HTTP services use compiled cluster entrypoints

HTTP services use production entrypoints that compile to Linux binaries and run
cluster mode. Cluster worker count is configurable with an env var such as
`WORKERS`, with a safe default derived from available parallelism. Primary
processes replace failed workers and handle signals so container shutdown is
graceful. Startup banners and request/error logging use the shared
`@rezics/shared` observability helpers rather than per-service ad-hoc output.

`package/server` and `package/auth` already have a `src/cluster.ts` shape. This
change standardizes that pattern across the other Elysia HTTP services. `ranking`
currently only calls `app.listen(port)` and MUST gain a cluster entrypoint.

### Decision: Worker roles are deployed and scaled independently

Workers are not blindly clustered. `package/job-runner` has role-based behavior;
production separates:

- `job-runner-http`, for enqueue/admin/webhook HTTP routes;
- `job-runner-worker`, for queue consumption with explicit replica/concurrency
  configuration;
- `ranking-worker`, a dedicated worker deployment that consumes the ranking job
  lane so ranking recompute bursts cannot starve sync/search/CDC lanes.

Ranking computation runs in the worker tier (the ranking lane), which calls the
ranking service's `/ranking/command` over `RANKING_BASE_URL`; the ranking
service itself is HTTP-only and does not consume the queue.

### Decision: The ranking service is internal-only with a rebuildable DB

`package/ranking` is reachable only from internal callers (`job-runner` via
`RANKING_BASE_URL`); no frontend calls it. It is NOT routed through the public
proxy and does not receive public CORS origins. It depends on three backends:

- its own ranking PostgreSQL database (`RANKING_DATABASE_URL`);
- read access to the main server database (via `@rezics/server`'s generated
  Prisma client) for signal inputs;
- Meilisearch, to patch ranking fields onto `content`/`posts` documents.

The ranking database is treated as a **rebuildable projection tier**: lighter
backup expectations, recovery by wipe + full ranking backfill rather than DB
restore, and rollback by recompute. It is still its own deployment unit/database;
only its durability SLA differs.

### Decision: PostgreSQL starts as one instance, database-per-service

Production starts with a single self-hosted PostgreSQL instance hosting a
separate database and role per service (`auth`, `server`, `notify`, `reaction`,
`history`, `ranking`, and the `job-runner` queue database). Each service connects
through its own explicit connection URL. This is the industry "hybrid" middle
ground: low operational cost on a single host while preserving the ability to
split any database onto its own instance or a managed provider later by changing
only its URL.

Alternative considered: one PostgreSQL instance/container per service from day
one. Rejected for v1 because it multiplies memory, connection, and operational
overhead before independent scaling is actually needed; the explicit-URL
contract keeps that path open.

### Decision: Migrations are explicit release steps

Prisma migrations run as one-shot release jobs before HTTP service rollout, using
the same image revision being deployed but a separate command/profile from normal
startup. Release automation stops on migration failure and does not update runtime
services. Migration order follows database ownership; ranking owns only its own
schema and has no cross-service ordering dependency:

```text
auth database      -> package/auth prisma:deploy
server database    -> package/server prisma:deploy
notify database    -> package/notify prisma:deploy
reaction database  -> package/reaction prisma:deploy
history database   -> package/history prisma:deploy
ranking database   -> package/ranking prisma:deploy   (parallel-safe)
job database       -> package/job-runner db/schema preparation
```

After ranking-relevant schema or Meili settings changes, a one-shot ranking
backfill/full-sync step repopulates ranking fields on Meili documents.

### Decision: Production env is SOPS + age, integrated via Kamal

Each deployment unit has an env schema listing required values, defaults, owners,
and secret/non-secret classification. Actual secret values come from **SOPS + age
encrypted files committed to the repo** (no SaaS dependency, auditable in git,
fits the per-unit split), decrypted at deploy time with an age key held by the CI
runner/host and surfaced to Kamal as its secrets source. Frontend public config
(`VITE_*`) stays as build-time variables injected during the Cloudflare build, as
those values are baked into static assets and must not contain secrets.

Validation runs before starting or updating services; missing required values
fail the deployment before mutating a running service.

Alternative considered: keep GitHub Actions Secrets rendered to `.env` on the
host (current path). Rejected because it has no per-unit schema, weak audit, and
ongoing host drift. Alternatives considered and rejected as too heavy for a
single-host start: self-hosted Infisical (needs its own database) and Vault.

### Decision: Observability is a separate, opt-in deployment unit

The self-hosted analysis backend (OTel Collector + ClickStack) is its own
`infra-observability` deployment unit, split like everything else. It is opt-in:
in v1 the top-level deploy may skip it, and with `OTEL_EXPORTER_OTLP_ENDPOINT`
unset each service still emits structured JSON logs to the container log stream
(`json-file` driver with rotation). When the unit is enabled, services export
OTLP to the Collector. This honors "split everything" without making ClickStack a
baseline runtime dependency of the application tier.

### Decision: Release automation uses independent targets

Release automation is split by target and expressed as Kamal apps/roles:

- backend images: build, test, compile, publish image tags to GHCR;
- migrations: run release-specific one-shot jobs;
- backend services: pull selected tags, swap via `kamal-proxy`, health-gate;
- workers: update or scale `job-runner-worker` and `ranking-worker`
  independently from HTTP services;
- frontends: build and deploy `package/app` and `package/admin` to Cloudflare;
- infrastructure (incl. observability): manual or separately approved targets.

Image builds trigger on push to `dev` with git-SHA tags; production deploy is a
manual/tag-gated dispatch behind a GitHub Environment approval. Rollback uses
previous image tags. Database rollback is not automatic; migrations must be
forward-compatible or include a documented manual rollback path.

## Integration Points and Data Flow

```text
GitHub Actions
  |-- build app/admin ---------------------> Cloudflare static hosting
  |-- build backend images ----------------> GHCR
  |-- kamal deploy (over SSH) -------------> production deployment units

production deployment units
  proxy (kamal-proxy, TLS)
    -> services-api: server, auth, notify, reaction, history (public/proxied)
  services-api
    -> infra-db (per-service databases)
    -> infra-search (Meili)
    -> ranking (internal-only) -> infra-db (ranking + main read) + infra-search
  workers
    job-runner-worker -> infra-db, infra-search, infra-cdc
    ranking-worker    -> ranking (/ranking/command), infra-search
  infra-cdc (Sequin)
    source 1: main database     --\
    source 2: reaction database  --> job-runner webhooks -> ranking invalidations
  all services --(OTLP, opt-in)--> infra-observability (Collector -> ClickStack)
```

Public API URLs and CORS origins are explicit production env/config values.
Internal service-to-service URLs (`RANKING_BASE_URL`, JWKS endpoints, webhook
secrets, OTLP endpoint) are defined by env schemas and deployment unit
boundaries. Because the Cloudflare frontends and backend images deploy on
independent lifecycles, the `@rezics/contract` API surface must stay
forward-compatible across a deploy, and backend rolls out before frontend.

## Risks / Trade-offs

- [Risk] Kamal is a Ruby tool in a Bun/TS repo. -> Mitigation: it runs only in
  CI/operator context, not on the host, and installs nothing persistent; the
  runtime stays pure containers.
- [Risk] Per-service split adds many small units. -> Mitigation: Kamal config and
  the shared Dockerfile base keep per-unit definitions thin and uniform.
- [Risk] Compiled Bun binaries need Prisma engines/generated clients. ->
  Mitigation: the shared Dockerfile copies engine + client and each image runs a
  smoke test / healthcheck in CI.
- [Risk] Same-host networking can hide future separation assumptions. ->
  Mitigation: explicit service URLs in env; no reliance on implicit DNS across
  lifecycle boundaries; database-per-service URLs even on a shared instance.
- [Risk] Two Sequin sources increase logical replication slot exposure; an
  offline consumer can grow WAL on the source databases. -> Mitigation: monitor
  and alert on replication slot lag; documented drop/recreate procedure.
- [Risk] Forward-only migrations can make rollback partial. -> Mitigation:
  compatibility review, staging dry-run, and manual rollback notes; ranking is
  exempt (rebuildable).
- [Risk] SOPS age-key unavailability can block deployment. -> Mitigation:
  document bootstrap, key rotation, and break-glass recovery.

## Migration Plan

1. Inventory runtime packages, ports, health endpoints, required env, Prisma
   ownership, and build commands (now including `ranking` and the shared
   observability env contract).
2. Add the shared base image plus per-service Dockerfiles and compiled cluster
   entrypoints (add a cluster entrypoint to `ranking`).
3. Add Kamal configuration for services-api, workers, accessories, and
   migrations, plus SOPS + age env schemas, without switching production traffic.
4. Add CI workflows for backend image publishing to GHCR and Cloudflare static
   deploys; retarget the trigger from `master` to `dev`.
5. Bootstrap the production host with registry credentials, the age key, the
   PostgreSQL instance and per-service databases, Meili, Sequin (two sources),
   `kamal-proxy`, and optionally `infra-observability`.
6. Run migration jobs and deploy backend services (incl. ranking) via Kamal; run
   the ranking Meili backfill.
7. Deploy Cloudflare frontends with production API/service URLs.
8. Validate health, logs, CORS/auth flows, job-runner delivery, both CDC
   sources, search, ranking, and notification paths.
9. Retire the systemd + `tool/deploy-script` / `master` `deploy.yml` path after a
   successful release and documented rollback exercise.

Rollback:

- Frontend rollback redeploys the previous Cloudflare artifact or release.
- Backend rollback points affected service units at previous image tags via
  Kamal and swaps only those units.
- Worker rollback is independent from HTTP rollback.
- Infrastructure rollback is manual and separated from app release rollback.
- Database rollback requires migration-specific instructions; ranking recovers by
  recompute.

## Resolved Decisions

- Registry: **GHCR**.
- Deploy initiation: image build on push to `dev`; production deploy via Kamal
  from a manual/tag-gated GitHub Actions dispatch behind an Environment approval.
- `package/preview`: **non-production tooling**, excluded from the first
  production service set.
- Infrastructure hosting: **self-hosted** for v1, with one PostgreSQL instance
  (database-per-service) and explicit URLs preserving a later move to per-service
  instances or managed providers.
- Orchestration tool: **Kamal**. Secret store: **SOPS + age**. Postgres topology:
  **single instance, database-per-service**. Dockerfile: **shared base + thin
  per-service**.

## Contract Lock-in (resolved for implementation)

Independent infrastructure — depends on no other active change; deploys all of
them. No `@rezics/contract` work, but these service-boundary prerequisites gate
image builds and must land first. See `implement_goal.md` (Phase 8).

- **Ranking cluster entrypoint** — add `package/ranking/src/cluster.ts` plus a
  `WORKERS` env var (ranking currently only calls `app.listen`). Blocks the
  ranking Docker image.
- **Health endpoints** — add `/health` + `/ready` to `server`, `auth`, `notify`,
  `reaction`, `history` (only `ranking` has one today). Blocks healthchecks.
- **Ranking internal-only** — remove public CORS / public proxy route; expose via
  an internal `RANKING_BASE_URL` only.
- **Per-unit env schemas** — SOPS-managed per-unit env MUST extend the existing
  per-package `@t3-oss/env-core` + Valibot `env.ts`, not replace them.
- **Observability env names** — reconcile the `OBSERVABILITY_*` env var names
  against the parameter names in `package/shared/src/observability/config.ts`.
