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

- Replace the current Sequin scaffold with a Sequin IaC configuration that
  defines the source database, replication slot/publication, HTTP endpoint, and
  webhook sink for `@rezics/job-runner`.
- Add production-capable compose orchestration for Sequin, Sequin's state
  Postgres, and Redis, with a dev override for host-local Postgres and
  host-local Bun services.
- Add a container runtime wrapper that supports both Podman and Docker, with a
  deterministic runtime selection order and explicit environment overrides.
- Add preflight and documentation for Postgres logical replication,
  PascalCase/quoted table identifiers, publication ownership, slot naming,
  secret alignment, and webhook verification.
- Keep Sequin delivery pointed at one webhook server:
  `@rezics/job-runner`. History ingestion remains handled by the
  `history.outbox.ingest` worker lane, not by direct Sequin delivery to
  `@rezics/history`.
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
  - `package/job-runner`: Sequin configuration, compose files, runtime wrapper,
    env examples, and operational docs.
  - `tool/dev-script`: local zellij orchestration may expose a Sequin tab or
    entry point without making ordinary app development depend on CDC.
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
