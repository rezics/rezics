## Why

Sequin is currently represented by a checked-in `sequin.yml` scaffold, but it is
not yet operationalized as a reproducible local or production runtime. Unlike a
pure external service such as Meilisearch, Sequin needs its own state database,
Redis, source database replication configuration, and an IaC config file that is
applied at startup.

This change makes the CDC runtime explicit so operators and developers can run
the same Sequin topology consistently across Docker and Podman environments,
while preserving the existing job-runner ownership boundary for search sync and
history ingestion.

## What Changes

- Replace the current Sequin scaffold with a Sequin v0.14.6 IaC configuration
  (`sequin.yml`) that defines the source database, replication slot with
  environment-suffixed naming, publication via `init_sql` with quoted Prisma
  PascalCase identifiers, HTTP endpoint, and webhook sink for
  `@rezics/job-runner`.
- Add production-capable compose orchestration under `tool/external-services`
  pinned to `sequin/sequin:v0.14.6`, `postgres:16` (state DB only, no logical
  replication needed on the state DB), and `redis:7`, with a dev override for
  host-local Postgres and host-local Bun services.
- Add a repo-level external-service wrapper that supports both Podman and
  Docker, with a deterministic runtime selection order, explicit environment
  overrides, and Podman-specific volume-mount handling (`:Z` on SELinux hosts).
- Add preflight and documentation for Postgres logical replication
  (`wal_level=logical`, replication role SQL), publication ownership via
  `init_sql` (run-once semantics plus `ALTER PUBLICATION` guidance for schema
  changes), environment-suffixed slot naming, slot lifecycle on rollback
  (`pg_drop_replication_slot` SQL), Sequin secret generation (`SECRET_KEY_BASE`
  and `VAULT_KEY` via `openssl`), webhook authentication via
  `encrypted_headers` with `x-internal-secret`, and `initial_backfill` as an
  opt-in per-environment runbook step.
- Keep Sequin delivery pointed at one webhook server:
  `@rezics/job-runner`. History ingestion remains handled by the
  `history.outbox.ingest` worker lane, not by direct Sequin delivery to
  `@rezics/history`.
- Make `@rezics/job-runner` fail fast on startup when running the `http` or
  `all` role and the configured Sequin health endpoint is unavailable. The
  `worker` role does not check Sequin so it can continue draining existing
  pg-boss jobs during CDC runtime outages.
- No breaking API changes are expected. The change alters infrastructure
  configuration and local/production runtime commands, not application request
  contracts.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `job-runner-sync-infrastructure`: Add requirements for Sequin runtime
  configuration, container orchestration, Docker/Podman compatibility,
  publication/table-name handling, and the single job-runner webhook ownership
  model.

## Impact

- Affected packages and paths:
  - `package/job-runner`: Sequin IaC configuration, startup health check, env
    examples, and operational docs.
  - `tool/external-services`: Sequin compose files, Docker/Podman runtime
    wrapper, and shared external-service lifecycle helpers.
  - `tool/dev-script`: local zellij orchestration remains independent of Sequin
    startup and must not auto-start the CDC runtime.
  - root scripts in `package.json`: may add a convenience command for Sequin
    runtime startup.
  - `openspec/specs/job-runner-sync-infrastructure/spec.md`: modified
    operational requirements.
- External systems:
  - Postgres main database must support logical replication for Sequin CDC.
  - Sequin requires its own state Postgres and Redis services.
  - Docker or Podman with compose support is required to run the bundled Sequin
    runtime.
- Migration and compatibility:
  - Existing `@rezics/job-runner` webhook parsing and routing remains the
    application boundary.
  - Existing direct seed/factory search sync behavior remains out of scope and
    must not require Sequin.
  - Production deployments need secrets and source database credentials supplied
    through environment variables rather than checked-in values.
