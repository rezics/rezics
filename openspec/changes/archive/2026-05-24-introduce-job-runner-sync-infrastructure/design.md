## Context

`@rezics/server` currently owns canonical writes and also triggers many
Meilisearch projection side effects. Those side effects are inconsistent:
some services await sync helpers after the database write, some use
fire-and-forget promises, and history delivery uses a polling consumer inside
`@rezics/history`. The search projection library itself is already reasonably
factored: `@rezics/search` exposes current-state sync and patch helpers, while
server-local wrappers inject the Meilisearch client and Prisma client.

The `cdc-queue-sequin-spike` report validated the important primitives:
Sequin can deliver Postgres changes to a webhook, pg-boss can debounce
idempotent projection jobs with `policy: short`, `singletonKey`, and
`startAfter`, and current search projections should treat CDC events as
invalidation signals rather than ordered patches.

The target design introduces a lean job layer:

```txt
runtime producer
  @rezics/server
        |
        | @rezics/job HTTP client
        v
@rezics/job-runner HTTP enqueue API
        |
        v
independent pg-boss database
        |
        v
@rezics/job-runner workers
        |
        +--> @rezics/search -> Meilisearch
        +--> history ingestion -> @rezics/history DB
```

CDC routing uses the same runner service:

```txt
main Postgres logical replication
        |
        v
Sequin webhook sink
        |
        v
@rezics/job-runner /webhooks/sequin
        |
        v
typed jobs in pg-boss
```

The first implementation keeps queue API, Sequin webhook, and workers in one
package and one service. The code is organized with clear submodules so runtime
roles can split later without changing the public package shape.

## Goals / Non-Goals

**Goals:**

- Create one reliable post-write mechanism for runtime search and history side
  effects.
- Keep canonical writes in `@rezics/server` and history outbox writes in the
  main DB transaction.
- Keep pg-boss access private to `@rezics/job-runner`.
- Keep `@rezics/job` as a runtime-free contract and client package.
- Use Sequin CDC as invalidation routing, not mutation replay.
- Make Meilisearch jobs idempotent by re-reading current DB state.
- Keep seed/factory/local repair scripts independent of the queue.
- Provide enough admin and operational controls for failures, replay, and
  rebuild from the first implementation.

**Non-Goals:**

- Introduce Kafka, Redis, Debezium, direct Sequin-to-Meili sinks, or a general
  event bus.
- Split queue API, CDC router, and worker into separate packages in v1.
- Depend on CDC ordering for projection correctness.
- Move Meilisearch read APIs or public search contracts.
- Require queue infrastructure for seed/factory/local setup.

## Decisions

### Use `@rezics/job` + `@rezics/job-runner`

`@rezics/job` is a pure contract package. It defines command schemas, lane
names, tags, idempotency key helpers, and an internal HTTP enqueue client. It
does not import pg-boss, Elysia, Prisma, Meilisearch, or service env modules.

`@rezics/job-runner` is the single runtime package. It owns Elysia HTTP
endpoints, Sequin webhook verification, pg-boss setup, workers, handlers,
health, readiness, and minimal admin APIs.

Alternatives considered:

- Four-package split (`job`, `queue`, `job-worker`, `cdc-router`): clean, but
  too much deployment and env complexity before the operational blockers are
  resolved.
- One package named `@rezics/queue`: less accurate because the runtime also
  owns CDC webhook and maintenance handlers.
- Reusing `dispatch`: rejected to avoid confusion with existing dispatch domain
  semantics.

### Keep one service with role-based runtime modes

The runner supports:

```txt
JOB_RUNNER_ROLE=all
JOB_RUNNER_ROLE=http
JOB_RUNNER_ROLE=worker
```

Local development can run `all`. Production can start with `all` or split HTTP
and workers into separate processes using the same package.

### Use an independent queue database

`JOB_DATABASE_URL` points to a queue database used by pg-boss. Only
`@rezics/job-runner` receives this env var. `@rezics/server` enqueues through
the internal HTTP client and never opens a queue DB connection.

This avoids coupling main server deployment to pg-boss internals and prevents
accidental dual writes from server transactions into an unrelated database.

### Preserve `HistoryOutbox` as the atomic history source

Main server mutations continue to write `HistoryOutbox` rows in the same
transaction as canonical state. Sequin observes `HistoryOutbox` inserts and the
runner enqueues `history.outbox.ingest` jobs. The worker reads the outbox row,
writes the history DB, and marks the row processed.

This preserves atomicity without the history service polling loop. A temporary
fallback flag may keep the poller available during rollout, but the end state
has one active ingestion owner.

### Treat CDC events as invalidation signals

CDC routing maps table/action/primary keys to typed job commands. Handlers do
not apply event deltas to documents. They read current database state and call
`@rezics/search` sync/patch helpers.

This avoids correctness dependencies on webhook delivery order, `changes`
payload shape, delete before-images, or replica identity beyond primary-key
routing.

### Use lane-based queues

V1 queues:

| Lane | Purpose |
| --- | --- |
| `search.sync.fast` | single-target search sync/delete/patch jobs with minimal fanout |
| `search.sync.slow` | debounceable search projection invalidations |
| `history.ingest` | non-debounce history outbox ingestion |
| `maintenance` | rebuild, replay, drift repair, segmented fanout continuation |

Command kind remains more specific than lane, for example
`search.content.patchTags` or `history.outbox.ingest`.

### Use stable idempotency keys and tags

Every command defines:

- `kind`
- `lane`
- `payload`
- `idempotencyKey`
- `source`
- `tags`

Examples:

```txt
search.content.patchTags:unit-1
search.post.sync:post-1
search.progress.sync:user-1:unit-1
history.outbox.ingest:<outbox-id>
```

CDC source metadata is retained for audit and replay:

```txt
source.type = "sequin"
source.table
source.action
source.commitLsn
source.commitIdx
source.sequinIdempotencyKey
source.recordPks
```

### Keep seed and factory direct

Seed, factory, and local one-shot scripts continue to call `@rezics/search`
directly. These flows need deterministic failure behavior and should not
require a running job-runner, queue database, or Sequin container.

### Use segmented fanout

Fanout jobs process bounded chunks and re-enqueue themselves with a cursor when
more work remains. A job should not enqueue one child per affected document by
default, and it should not run unbounded in one attempt.

Default fanout cap: 5,000 target documents per segment unless a handler has a
smaller domain-specific cap.

### Rebuild indexes through maintenance jobs, not CDC replay

Meilisearch rebuild and drift repair are explicit maintenance commands. They
read canonical DB state and rebuild or repair current projections. CDC replay
is useful for enqueue audit/retry, but not as the primary rebuild mechanism.

## Target Package Boundaries

```txt
package/job
  src/commands/*
  src/lanes.ts
  src/tags.ts
  src/idempotency.ts
  src/client.ts

package/job-runner
  src/index.ts
  src/env.ts
  src/http/enqueue.ts
  src/http/sequin.ts
  src/http/admin.ts
  src/queue/boss.ts
  src/queue/create-queues.ts
  src/worker.ts
  src/handlers/search/*
  src/handlers/history/*
  src/handlers/maintenance/*
  sequin/sequin.yml
```

`@rezics/job-runner` can import `@rezics/job`, `@rezics/search`, server Prisma
client exports, history Prisma client exports, and Elysia runtime packages.
`@rezics/job` cannot import back from the runner or from server runtime code.

## CDC Routing Matrix

Initial routing should include at least:

| Source table | Actions | Jobs |
| --- | --- | --- |
| `HistoryOutbox` | insert/update retryable state if needed | `history.outbox.ingest(outboxId)` |
| `Unit` | insert/update/delete | `search.content.sync(unitId)`, type-specific sync/delete where applicable |
| `UnitTranslation` | insert/update/delete | content translations, realm translations, posts target fanout, entity sync as applicable |
| `UnitTag` | insert/update/delete | `search.content.patchTags(unitId)` |
| `TagVote` | insert/update/delete | no direct job if `UnitTag` aggregate update also emits; otherwise content tags |
| `UnitAlias` | insert/update/delete | content/entity/realm alias patch by unit type |
| `CreditAttribution` | insert/update/delete | `search.content.patchCredits(unitId)` |
| `SubjectAttribution` | insert/update/delete | `search.content.patchSubjects(unitId)` |
| `RealmUnit` | insert/delete | content realmIds and post realmIds for affected unit |
| `RealmTagApplication` | insert/update/delete | content realmTagKeys |
| `ShelfUnit` | insert/update/delete | shelf containedUnitIds for `shelfId` |
| `Post` | insert/update/delete | post sync/delete and content sync/delete for post unit |
| `User` | insert/update/delete | user sync/delete and posts author fanout |
| `UserUnitProgress` | insert/update/delete | progress sync/remove |
| `Feedback` | insert/update/delete | feedback sync/delete/patch |

The implementation may start with the currently proven spike tables and expand
through the server callsite migration, but tasks must track every runtime
Meili/history callsite so the end state is complete.

## Operational Surfaces

Minimum internal/admin endpoints:

- health and readiness
- enqueue one command
- Sequin webhook receiver
- list queue counts by lane/state
- inspect failed jobs
- retry failed job(s)
- discard/cancel failed job(s)
- enqueue replay by source event or logical target
- enqueue search drift repair by target
- enqueue index rebuild

These endpoints are internal/admin only and require an internal secret or root
authority check depending on exposure.

## Migration Plan

1. Add `@rezics/job` contracts and command tests.
2. Add `@rezics/job-runner` with queue creation and HTTP/worker role modes.
3. Add Sequin config for local/dev and document logical replication
   prerequisites.
4. Add search and history handlers without switching producers.
5. Convert low-risk runtime Meili callsites to enqueue and verify jobs.
6. Convert `HistoryOutbox` ingestion to queued delivery, leaving the poller
   behind a fallback disable flag.
7. Convert remaining runtime server Meili callsites.
8. Add admin retry/replay/rebuild operations.
9. Run drift repair or rebuild jobs after cutover if needed.
10. Remove the history poller default path once queued ingestion is stable.

Rollback:

- Re-enable direct server sync callsites only if a domain migration is still in
  progress.
- Re-enable the history poller fallback if job-runner ingestion is blocked.
- Since canonical writes remain in main DB and search/history are projections,
  search drift can be repaired with maintenance jobs or direct scripts.

## Risks / Trade-offs

- Queue DB unavailable -> server enqueue can fail after canonical write.
  Mitigation: CDC routing from committed source tables provides eventual
  enqueue; server direct enqueue is an accelerator, not the sole source of
  truth where CDC covers the table.
- Sequin unavailable -> projections lag.
  Mitigation: monitor Sequin lag, retain explicit drift repair and rebuild
  jobs, and keep source-of-truth in main DB.
- Duplicate delivery -> duplicate jobs or handler attempts.
  Mitigation: stable idempotency keys, pg-boss singleton keys, and DB-level
  uniqueness for history records.
- Large fanout overloads queue or Meili.
  Mitigation: segmented fanout with cursor continuation and lane concurrency
  controls.
- One runner service owns multiple concerns.
  Mitigation: keep package submodules clean and support role-based process
  split.
- Seed paths diverge from runtime paths.
  Mitigation: both call the same `@rezics/search` projection library; only the
  delivery mechanism differs.
- Logical replication requires Postgres config.
  Mitigation: document `wal_level=logical`, publications, replica identity, and
  local fallback behavior.

## Open Questions

- Should Sequin route all relevant tables on day one, or should the initial
  implementation phase CDC routing table-by-table while server producers
  enqueue directly?
- Which job admin operations need product UI in `package/admin` versus internal
  HTTP/CLI only for v1?
- Should index rebuild use temporary index + swap for every index, or only for
  indexes where zero-downtime rebuild matters in v1?
