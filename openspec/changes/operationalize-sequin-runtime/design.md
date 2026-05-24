## Context

`@rezics/job-runner` already owns the Sequin webhook endpoint, pg-boss lanes,
and handlers that turn CDC messages into typed search and history jobs. The
current checked-in `package/job-runner/sequin/sequin.yml` is only a local
scaffold: it names a webhook sink and table list, but it does not describe the
source database, replication slot, publication, endpoint resource, or the
runtime services Sequin needs.

Sequin is operationally different from Meilisearch. Meilisearch can be treated
as an already-running external HTTP service. Sequin must be started with:

- Sequin's own state Postgres database.
- Redis.
- A source database connection with logical replication enabled.
- A config file path that Sequin applies at startup.
- A webhook destination that can reach `@rezics/job-runner`.

History remains part of the CDC path, but it is not a separate Sequin webhook
target. `@rezics/history` serves read APIs and has a fallback poller; normal
queued ingestion is owned by `@rezics/job-runner` through the
`history.outbox.ingest` lane.

## Goals / Non-Goals

**Goals:**

- Provide a reproducible Sequin runtime that works for local development and can
  be adapted for production deployment.
- Upgrade `package/job-runner/sequin/sequin.yml` to an IaC-style configuration
  that defines source database, publication/slot, HTTP endpoint, and sink.
- Keep a single Sequin webhook target: `@rezics/job-runner`.
- Support Docker and Podman without hard-coding one container runtime.
- Document and preflight the Postgres logical replication requirements,
  including Prisma's PascalCase table names and quoted publication SQL.
- Keep ordinary `bun run dev` usable when Sequin prerequisites are absent.

**Non-Goals:**

- Do not redesign job routing or replace pg-boss.
- Do not send Sequin messages directly to `@rezics/history`.
- Do not make seed, factory, or one-shot repair scripts require Sequin.
- Do not introduce application API contract changes.
- Do not make production secrets or database credentials part of checked-in
  files.

## Decisions

### Decision 1: Sequin delivers only to job-runner

Sequin SHALL deliver CDC messages to `@rezics/job-runner` at
`/webhooks/sequin`. The job-runner webhook routes `HistoryOutbox` inserts to
`history.outbox.ingest` and routes search-affecting table changes to search
lanes.

Alternative considered: add a second Sequin sink for `@rezics/history`.
Rejected because it creates two delivery owners for the same main database
outbox. The current architecture explicitly makes `@rezics/job-runner` the
durable side-effect owner; `@rezics/history` is a read service plus fallback
consumer.

```text
main Postgres
  -> Sequin
    -> @rezics/job-runner /webhooks/sequin
      -> search.sync.fast / search.sync.slow
      -> history.ingest
      -> maintenance
```

### Decision 2: Use one env-driven Sequin IaC config

`package/job-runner/sequin/sequin.yml` will become the source-controlled Sequin
IaC config loaded by Sequin at startup through `CONFIG_FILE_PATH`. The schema
verified against Sequin v0.14.6 uses:

```yaml
databases:
  - name: rezics-source
    hostname: ${SOURCE_DB_HOST:-host.docker.internal}
    port: ${SOURCE_DB_PORT:-5432}
    database: ${SOURCE_DB_NAME:-rezics_booklib}
    username: ${SOURCE_DB_USER:-postgres}
    password: ${SOURCE_DB_PASSWORD}
    pool_size: 10
    slot:
      name: ${SEQUIN_SLOT_NAME:-rezics_sequin_slot}
      create_if_not_exists: true
    publication:
      name: ${SEQUIN_PUB_NAME:-rezics_sequin_pub}
      create_if_not_exists: true
      init_sql: |
        CREATE PUBLICATION ${SEQUIN_PUB_NAME:-rezics_sequin_pub}
        FOR TABLE
          public."HistoryOutbox",
          public."Unit",
          public."UnitTranslation",
          ... -- full list from router.ts
    await_database:
      timeout_ms: 30000
      interval_ms: 3000

http_endpoints:
  - name: job-runner
    url: ${JOB_RUNNER_BASE_URL:-http://host.docker.internal:3005}
    encrypted_headers:
      - key: x-internal-secret
        value: ${SEQUIN_WEBHOOK_SECRET}

sinks:
  - name: rezics-job-runner-webhook
    database: rezics-source
    source:
      include_tables:
        - public.HistoryOutbox
        - public.Unit
        - ... -- full list
    destination:
      type: webhook
      http_endpoint: job-runner
      http_endpoint_path: /webhooks/sequin
      batch: false
```

Hard-coded values are limited to safe local-development defaults (`localhost`,
`5432`, dev-friendly slot names). Production secrets (`SOURCE_DB_PASSWORD`,
`SEQUIN_WEBHOOK_SECRET`) and base URLs come from environment variables.

Alternative considered: generate Sequin config entirely from a Bun script.
Rejected because Sequin's native IaC file is easier to inspect, use in
production, and compare in review, and Sequin's own `${VAR}` interpolation
removes the need for an external templating step.

### Decision 3: Base compose is production-capable, dev behavior is an override

Use a base compose file for the reusable runtime topology:

- `sequin` pinned to `sequin/sequin:v0.14.6`, port `7376`
- `sequin-postgres` on `postgres:16` (state DB only, does NOT need
  `wal_level=logical`; the reference compose only sets that because its
  playground reuses the state DB as the source DB)
- `sequin-redis` on `redis:7`
- persistent volumes for `sequin-postgres` and `sequin-redis`
- `CONFIG_FILE_PATH=/config/sequin.yml` with config mounted read-only
- required Sequin env vars sourced from environment:
  `PG_HOSTNAME`, `PG_DATABASE`, `PG_USERNAME`, `PG_PASSWORD`, `REDIS_URL`,
  `SECRET_KEY_BASE`, `VAULT_KEY`
- TCP healthcheck on port `7376` (Sequin does not expose a documented HTTP
  health endpoint)
- `depends_on` with `condition: service_healthy` for the state postgres

Use a dev override for host-local assumptions:

- expose the Sequin UI/API port
- map host gateway aliases
- default source database host values for local Postgres
- default job-runner webhook host values for local Bun services

Alternative considered: a dev-only compose file. Rejected because production
would need to rediscover the same topology and env contract.

### Decision 4: Runtime wrapper chooses Podman or Docker deterministically

The Sequin startup command will run through a small Bun wrapper instead of
embedding `docker compose` directly in zellij. Selection order:

1. Use explicit `CONTAINER_RUNTIME` if set.
2. Prefer `podman compose` when available.
3. Use `podman-compose` when available.
4. Use `docker compose` when available.
5. Fail with clear install/configuration guidance.

The wrapper owns runtime-specific host alias defaults:

- Docker local development normally uses `host.docker.internal`, with Linux
  `host-gateway` support in the dev override.
- Podman local development normally uses `host.containers.internal`.

Podman caveats the wrapper and docs should call out, since Sequin does not
publish official Podman guidance:

- Rootless Podman maps container UIDs to the host user; bind-mounted volumes
  (`./sequin.yml`, `sequin-postgres` data) may need `:Z` SELinux relabel or
  `:U` userns remap suffixes on Linux distributions with SELinux.
- The wrapper SHOULD detect Podman and, when invoked on a Linux host with
  SELinux enabled, apply the `:Z` suffix to bind-mounted config paths.

Alternative considered: always use Docker. Rejected because some target
environments use Podman and the script can reasonably abstract the compose
entrypoint without changing the Sequin topology.

### Decision 5: Sequin owns publication and slot creation through init_sql

Sequin v0.14.6 supports `slot.create_if_not_exists: true` and
`publication.create_if_not_exists: true`, plus a `publication.init_sql` block
for arbitrary CREATE PUBLICATION SQL. We use init_sql to write the publication
with explicit Prisma PascalCase quoting:

```yaml
publication:
  name: ${SEQUIN_PUB_NAME:-rezics_sequin_pub}
  create_if_not_exists: true
  init_sql: |
    CREATE PUBLICATION ${SEQUIN_PUB_NAME:-rezics_sequin_pub}
    FOR TABLE
      public."HistoryOutbox",
      public."Unit",
      public."UnitTranslation",
      public."UnitTag",
      public."TagVote",
      public."UnitAlias",
      public."CreditAttribution",
      public."SubjectAttribution",
      public."RealmUnit",
      public."RealmTagApplication",
      public."RealmTagUnit",
      public."ShelfUnit",
      public."Post",
      public."User",
      public."UserUnitProgress",
      public."Feedback";
```

`init_sql` runs only on first creation, so post-creation schema changes (adding
or removing routed tables) require either dropping the publication and letting
Sequin recreate it, or running `ALTER PUBLICATION` out-of-band. This is
documented in the operations guide.

Sink-level `include_tables` uses `schema.table` strings (e.g.
`public.HistoryOutbox`) and is preserved case-sensitive by YAML, so it acts as
a defense-in-depth filter. The publication boundary, not the sink filter, is
the authoritative table set.

Alternative considered: leave publication creation to a separate operator SQL
script. Rejected because keeping it inside `sequin.yml` means a single applied
config is enough to bootstrap a fresh environment, and Sequin's
`create_if_not_exists` semantics make the SQL safely idempotent.

### Decision 6: Sequin is visible in dev orchestration but not a hard default

The local zellij layout may include a Sequin tab, but it should be suspended or
otherwise opt-in by default unless the implementation proves prerequisites can
be checked without noisy failure. Developers can run a dedicated root script
when they need CDC.

Alternative considered: always auto-start Sequin from `bun run dev`. Rejected
because many local environments will not have Docker/Podman or logical
replication enabled, and normal frontend/backend development should remain
available without CDC.

### Decision 7: Slot lifecycle is part of rollback

Sequin advances the source DB's `confirmed_flush_lsn` once a message is either
delivered to its sink or persisted to Sequin's internal state Postgres. With
the HTTP webhook sink and no `change_retentions` configured, "persisted
internally" applies to a bounded retry buffer only. If `@rezics/job-runner` is
unreachable for an extended period AND that buffer fills, the slot stops
advancing and source-DB WAL accumulates without bound.

Operational implications baked into the runtime and docs:

- Slot names SHALL include an environment suffix
  (`rezics_sequin_slot_${ENV}`) so dev/staging/prod cannot collide on a shared
  source DB.
- Rollback ("stop Sequin compose stack") SHALL include explicit guidance:
  either drop the publication and slot (`SELECT
  pg_drop_replication_slot('rezics_sequin_slot_${ENV}')` and `DROP PUBLICATION
  ...`) if Sequin is being decommissioned, or set `max_slot_wal_keep_size` on
  the source DB if the operator intends to bring Sequin back later.
- Sequin retries the webhook with exponential backoff capped at ~3 minutes,
  indefinitely, and treats only 2xx as success. The job-runner webhook
  endpoint MUST return 2xx for successfully enqueued (or coalesced)
  commands, including duplicates, so retries do not stall the slot.

### Decision 8: Initial backfill is an opt-in runbook step

Sequin's sink-level `initial_backfill` fires once when a sink is first created
and is ignored on subsequent updates. The checked-in `sequin.yml` SHALL NOT
hard-code `initial_backfill`. Operators choose backfill behavior per
environment:

- For a fresh production environment, enable `initial_backfill` on
  `HistoryOutbox` only on first apply so in-flight outbox rows reach
  `history.outbox.ingest`. Search projections are reconciled separately through
  existing `maintenance.search.rebuildIndex` jobs and should not rely on Sequin
  backfill.
- For local dev, leave `initial_backfill` off; seed/factory scripts already
  populate search projections directly without going through Sequin.

Rationale: `initial_backfill` interacts with idempotency keys and projection
rebuild jobs in ways that are environment-specific, and a single hard-coded
value is wrong somewhere. Making it a runbook decision avoids surprise
duplicates.

## Risks / Trade-offs

- [Risk] Source Postgres lacks `wal_level=logical` or replication-capable
  permissions. -> Mitigation: preflight docs include the exact `wal_level`
  check and a `CREATE ROLE ... WITH REPLICATION LOGIN PASSWORD '...'` example
  before the operator runs the wrapper.
- [Risk] Incorrect table quoting causes Sequin to miss Prisma PascalCase
  tables. -> Mitigation: publication is created via `init_sql` with explicit
  quoted PascalCase identifiers; sink `include_tables` is defense-in-depth, not
  the authority.
- [Risk] Docker and Podman host networking aliases differ; rootless Podman
  also needs SELinux relabel suffixes on bind mounts. -> Mitigation: wrapper
  centralizes runtime detection, default host alias selection, and (on Podman +
  SELinux) `:Z` suffixes for mounted config.
- [Risk] Production deployments accidentally use dev host defaults. ->
  Mitigation: keep production-capable compose in the base file and put
  host-local defaults (`host.docker.internal`, exposed UI port) in the dev
  override. The base file SHALL require `SOURCE_DB_HOST` and
  `JOB_RUNNER_BASE_URL` from environment with no fallback.
- [Risk] Job-runner downtime fills Sequin's retry buffer and stalls slot
  advancement, growing source-DB WAL without bound. -> Mitigation: docs
  prescribe monitoring `pg_replication_slots.confirmed_flush_lsn` lag, setting
  `max_slot_wal_keep_size` on the source DB, and treating extended job-runner
  outages as a slot-rollback decision.
- [Risk] `init_sql` runs only on first publication creation, so adding or
  removing routed tables silently does nothing. -> Mitigation: operations doc
  documents both `ALTER PUBLICATION ... ADD/DROP TABLE` for incremental
  changes and the drop-and-recreate path for full re-sync.
- [Risk] Sequin defaults to `latest` and `pull_policy: always` in its
  reference compose, which would silently upgrade in production. -> Mitigation:
  pin `sequin/sequin:v0.14.6` and drop `pull_policy: always` in the base
  compose.
- [Risk] `SECRET_KEY_BASE` / `VAULT_KEY` are required by Sequin but easy to
  miss; reusing the demo values in production would break secret encryption
  guarantees on the Sequin state DB. -> Mitigation: env.example documents
  `openssl rand -base64 48` (SECRET_KEY_BASE) and `openssl rand -base64 32`
  (VAULT_KEY), and the wrapper refuses to start if either matches a known
  example value.
- [Risk] Operators run the history fallback poller and the job-runner history
  worker simultaneously. -> Mitigation: keep docs explicit that Sequin feeds
  job-runner and the fallback poller is temporary/opt-in only.

## Migration Plan

1. Add the Sequin IaC config (with `init_sql` publication and PascalCase
   quoting), compose base pinned to `sequin/sequin:v0.14.6`, compose dev
   override, env examples (`SECRET_KEY_BASE`, `VAULT_KEY`, source DB vars,
   webhook secret), and runtime wrapper.
2. Add root and package scripts for starting Sequin through the wrapper.
3. Add or adjust the local zellij Sequin entry as opt-in/suspended by default.
4. Document source database logical replication setup
   (`wal_level=logical`, replication-capable role SQL), publication ownership
   via `init_sql`, slot lifecycle and naming convention with environment
   suffix, secret generation commands, and runtime selection.
5. Verify locally with: (a) an unauthorized webhook request rejected by
   job-runner, (b) one search-affecting table change reaching
   `search.sync.fast`/`search.sync.slow`, (c) one `HistoryOutbox` insert
   reaching `history.outbox.ingest`, and (d) `pg_replication_slots` shows the
   slot active with `confirmed_flush_lsn` advancing.
6. For production, deploy Sequin with production env values, decide
   per-environment whether to enable `initial_backfill` on the
   `HistoryOutbox`-only sink for first apply, and run the same verification
   against non-production data before enabling CDC for live use.

Rollback: stop the Sequin compose stack and leave job-runner running. Server
producer enqueue paths and explicit repair/rebuild jobs continue to work.
History fallback polling may be enabled only if the job-runner history worker
is not consuming the same rows. If Sequin is being decommissioned rather than
paused, drop the replication slot and publication on the source DB after
stopping the stack to prevent WAL accumulation:

```sql
SELECT pg_drop_replication_slot('rezics_sequin_slot_${ENV}');
DROP PUBLICATION rezics_sequin_pub_${ENV};
```

## Open Questions

- [resolved] Image tag: pin `sequin/sequin:v0.14.6` (latest stable on Docker
  Hub as of this proposal).
- [resolved] Publication ownership: Sequin owns it via `init_sql` +
  `create_if_not_exists: true`, with quoted PascalCase identifiers.
- Should the zellij tab be suspended by default or hidden behind an explicit
  environment flag?
- Whether to surface a one-shot `sequin config plan`/`apply` step in the
  wrapper for production change-management, or rely on container restart to
  re-apply config.
