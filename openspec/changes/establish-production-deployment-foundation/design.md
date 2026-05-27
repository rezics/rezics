## Context

Rezics is a Bun + TypeScript monorepo with Vite static frontends and multiple
Elysia/Prisma backend services. Current deployment support is split between:

- `tool/external-services`, a local-development Docker Compose workflow for
  source PostgreSQL, Meilisearch, Sequin, and Sequin-owned state services;
- package-local `build:linux` scripts on some backend packages;
- an ad-hoc deploy script that fetches/reset source, builds on the target host,
  copies binaries/static files, and restarts systemd services.

That model is not a production deployment foundation. Local external services
are intentionally convenient and monolithic, while production needs independent
lifecycles for durable infrastructure, backend HTTP services, workers, proxy,
migrations, static frontends, secrets, and release automation.

The target design assumes production may start on one host, but deployment units
must remain separable. Same-host placement is an implementation detail; lifecycle
boundaries are the architecture.

## Goals / Non-Goals

**Goals:**

- Build immutable production artifacts for every package-owned backend runtime
  service.
- Compile Elysia HTTP services into Linux binaries and run them through
  production cluster entrypoints.
- Keep worker concurrency explicit and separate from HTTP cluster behavior.
- Deploy `package/app` and `package/admin` as Cloudflare static Vite outputs,
  without SSR and without Docker images.
- Split production deployment units by lifecycle: database infrastructure,
  search infrastructure, CDC infrastructure, proxy, backend HTTP services,
  workers, and migration jobs.
- Automate releases with repeatable image publishing, migration execution,
  service rollout, health verification, and rollback.
- Manage production env/secrets through an auditable workflow with schemas and
  encrypted or provider-backed values.

**Non-Goals:**

- Do not use the local `tool/external-services` compose project as the
  production deployment shape.
- Do not require Kubernetes, Docker Swarm, or Nomad as the baseline production
  target.
- Do not Dockerize `package/app` or `package/admin`.
- Do not introduce SSR.
- Do not make app container startup run schema migrations implicitly.

## Decisions

### Decision: Production deployment units are separated by lifecycle

Production compose projects are split by lifecycle rather than by current host:

```text
production host or hosts
  proxy/             Caddy or Traefik
  infra-db/          PostgreSQL databases, if self-hosted
  infra-search/      Meilisearch
  infra-cdc/         Sequin, Sequin Redis, Sequin state database
  services-api/      server, auth, notify, reaction, history, preview if kept
  workers/           job-runner worker roles and future non-HTTP workers
  migrations/        one-shot migration jobs or release-time compose profiles
```

Each unit has its own compose project name, env file, state directory, deploy
command, health expectations, and rollback behavior. Units may share an external
Docker network on a single host, but service URLs must be explicit env values so
that any unit can move to another host or managed provider later.

Alternative considered: one production compose file for all infrastructure and
services. Rejected because it couples unrelated rollouts, makes app releases
touch infrastructure state, weakens secrets boundaries, and makes future
separation expensive.

Alternative considered: Kubernetes as the default. Rejected for baseline scope:
it solves some lifecycle concerns but adds operational surface that is not
required to establish the production workflow. The design keeps artifacts and
env boundaries compatible with a future orchestrator.

### Decision: Backend services publish immutable images

Backend runtime packages publish images to a registry such as GHCR. Image tags
include the git SHA and may also include release tags. Deployment units select
image versions through env or generated deployment manifests; production hosts
pull images rather than build source.

Affected runtime services:

- `package/server`
- `package/auth`
- `package/notify`
- `package/reaction`
- `package/history`
- `package/job-runner`
- `package/preview` if retained as a production Elysia service

Library packages remain build inputs and are not deployed as standalone images.

Alternative considered: build binaries on the production host. Rejected because
it makes releases depend on mutable host state, slows rollbacks, and obscures
which source revision is running.

### Decision: Elysia HTTP services use compiled cluster entrypoints

HTTP services use production entrypoints that compile to Linux binaries and run
cluster mode. Cluster worker count is configurable with an env var such as
`WORKERS`, with a safe default derived from available parallelism. Primary
processes replace failed workers and handle signals so container shutdown is
graceful.

`package/server` and `package/auth` already have a `src/cluster.ts` shape; the
change standardizes that pattern across the other Elysia HTTP services.

Workers are not blindly clustered. `package/job-runner` has role-based behavior
and production separates:

- `job-runner-http`, for enqueue/admin/webhook HTTP routes;
- `job-runner-worker`, for queue consumption with explicit replica/concurrency
  configuration.

Alternative considered: run one Bun process per container and rely only on
container replicas. Rejected for HTTP service baseline because the user requires
cluster mode and compiled Elysia binaries. Container replicas may still be used
above the cluster layer where appropriate.

### Decision: Frontends deploy to Cloudflare as static applications

`package/app` and `package/admin` build with existing Vite scripts and deploy to
Cloudflare static hosting. Their production configuration is supplied through
Vite/Cloudflare build environment variables and documented env schemas. They do
not produce Docker images and do not require SSR infrastructure.

Alternative considered: serve static assets from the backend or proxy host.
Rejected because Cloudflare is the target hosting boundary and keeps frontend
deployment independent from backend container rollout.

### Decision: Migrations are explicit release steps

Prisma migrations run as one-shot release jobs before HTTP service rollout.
Migration execution uses the same image revision that is being deployed, but a
separate command/profile from normal service startup. Release automation stops
on migration failure and does not update runtime services.

Migration order follows database ownership, for example:

```text
auth database      -> package/auth prisma:deploy
server database    -> package/server prisma:deploy
notify database    -> package/notify prisma:deploy
reaction database  -> package/reaction prisma:deploy
history database   -> package/history prisma:deploy
job database       -> package/job-runner db/schema preparation
```

Alternative considered: run migrations at container startup. Rejected because it
creates race conditions during scaled rollouts and makes app readiness mutate
schema state.

### Decision: Production env is schema-driven and auditable

Each deployment unit has an env schema or manifest listing required values,
defaults, owners, and secret/non-secret classification. Actual production values
come from an auditable system such as `sops` + `age` encrypted files or a
dedicated secret manager. Plaintext production env files on developer machines
are not the source of truth.

Release automation materializes env on the production host or injects it through
the deployment platform. Validation runs before starting or updating services.

Alternative considered: manually edit `.env` on the server. Rejected because it
causes drift and makes releases non-reproducible.

### Decision: Release automation uses independent jobs

Release automation is split by target:

- backend images: build, test, compile, publish image tags;
- migrations: run release-specific one-shot jobs;
- backend services: pull selected tags, update compose units, healthcheck;
- workers: update or scale independently from HTTP services;
- frontends: build and deploy `package/app` and `package/admin` to Cloudflare;
- infrastructure: manual or separately approved jobs for durable services.

Rollback uses previous image tags and deployment unit env/manifests. Database
rollback is not automatic; migrations must be forward-compatible or include a
documented manual rollback path.

## Integration Points and Data Flow

```text
GitHub Actions
  |-- build app/admin ---------------------> Cloudflare static hosting
  |
  |-- build backend images ----------------> GHCR or selected registry
  |
  |-- deploy over SSH or runner -----------> production deployment units

production deployment units
  proxy
    -> services-api HTTP services
  services-api
    -> infra-db
    -> infra-search
    -> infra-cdc via job-runner webhooks where applicable
  workers
    -> infra-db
    -> infra-search
    -> infra-cdc
```

Public API URLs and CORS origins are explicit production env/config values.
Internal service-to-service URLs, shared internal secrets, JWKS endpoints, and
webhook secrets are defined by env schemas and deployment unit boundaries.

## Risks / Trade-offs

- [Risk] Multiple compose projects add operational commands compared with one
  file. -> Mitigation: provide a thin deploy/runbook layer with named commands
  per unit and shared conventions for logs, health, pull, up, and rollback.
- [Risk] Same-host networking can hide future separation assumptions. ->
  Mitigation: require explicit service URLs in env and avoid relying on implicit
  compose project DNS across lifecycle boundaries.
- [Risk] Compiled Bun binaries may have package-specific runtime asset needs,
  such as Prisma engines, generated clients, or static config files. ->
  Mitigation: each service image includes a smoke test and healthcheck in CI.
- [Risk] Cluster mode can accidentally duplicate worker behavior. ->
  Mitigation: only HTTP service entrypoints use cluster mode; worker roles use
  explicit concurrency and replica controls.
- [Risk] Forward-only migrations can make rollback partial. -> Mitigation:
  release tasks include compatibility review, migration dry-run/staging
  validation, and manual rollback notes for schema changes.
- [Risk] Secret tooling can block deployment if keys are unavailable. ->
  Mitigation: document bootstrap, key rotation, and break-glass recovery.

## Migration Plan

1. Inventory runtime packages, ports, health endpoints, required env, Prisma
   ownership, and build commands.
2. Add production image/build definitions and compiled entrypoints for backend
   runtime services.
3. Add deployment unit manifests, env schemas, and runbooks without switching
   production traffic.
4. Add CI workflows for backend image publishing and Cloudflare static deploys.
5. Bootstrap production host or hosts with registry credentials, secret access,
   external networks, volumes, proxy, and infra units.
6. Run migration jobs and deploy backend services to the new units.
7. Deploy Cloudflare frontends with production API/service URLs.
8. Validate health, logs, CORS/auth flows, job-runner delivery, CDC, search, and
   notification paths.
9. Retire the old ad-hoc deploy script path after a successful release and
   documented rollback exercise.

Rollback:

- Frontend rollback redeploys the previous Cloudflare artifact or release.
- Backend rollback points affected service units at previous image tags and
  restarts only those units.
- Worker rollback is independent from HTTP rollback.
- Infrastructure rollback is manual and separated from app release rollback.
- Database rollback requires migration-specific instructions; normal releases
  should prefer forward-compatible migrations.

## Open Questions

- Which registry namespace should be canonical for images?
- Should production SSH deployment be initiated only by GitHub Actions, or is a
  local operator CLI also required?
- Is `package/preview` a required production service or a development/internal
  tool that can stay outside the first production service set?
- Should infrastructure be self-hosted from the start or can selected units use
  managed providers while preserving the same env/deployment contracts?
