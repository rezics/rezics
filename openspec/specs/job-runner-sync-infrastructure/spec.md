# job-runner-sync-infrastructure Specification

## Purpose

Defines the `@rezics/job` contract package and the single `@rezics/job-runner`
Bun/Elysia service that own durable runtime side-effect delivery for
Meilisearch synchronization and history outbox ingestion. The main server
(`@rezics/server`) remains authoritative for canonical database writes; runtime
mutations that need projection or history side effects enqueue job commands
through an internal HTTP client instead of awaiting or fire-and-forgetting
Meilisearch writes. CDC messages from Sequin route to the same job commands and
are treated as invalidation or command-routing signals rather than ordered
mutation replay. Seed, factory, and explicit local one-shot scripts continue to
use direct `@rezics/search` helpers without requiring the runner or queue
database.

## Requirements

### Requirement: Pure job contract package

The system SHALL provide `@rezics/job` as a pure TypeScript contract package for
job command schemas, lane constants, tag helpers, idempotency key helpers, and
an internal HTTP enqueue client. `@rezics/job` SHALL NOT import pg-boss, Elysia
runtime modules, Prisma clients, Meilisearch clients, or service env modules.

#### Scenario: Contract package has no runtime queue dependency

- **WHEN** dependency and import checks inspect `package/job`
- **THEN** `@rezics/job` SHALL NOT depend on `pg-boss`
- **AND** it SHALL NOT import `elysia`, Prisma clients, or Meilisearch clients

#### Scenario: Producers use shared command schemas

- **WHEN** `@rezics/server` or `@rezics/job-runner` creates a job command
- **THEN** the command SHALL validate against schemas exported by `@rezics/job`
- **AND** producers SHALL NOT define duplicate ad hoc command DTOs

### Requirement: Single job-runner service

The system SHALL provide `@rezics/job-runner` as a Bun/Elysia service that owns
the internal enqueue API, Sequin webhook endpoint, pg-boss connection, worker
bootstrap, handler dispatch, health checks, readiness checks, and minimal admin
operations.

#### Scenario: Runner starts all roles in local development

- **WHEN** `@rezics/job-runner` starts with `JOB_RUNNER_ROLE=all`
- **THEN** it SHALL expose enqueue and Sequin webhook HTTP endpoints
- **AND** it SHALL start pg-boss workers for configured lanes

#### Scenario: Runner can split HTTP and worker roles

- **WHEN** `@rezics/job-runner` starts with `JOB_RUNNER_ROLE=http`
- **THEN** it SHALL expose HTTP endpoints without starting workers
- **WHEN** it starts with `JOB_RUNNER_ROLE=worker`
- **THEN** it SHALL start workers without exposing enqueue or webhook endpoints

### Requirement: Queue database ownership boundary

Only `@rezics/job-runner` SHALL receive and use `JOB_DATABASE_URL`. Runtime
producers such as `@rezics/server` SHALL enqueue through the `@rezics/job` HTTP
client and SHALL NOT open pg-boss or queue database connections directly.

#### Scenario: Server has no pg-boss database access

- **WHEN** runtime environment validation and imports are inspected for
  `package/server`
- **THEN** `package/server` SHALL NOT require `JOB_DATABASE_URL`
- **AND** `package/server` SHALL NOT import `pg-boss`

#### Scenario: Job-runner owns pg-boss setup

- **WHEN** the job-runner boots
- **THEN** it SHALL connect to pg-boss using `JOB_DATABASE_URL`
- **AND** it SHALL create or verify all required lanes before workers start

### Requirement: Lane-based queues

The job system SHALL use lane-based pg-boss queues named `search.sync.fast`,
`search.sync.slow`, `history.ingest`, and `maintenance`. Command kinds SHALL be
more specific than lanes and SHALL identify the domain operation being handled.

#### Scenario: Content tag invalidation uses slow search sync lane

- **WHEN** a content tag invalidation command is enqueued
- **THEN** its command kind SHALL be `search.content.patchTags`
- **AND** its lane SHALL be `search.sync.slow`

#### Scenario: History ingestion uses non-search lane

- **WHEN** a `HistoryOutbox` ingestion command is enqueued
- **THEN** its command kind SHALL be `history.outbox.ingest`
- **AND** its lane SHALL be `history.ingest`

### Requirement: Stable idempotency keys

Every job command SHALL include a stable idempotency key derived from command
kind and logical target. Duplicate enqueue attempts for the same pending
logical target SHALL be treated as successful coalescing rather than errors.

#### Scenario: Duplicate search invalidations coalesce

- **WHEN** two `search.content.patchTags` commands are enqueued for the same
  `unitId` while the first is still pending
- **THEN** both enqueue attempts SHALL be accepted
- **AND** the queue MAY contain only one pending job for that idempotency key

#### Scenario: History outbox idempotency key uses outbox id

- **WHEN** a `history.outbox.ingest` command is created
- **THEN** its idempotency key SHALL include the `HistoryOutbox.id`
- **AND** duplicate delivery of the same Sequin message SHALL NOT create
  duplicate history records

### Requirement: CDC routes invalidations and commands

The Sequin webhook handler SHALL validate incoming requests, parse Sequin
message metadata, and map table/action/primary-key data to typed job commands.
CDC routing SHALL treat messages as invalidation or command-routing signals,
not as authoritative mutation patches.

#### Scenario: Webhook authenticates Sequin request

- **WHEN** the Sequin webhook receives a request without the configured secret
  or bearer token
- **THEN** it SHALL reject the request
- **AND** it SHALL NOT enqueue any jobs

#### Scenario: CDC update enqueues current-state projection job

- **WHEN** Sequin delivers an update for `UnitTag`
- **THEN** the webhook SHALL enqueue `search.content.patchTags` for the
  affected `unitId`
- **AND** the job payload SHALL NOT attempt to patch Meilisearch directly from
  the CDC `changes` object

### Requirement: Source metadata is retained for audit

Jobs created from Sequin messages SHALL retain source metadata sufficient for
debugging and replay, including source type, table, action, record primary
keys, Sequin idempotency key, commit LSN, and commit index when present.

#### Scenario: Failed CDC-derived job is inspectable

- **WHEN** a CDC-derived job fails
- **THEN** the admin inspection output SHALL include the source table, action,
  primary keys, Sequin idempotency key, and logical target

### Requirement: Search handlers read current database state

Search job handlers SHALL compute Meilisearch documents or partial updates by
reading current canonical database state and invoking `@rezics/search` sync or
patch helpers. Handlers SHALL NOT apply ordered CDC deltas to Meilisearch
documents.

#### Scenario: Delete event triggers eligibility-aware sync

- **WHEN** a CDC delete or ineligibility event maps to a search sync command
- **THEN** the handler SHALL call an eligibility-aware sync/delete path
- **AND** the final Meilisearch state SHALL reflect current database state

### Requirement: Runtime producers enqueue side effects

Runtime server mutations that need Meilisearch or history side effects SHALL
enqueue job commands instead of directly awaiting or fire-and-forgetting
Meilisearch writes. Canonical database writes SHALL remain in `@rezics/server`.

#### Scenario: Server mutation enqueues search sync

- **WHEN** a runtime server mutation commits a canonical change that affects a
  search projection
- **THEN** the server SHALL enqueue the appropriate `search.*` command through
  the `@rezics/job` client
- **AND** it SHALL NOT call Meilisearch directly from the mutation path

### Requirement: Seed and local scripts remain direct

Seed, factory, and explicit local one-shot repair scripts SHALL continue to use
direct `@rezics/search` sync helpers and SHALL NOT require a running
job-runner, queue database, or Sequin container.

#### Scenario: Factory seed sync runs without job-runner

- **WHEN** a factory seed run performs targeted Meilisearch synchronization
- **THEN** it SHALL call direct `@rezics/search` sync or patch helpers
- **AND** it SHALL complete without `JOB_RUNNER_BASE_URL` or `JOB_DATABASE_URL`

### Requirement: Segmented fanout

Fanout jobs SHALL process bounded segments and re-enqueue themselves with a
cursor when more targets remain. A fanout handler SHALL NOT enqueue one child
job per affected document by default and SHALL NOT process an unbounded number
of targets in one job attempt.

#### Scenario: Large author fanout continues by cursor

- **WHEN** an author profile change affects more posts than the configured
  segment limit
- **THEN** the handler SHALL patch one segment
- **AND** it SHALL enqueue a continuation command carrying the next cursor

### Requirement: Retry and dead-letter operations

The job-runner SHALL expose admin operations to inspect failed jobs, retry
failed jobs, discard or cancel failed jobs, and report queue counts by lane and
state. Failed jobs SHALL retain command payload, source metadata, last error,
attempt count, and timestamps.

#### Scenario: Operator retries failed job

- **WHEN** an operator retries a failed job through the admin API
- **THEN** the job SHALL become eligible for processing again
- **AND** its command payload and idempotency metadata SHALL be preserved

### Requirement: Replay and drift repair commands

The job system SHALL provide maintenance commands to replay jobs by source
event or logical target and to repair search drift for explicit targets.
Replay and repair SHALL enqueue idempotent current-state jobs rather than
mutating projections from archived CDC payloads.

#### Scenario: Targeted drift repair syncs current state

- **WHEN** an operator enqueues drift repair for a content `unitId`
- **THEN** the maintenance handler SHALL enqueue or execute
  `search.content.sync` for that `unitId`
- **AND** the resulting projection SHALL be based on current database state

### Requirement: Index rebuild commands

The job system SHALL provide maintenance commands for Meilisearch index
rebuilds. Rebuilds SHALL read canonical database state and SHALL NOT depend on
CDC replay.

#### Scenario: Content index rebuild uses canonical database state

- **WHEN** an operator enqueues a content index rebuild
- **THEN** the rebuild job SHALL initialize the content index settings and sync
  qualifying content documents from the database in batches
- **AND** it SHALL NOT replay Sequin messages as the source of document truth

### Requirement: Observability tags

Every job SHALL carry tags that identify domain, effect, target entity or index
when applicable, fanout behavior when applicable, and source type. Admin and
logging surfaces SHALL expose these tags.

#### Scenario: Search job tags are visible

- **WHEN** a search job is inspected
- **THEN** its tags SHALL include `domain:search` and `effect:sync`
- **AND** index or target tags SHALL identify the affected projection where
  applicable

### Requirement: Sequin runtime is configured as infrastructure

The system SHALL provide source-controlled Sequin runtime configuration that
defines the source database connection, replication slot, publication, HTTP
endpoint, and webhook sink required to deliver CDC messages to
`@rezics/job-runner`. The checked-in configuration SHALL NOT contain production
secrets.

#### Scenario: Sequin starts from checked-in config

- **WHEN** an operator starts the bundled Sequin runtime with required
  environment variables
- **THEN** Sequin SHALL load the checked-in config file through its config file
  path setting
- **AND** the loaded configuration SHALL define the source database,
  replication slot, publication, job-runner HTTP endpoint, and webhook sink

#### Scenario: Secrets remain environment-owned

- **WHEN** the Sequin config and compose files are inspected
- **THEN** production database credentials, Sequin secret keys, and webhook
  secrets SHALL be supplied through environment variables
- **AND** checked-in files SHALL NOT contain production secret values

### Requirement: Sequin delivers CDC to job-runner only

Sequin SHALL deliver Rezics CDC webhook messages to `@rezics/job-runner`.
`@rezics/history` SHALL NOT be configured as a direct Sequin webhook target for
normal queued ingestion.

#### Scenario: HistoryOutbox CDC routes through job-runner

- **WHEN** Sequin delivers an insert for `HistoryOutbox`
- **THEN** the webhook target SHALL be `@rezics/job-runner`
- **AND** job-runner SHALL enqueue a `history.outbox.ingest` command on the
  `history.ingest` lane

#### Scenario: History service is not a Sequin sink

- **WHEN** the bundled Sequin sink configuration is inspected
- **THEN** it SHALL NOT contain an HTTP sink that targets `@rezics/history`
- **AND** history read APIs SHALL remain independent of CDC webhook delivery

### Requirement: Sequin compose supports production and development

The system SHALL provide a compose-based Sequin runtime with a reusable base
topology for production-capable deployment and a development override for
host-local services. Compose files and lifecycle wrappers SHALL live under
repo-level external-service tooling, while the Sequin IaC config remains owned
by `@rezics/job-runner`.

#### Scenario: Base compose defines durable Sequin dependencies

- **WHEN** the base Sequin compose file is inspected
- **THEN** it SHALL define Sequin, Sequin's state Postgres, and Redis services
- **AND** the Sequin service SHALL be pinned to an explicit semver image tag,
  not `:latest`, and SHALL NOT use `pull_policy: always`
- **AND** it SHALL use persistent volumes for the Sequin state Postgres and
  Redis
- **AND** it SHALL mount the checked-in Sequin config into the Sequin service
  via `CONFIG_FILE_PATH`
- **AND** the Sequin service SHALL declare a healthcheck against Sequin's
  `/health` endpoint on port `7376`
- **AND** the Sequin state Postgres SHALL NOT enable `wal_level=logical`,
  since logical replication is required on the source DB only

#### Scenario: Compose lifecycle lives in tool external-services

- **WHEN** the Sequin compose files and startup wrapper are inspected
- **THEN** they SHALL live under `tool/external-services`
- **AND** the Sequin IaC file SHALL remain under `package/job-runner/sequin`
- **AND** application runtime code SHALL NOT import `tool/` lifecycle helpers

#### Scenario: Base compose does not include host-local defaults

- **WHEN** the base compose file is used in production without the dev
  override
- **THEN** the Sequin source DB hostname SHALL come from a required
  environment variable with no fallback value
- **AND** the job-runner webhook URL SHALL come from a required environment
  variable with no fallback to host-gateway aliases

#### Scenario: Development override handles host-local services

- **WHEN** the development compose override is used
- **THEN** Sequin SHALL be able to reach a host-local source Postgres and a
  host-local Bun job-runner via `host.docker.internal` (Docker) or
  `host.containers.internal` (Podman)
- **AND** local UI/API ports MAY be exposed for operator inspection

#### Scenario: Required Sequin secrets are environment-supplied

- **WHEN** the Sequin compose is started
- **THEN** `SECRET_KEY_BASE` and `VAULT_KEY` SHALL be supplied through
  environment variables
- **AND** the env.example file SHALL document the openssl commands used to
  generate them
- **AND** the runtime wrapper SHALL refuse to start when either variable
  matches a documented example value

### Requirement: Sequin startup supports Docker and Podman

The Sequin startup command SHALL use a wrapper that can launch the compose stack
with either Docker or Podman. Runtime selection SHALL be deterministic and
operator-overridable. The wrapper SHALL be the explicit lifecycle entry point
for Sequin; dev orchestration SHALL NOT start Sequin implicitly.

#### Scenario: Explicit runtime override is honored

- **WHEN** `CONTAINER_RUNTIME` is set to a supported runtime value
- **THEN** the Sequin startup wrapper SHALL use that runtime
- **AND** it SHALL fail with a clear error if the requested runtime is not
  available

#### Scenario: Runtime auto-detection is deterministic

- **WHEN** `CONTAINER_RUNTIME` is not set
- **THEN** the Sequin startup wrapper SHALL select the first available supported
  compose runtime in its documented order
- **AND** it SHALL print clear setup guidance if no supported runtime is
  available

#### Scenario: Dev orchestration does not start Sequin

- **WHEN** the local dev layout is inspected
- **THEN** it SHALL NOT contain a Sequin pane or tab
- **AND** developers SHALL start Sequin through the external-service wrapper
  before starting job-runner ingress when CDC behavior is needed
- **AND** application panes SHALL NOT be suspended solely because they depend on
  external services

### Requirement: Job-runner HTTP ingress requires Sequin health

`@rezics/job-runner` SHALL fail fast on startup when its configured role exposes
Sequin webhook ingress and the configured Sequin health endpoint is
unavailable. Worker-only processes SHALL NOT require Sequin health at startup.

#### Scenario: HTTP role fails when Sequin is unavailable

- **WHEN** `@rezics/job-runner` starts with `JOB_RUNNER_ROLE=http`
- **AND** the configured `SEQUIN_HEALTH_URL` does not return a 2xx response
- **THEN** startup SHALL fail before exposing `/webhooks/sequin`
- **AND** the failure message SHALL include the checked URL and guidance to
  start or configure the Sequin runtime

#### Scenario: All role fails when Sequin is unavailable

- **WHEN** `@rezics/job-runner` starts with `JOB_RUNNER_ROLE=all`
- **AND** the configured `SEQUIN_HEALTH_URL` does not return a 2xx response
- **THEN** startup SHALL fail before exposing `/webhooks/sequin`
- **AND** workers SHALL NOT be registered as part of that failed process

#### Scenario: Worker role does not check Sequin

- **WHEN** `@rezics/job-runner` starts with `JOB_RUNNER_ROLE=worker`
- **THEN** startup SHALL NOT require `SEQUIN_HEALTH_URL` to be reachable
- **AND** the worker process SHALL be able to drain existing pg-boss jobs while
  Sequin is stopped or restarting

#### Scenario: HTTP ingress starts when Sequin is healthy

- **WHEN** `@rezics/job-runner` starts with `JOB_RUNNER_ROLE=http` or
  `JOB_RUNNER_ROLE=all`
- **AND** the configured `SEQUIN_HEALTH_URL` returns a 2xx response
- **THEN** startup SHALL continue and expose `/webhooks/sequin`

### Requirement: Sequin owns publication and slot via init_sql

The Sequin configuration SHALL request automatic creation of the replication
slot and publication, and SHALL provide the publication SQL inline through
Sequin's `publication.init_sql` so that Prisma's quoted PascalCase table names
are preserved at creation time.

#### Scenario: Slot and publication are created by Sequin on first boot

- **WHEN** Sequin boots against a source database that has no existing
  Rezics replication slot or publication
- **THEN** the configuration SHALL set both `slot.create_if_not_exists: true`
  and `publication.create_if_not_exists: true`
- **AND** the configured database role SHALL have replication and CREATE
  permissions on the source database

#### Scenario: Publication SQL quotes PascalCase table names

- **WHEN** the `publication.init_sql` block is inspected
- **THEN** every Prisma-managed table SHALL be referenced as
  `public."<PascalCaseName>"` with double quotes
- **AND** unquoted lowercase-equivalent table references SHALL NOT be used for
  those tables

#### Scenario: Sink include_tables is defense-in-depth

- **WHEN** the webhook sink configuration is inspected
- **THEN** `source.include_tables` SHALL list the routed tables as
  `public.<PascalCaseName>` strings preserved case-sensitively by YAML
- **AND** the publication boundary defined via `init_sql` SHALL remain the
  authoritative table filter; missing tables in `include_tables` MUST NOT be
  the only mechanism preventing unintended delivery

### Requirement: Replication slot lifecycle is operationally explicit

The system SHALL name replication slots with an environment suffix to prevent
cross-environment collision and SHALL document the slot lifecycle for both
pause and decommission rollback paths.

#### Scenario: Slot names include environment suffix

- **WHEN** the Sequin configuration declares the source database slot
- **THEN** the slot name SHALL incorporate an environment identifier (for
  example `rezics_sequin_slot_${ENV}`)
- **AND** dev, staging, and production deployments SHALL be able to point at
  the same source database without slot-name collision

#### Scenario: Rollback documents slot drop and retention

- **WHEN** the operations documentation describes Sequin rollback
- **THEN** it SHALL include the `pg_drop_replication_slot` and
  `DROP PUBLICATION` SQL to run when Sequin is decommissioned
- **AND** it SHALL document `max_slot_wal_keep_size` (or equivalent guidance)
  as the safety net when Sequin is paused but expected to resume

### Requirement: Sequin webhook delivery semantics are documented

The system SHALL document Sequin's at-least-once webhook delivery semantics so
that the job-runner handler contract aligns with what Sequin actually retries.

#### Scenario: Job-runner returns 2xx for accepted and coalesced deliveries

- **WHEN** the job-runner webhook receives a valid Sequin payload that
  produces zero or more enqueued commands
- **THEN** it SHALL return a 2xx response
- **AND** duplicate deliveries of the same Sequin idempotency key SHALL also
  return 2xx, so Sequin does not retry the slot indefinitely

#### Scenario: Operations doc describes slot growth risk

- **WHEN** the Sequin operations documentation is inspected
- **THEN** it SHALL state that Sequin retries the webhook with exponential
  backoff (cap ~3 minutes) indefinitely
- **AND** it SHALL state that extended job-runner unavailability can grow the
  source DB WAL through the replication slot until the slot is dropped or the
  sink is paused

### Requirement: Sequin runtime has documented preflight and verification

The system SHALL document the operational checks required before enabling the
Sequin runtime and the manual verification steps that prove CDC reaches the
intended job-runner lanes.

#### Scenario: Operator checks prerequisites before startup

- **WHEN** an operator follows the Sequin operations documentation
- **THEN** they SHALL be instructed to verify `wal_level=logical` on the
  source DB, presence of a `CREATE ROLE ... WITH REPLICATION LOGIN` example,
  publication ownership, webhook secret alignment, Sequin health URL
  reachability, and job-runner reachability

#### Scenario: Local development docs describe external dependency ownership

- **WHEN** the repo-level development setup documentation is inspected
- **THEN** it SHALL state that dev orchestration starts application processes,
  not external dependencies
- **AND** it SHALL instruct developers to start required external services
  before running dependent application processes
- **AND** it SHALL describe missing dependency startup failures as expected
  diagnostics with actionable setup guidance

#### Scenario: Operator verifies search, history, and slot health

- **WHEN** Sequin is running against a non-production environment
- **THEN** the documented verification SHALL include at least one
  search-affecting table change reaching the appropriate search lane
- **AND** it SHALL include at least one `HistoryOutbox` insert routed to
  `history.outbox.ingest`
- **AND** it SHALL include a `pg_replication_slots` check confirming the slot
  is active and `confirmed_flush_lsn` is advancing
