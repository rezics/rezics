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
