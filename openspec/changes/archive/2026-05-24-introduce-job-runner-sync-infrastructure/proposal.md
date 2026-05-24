## Why

Server-side post-write synchronization is currently split across inline awaits,
fire-and-forget promises, and a dedicated `HistoryOutbox` poller. This change
introduces one durable job-runner path for runtime Meilisearch and history side
effects so canonical writes can stay fast while projection delivery becomes
observable, retryable, and repairable.

## Problem

Runtime mutations in `package/server` call Meilisearch sync helpers in mixed
ways: some are awaited after canonical writes, some are fire-and-forget, and
history delivery uses an independent polling loop in `@rezics/history`. These
patterns make failure handling inconsistent, leave some projection failures
visible only in logs, and complicate future CDC-based synchronization.

The `cdc-queue-sequin-spike` report validated Sequin webhook delivery and
pg-boss debounce semantics, but the production change should not create a
fourth side-effect style. It should converge existing runtime sync work behind
one job contract and one runner service.

## Goals

- Add a lean `@rezics/job` contract package and a single
  `@rezics/job-runner` Bun/Elysia service.
- Keep pg-boss in an independent queue database owned only by
  `@rezics/job-runner`.
- Ensure `@rezics/server` never reads or writes the pg-boss database directly.
- Treat CDC events as invalidation or command-routing signals, not ordered
  mutation replay.
- Route runtime Meilisearch and history side effects through durable jobs.
- Preserve `HistoryOutbox` writes in the canonical main database transaction.
- Replace the `@rezics/history` polling consumer with job-runner delivery while
  keeping history ingestion idempotent.
- Keep seed, factory, and explicit local one-shot scripts on direct
  `@rezics/search` sync paths.
- Provide minimal admin/operational surfaces for failed jobs, retry, replay,
  drift repair, and index rebuild.

## Non-goals

- Do not split the first implementation into separate queue, worker, and CDC
  router packages or separately deployed services.
- Do not replace Sequin with Kafka, Debezium, Redis Streams, or direct
  Meilisearch sinks.
- Do not make CDC events authoritative ordered patches for Meilisearch
  documents.
- Do not move canonical database writes into the job runner.
- Do not require queue infrastructure for seed/factory/local setup flows.
- Do not change public search API response contracts in this change.
- Do not remove `@rezics/search`; it remains the projection library.

## What Changes

- Add `package/job` as `@rezics/job`, a pure TypeScript contract package for:
  - job command schemas
  - queue lane names
  - job tags and metadata
  - idempotency key helpers
  - an internal HTTP enqueue client
- Add `package/job-runner` as `@rezics/job-runner`, a single Bun/Elysia service
  that owns:
  - internal enqueue HTTP API
  - Sequin webhook endpoint
  - pg-boss connection, queue creation, and workers
  - search/history/maintenance handler dispatch
  - health, readiness, and minimal admin APIs
- Add lane-based pg-boss queues:
  - `search.sync.fast`
  - `search.sync.slow`
  - `history.ingest`
  - `maintenance`
- Add role-based runtime modes for the runner:
  - `JOB_RUNNER_ROLE=all`
  - `JOB_RUNNER_ROLE=http`
  - `JOB_RUNNER_ROLE=worker`
- Configure Sequin webhook routing for selected main database tables, including
  `HistoryOutbox`, search-projection source tables, and progress source tables.
- Convert runtime `package/server` Meilisearch side effects from direct
  `sync*ToMeili`, `patch*ToMeili`, and fire-and-forget calls into enqueue calls.
- Convert `HistoryOutbox` delivery from the history service poller to
  `history.outbox.ingest` jobs.
- Keep seed/factory/direct repair scripts using direct `@rezics/search` sync
  helpers.
- Add replay, retry, failed-job inspection, and rebuild job commands sufficient
  for production operations.

## Scope

In scope:

- `package/job`
- `package/job-runner`
- `package/server` runtime mutation side-effect callsites
- `package/history` outbox consumer ownership and service startup behavior
- `package/search` handler compatibility, rebuild commands, and direct seed
  sync compatibility
- Sequin config owned with the job-runner change
- OpenAPI/internal endpoints for runner health, enqueue, webhook, and admin
- Development docs and environment examples

Out of scope:

- Frontend UI changes beyond optional admin client wiring if needed
- Replacing Meilisearch query APIs
- Changing seed/factory direct synchronization
- Splitting the runner into multiple packages or services
- Introducing a generalized event bus for every domain event

## Capabilities

### New Capabilities

- `job-runner-sync-infrastructure`: Defines the job contract package, job-runner
  service, queue lanes, CDC routing, idempotency, retry/DLQ, replay, rebuild,
  runtime/seed boundaries, and operational behavior for durable side effects.

### Modified Capabilities

- `content-sync`: Runtime content/search projection triggers move from direct
  server-side sync calls to durable job enqueueing, while explicit full sync and
  seed paths remain direct.
- `meili-partial-sync`: Partial sync primitives remain projection handlers, but
  runtime fanout and partial updates are invoked through job-runner commands
  with segmented fanout and idempotent current-state reads.
- `content-history-service`: `HistoryOutbox` remains transactional in main DB,
  but ingestion is delivered by `@rezics/job-runner` through queued
  `history.outbox.ingest` jobs instead of the history service polling loop.

## Impact

- Affected packages:
  - `package/job`: new pure contract/client package.
  - `package/job-runner`: new Elysia/Bun service package.
  - `package/server`: replaces runtime Meili/history side-effect calls with
    enqueue calls; keeps search read APIs and admin routes.
  - `package/history`: removes or disables the active polling consumer as the
    default ingestion mechanism; keeps history read APIs and persistence.
  - `package/search`: remains the shared projection library; may receive small
    handler-facing helpers for runner initialization and rebuilds.
  - `package/contract`: may expose shared DTOs/enums if job admin APIs need
    frontend or server contracts.
  - `package/admin` and `package/api`: optional follow-up if admin job controls
    are surfaced in UI.
- New runtime dependency:
  - `pg-boss` in `@rezics/job-runner`.
- New infrastructure:
  - independent queue Postgres database via `JOB_DATABASE_URL`.
  - Sequin configured against main Postgres logical replication.
- Environment:
  - `JOB_RUNNER_BASE_URL` and internal secret for producers.
  - `JOB_DATABASE_URL`, `SERVER_DATABASE_URL`, `HISTORY_DATABASE_URL`,
    `MEILI_HOST`, `MEILI_MASTER_KEY`, Sequin webhook secret, and runner role for
    `@rezics/job-runner`.
- Backward compatibility:
  - Canonical database schemas and public APIs remain compatible.
  - Existing seed/factory flows continue to work without job-runner.
  - During migration, direct sync callsites may be converted domain by domain,
    but the end state is no runtime Meili/history side-effect callsites in
    server mutations.
- Migration:
  - Run the job-runner with `JOB_RUNNER_ROLE=all` in local development.
  - Enable logical replication for dev/prod Postgres before CDC routing is
    production-required.
  - Keep the history polling consumer disabled by default after cutover, with a
    temporary fallback flag only during migration.
