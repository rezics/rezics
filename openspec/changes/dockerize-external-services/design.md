## Context

The repo currently treats PostgreSQL and Meilisearch as developer-provided
prerequisites. Sequin has a focused wrapper under `tool/external-services`, but
that wrapper starts only Sequin, Sequin state Postgres, and Redis; it expects
the source PostgreSQL database to exist on the host or elsewhere. The
`prepare-sequin-source` script can repair or prepare that source database, but
it may need to set `wal_level=logical` with `ALTER SYSTEM`, require a Postgres
restart, and then be run again before the logical replication slot can be
created.

The target local development model is a repo-managed Docker Compose v2 stack
that owns the normal path for PostgreSQL, Meilisearch, Sequin state services,
and Sequin itself. User-managed services remain possible through package env
files, but the repo-managed workflow does not discover, start, or mutate them.

Target topology:

```text
host bun processes
  package/server      -> localhost:5432 source-postgres
  package/auth        -> localhost:5432 source-postgres
  package/job-runner  -> localhost:5432 source-postgres, localhost:7700 meili
       ▲
       │ webhook
       │
docker compose project
  source-postgres  -- logical WAL from first boot
  meilisearch
  sequin-postgres  -- Sequin state database
  sequin-redis
  sequin           -- reads source-postgres, posts to host job-runner
```

## Goals / Non-Goals

**Goals:**

- Provide one repo-managed Docker Compose v2 workflow for local PostgreSQL,
  Meilisearch, and Sequin dependencies.
- Make the managed source Postgres Sequin-ready at first boot by passing
  logical replication settings as Postgres server arguments.
- Initialize local development databases during first managed Postgres volume
  creation.
- Keep Sequin publication and replication slot names aligned with
  `package/job-runner/sequin/sequin.yml`.
- Preserve `prepare-sequin-source` as an explicit verify/repair tool for
  exceptional or external database cases.
- Make setup docs and command names reflect the managed Docker path.

**Non-Goals:**

- Supporting Podman, podman-compose, or Docker Compose v1.
- Discovering or controlling user-managed Postgres, Meilisearch, Redis, or
  Sequin containers.
- Containerizing the Bun application services in this change.
- Providing production deployment orchestration.
- Migrating data from existing developer-managed databases into Docker volumes.

## Decisions

### Docker Compose v2 only

The lifecycle wrapper will call `docker compose` directly and fail fast when
Docker Compose v2 is unavailable. This removes the current runtime abstraction
for Podman and Docker and avoids divergent host alias, volume-label, and compose
feature behavior.

Alternative considered: keep Podman compatibility. Rejected because the project
has chosen to make Docker the only supported repo-managed container runtime,
and the compatibility layer adds maintenance cost without meaningful value for
this workflow.

### Source Postgres starts with logical replication settings

The managed source Postgres service will use Postgres server arguments rather
than relying on `ALTER SYSTEM` during normal setup:

```text
postgres
  -c wal_level=logical
  -c max_replication_slots=10
  -c max_wal_senders=10
```

This makes fresh Docker volumes Sequin-ready before initialization scripts and
before Sequin starts. The repair script remains useful for external databases,
old volumes, or manual damage, but it should not be required for a clean
repo-managed setup.

Alternative considered: run `prepare-sequin-source --apply --dev-reset` as part
of every setup. Rejected because it makes a repair path part of the happy path
and can still require a restart when Postgres was not started correctly.

### First-run database initialization stays inside the Postgres image contract

The managed source Postgres service will mount init scripts into
`/docker-entrypoint-initdb.d` to create local development databases on empty
volumes. These scripts are for database/user bootstrap only. Schema migrations
remain owned by the existing Prisma workflows.

The initialized database set should cover package env examples that currently
point at local Postgres:

- `rezics_booklib`
- `rezics_auth`
- `rezics_jobs`
- `rezics_history`
- `rezics_notify`
- `reaction`

Alternative considered: make the wrapper connect after startup and create
databases every time. Rejected for the normal path because the Postgres image
already has a first-run initialization contract. The wrapper may still provide
idempotent verification for diagnostics.

### Unified service wrapper replaces Sequin-only entry point

Repo scripts should expose a unified external-services interface such as:

```text
bun run service:up
bun run service:down
bun run service:logs
bun run service:ps
bun run service:health
bun run service:source:verify
bun run service:source:repair
```

Existing Sequin-specific commands can remain as compatibility aliases during
the transition, but docs should present the unified commands first. The wrapper
should run compose from one external-services directory so Postgres,
Meilisearch, Sequin state services, and Sequin share one project boundary.

### Managed and user-managed services are separate modes

The Docker workflow only manages containers, volumes, and networks created by
the repo compose project. If a developer wants to use host Postgres or host
Meilisearch, they can set package env files manually and avoid the managed
workflow. The wrapper should report likely port conflicts clearly, but it
should not mutate unrelated containers or host services.

## Risks / Trade-offs

- [Risk] Existing developer machines may already have Postgres or Meilisearch on
  ports `5432` or `7700`. → Mitigation: document the managed path as owning
  these default ports and fail with clear conflict guidance.
- [Risk] Docker volumes created before this change may not have logical
  replication settings or expected databases. → Mitigation: provide explicit
  verify/repair commands and document when to recreate local volumes.
- [Risk] Sequin publication/table lists can drift from job-runner routing. →
  Mitigation: keep the Sequin config as the authoritative local CDC wiring and
  preserve checks in `prepare-sequin-source`.
- [Risk] Replication slots can retain WAL when Sequin is stopped for long
  periods. → Mitigation: keep repair tooling able to inspect/drop/recreate the
  local development slot with explicit dev-reset semantics.
- [Risk] Removing Podman support can disrupt a developer who already used it.
  → Mitigation: make the support boundary explicit in docs and error messages;
  user-managed external services remain possible outside the managed path.

## Migration Plan

1. Add the Docker-only compose topology and source Postgres initialization
   scripts.
2. Replace or simplify the runtime detector so the wrapper requires
   `docker compose`.
3. Add unified service scripts and keep Sequin-specific aliases only if they do
   not obscure the new path.
4. Update docs and env examples to describe Docker Compose v2 as the managed
   local dependency path.
5. Validate the compose plan, start/health/logs commands, and source Postgres
   settings on a fresh Docker volume.
6. Validate that `prepare-sequin-source` succeeds in check-only mode against
   the managed source Postgres after startup.

Rollback is straightforward: keep the current package env files pointing at
manual services and avoid using the new managed Docker commands. No production
runtime behavior is changed by this local tooling change.

## Open Questions

- Should compatibility aliases for `service:sequin:*` be removed immediately or
  retained for one transition window?
- Should the managed source Postgres expose only one superuser for all local
  databases, or should init scripts create package-specific database users?
- Should `service:up` start Sequin by default, or should Sequin be an optional
  profile for developers who do not need CDC?
