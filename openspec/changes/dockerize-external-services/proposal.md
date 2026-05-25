## Why

Local development currently requires developers to provide PostgreSQL,
Meilisearch, and Sequin dependencies outside the repo-managed workflow. The
existing Sequin wrapper improves one part of the stack, but source Postgres and
Meilisearch are still manual prerequisites, and Sequin source preparation can
become a two-step repair path when Postgres was not started with logical
replication enabled.

This change creates a single Docker Compose v2 based external-services workflow
for repo-managed local dependencies. The goal is that fresh repo-managed
Postgres instances are Sequin-ready from first boot, so the source preparation
script is reserved for verification and exceptional repair.

## What Changes

- Add a repo-managed external-services stack for PostgreSQL, Meilisearch, and
  Sequin using Docker Compose v2 only.
- Remove Podman and podman-compose support from the repo-managed external
  services path.
- Start repo-managed source PostgreSQL with logical replication parameters at
  server startup:
  - `wal_level=logical`
  - `max_replication_slots=10`
  - `max_wal_senders=10`
- Initialize required local development databases during first Postgres volume
  creation instead of relying on manual host setup.
- Keep Sequin state Postgres and Redis as repo-managed services in the same
  external-services workflow.
- Add lifecycle commands for starting, stopping, inspecting health, and viewing
  logs for the managed stack.
- Reframe `prepare-sequin-source` as a verify/repair tool for existing,
  external, or broken source databases rather than the normal happy-path setup.
- Document that user-managed services are out of scope for the managed Docker
  path; users may still point package env files at external services manually.

## Capabilities

### New Capabilities

- `external-services-docker`: Repo-managed Docker Compose v2 lifecycle for
  local PostgreSQL, Meilisearch, and Sequin services.

### Modified Capabilities

- `job-runner-sync-infrastructure`: Clarify that the managed local Sequin source
  database is expected to start with logical replication enabled, with
  publication/slot preparation treated as verification or repair.

## Impact

- Affected packages and directories:
  - `tool/external-services`: Docker Compose files and lifecycle wrapper.
  - `tool/db-script`: source Postgres verification/repair command naming and
    documentation.
  - `tool/env.ts`: Docker-only external-service environment validation.
  - `package.json`: repo-level service scripts.
  - `package/server`, `package/auth`, `package/job-runner`, `package/history`,
    `package/notify`, and `package/reaction`: local database and Meilisearch
    connection expectations in env examples or docs.
  - `package/job-runner/sequin`: Sequin config remains the source of
    publication/slot names and sink wiring.
  - `CONTRIBUTING.md` and `tool/README.md`: local setup documentation.
- Runtime dependency expectation changes from "Bun, PostgreSQL, Meilisearch" to
  "Bun and Docker Compose v2 for repo-managed local services".
- Backward compatibility:
  - Existing manually managed PostgreSQL or Meilisearch setups remain possible
    through package env files, but they are not managed or auto-detected by the
    new workflow.
  - Existing Sequin-specific scripts may remain as compatibility aliases during
    the transition, but the preferred interface becomes the unified
    external-services command set.
- Migration needs:
  - Developers using repo-managed services will create new Docker volumes on
    first run.
  - Developers with old Sequin-only containers can stop/remove those containers
    manually if they conflict with the new Docker Compose project.
