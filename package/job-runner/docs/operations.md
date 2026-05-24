# Job Runner Operations

## Local CDC Setup

Sequin CDC is started outside `@rezics/job-runner`:

```bash
bun run service:sequin:up
bun run service:sequin:health
bun run service:sequin:logs
bun run service:sequin:down
```

The wrapper loads `package/job-runner/.env` when present, chooses Podman or
Docker compose deterministically, and mounts
`package/job-runner/sequin/sequin.yml` into Sequin through
`CONFIG_FILE_PATH=/config/sequin.yml`. The base compose file is production
capable; the dev override exposes Sequin on `127.0.0.1:7376` and defaults host
aliases for local Postgres and Bun services.

Generate Sequin secrets with:

```bash
openssl rand -base64 48 # SECRET_KEY_BASE
openssl rand -base64 32 # VAULT_KEY
```

The documented example values in `.env.example` are refused by the wrapper.

## Source Database Prerequisites

The source Postgres database, not Sequin's state database, must allow logical
replication.

```sql
SHOW wal_level;
```

The value must be `logical`. Create a dedicated replication-capable user for
Sequin in each environment:

```sql
CREATE ROLE rezics_sequin WITH REPLICATION LOGIN PASSWORD 'replace-me';
GRANT CONNECT ON DATABASE rezics_booklib TO rezics_sequin;
GRANT USAGE ON SCHEMA public TO rezics_sequin;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO rezics_sequin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO rezics_sequin;
```

The publication is created by Sequin through `publication.init_sql`, so the
role used for first boot also needs permission to create the publication over
the routed tables.

## Publication and Slot Ownership

`sequin/sequin.yml` owns the replication slot and publication:

- slot names use `rezics_sequin_slot_${ENV}` to avoid dev/staging/prod
  collisions;
- publication names use `rezics_sequin_pub_${ENV}`;
- Prisma PascalCase table names are quoted in `init_sql`;
- `source.include_tables` is a sink-level defense-in-depth filter, not the
  authoritative table boundary.

`init_sql` runs only when Sequin first creates the publication. When
`package/job-runner/src/sequin/router.ts` adds or removes a routed table, update
`sequin.yml` and then either run incremental SQL:

```sql
ALTER PUBLICATION rezics_sequin_pub_development ADD TABLE public."Unit";
ALTER PUBLICATION rezics_sequin_pub_development DROP TABLE public."Unit";
```

or drop the publication and let Sequin recreate it on the next config apply:

```sql
DROP PUBLICATION rezics_sequin_pub_development;
```

## Initial Backfill

The checked-in config intentionally omits `initial_backfill`. Operators may add
it per environment for the first sink creation only, typically for
`HistoryOutbox` so in-flight outbox rows reach `history.outbox.ingest`. Search
projection backfill should use existing maintenance rebuild jobs instead.

## Delivery Semantics

Sequin delivers CDC webhooks at least once. It retries non-2xx responses with
exponential backoff capped around three minutes and continues retrying
indefinitely. The job-runner webhook must return 2xx for accepted commands and
coalesced duplicate idempotency keys so Sequin does not stall the replication
slot.

If job-runner remains unavailable long enough to fill Sequin's retry buffer, the
source DB replication slot may stop advancing and WAL can grow without bound.
Monitor:

```sql
SELECT slot_name, active, confirmed_flush_lsn
FROM pg_replication_slots
WHERE slot_name = 'rezics_sequin_slot_development';
```

Use source-DB `max_slot_wal_keep_size` as a pause safety net when Sequin is
expected to resume.

## History Ownership

Sequin targets only `@rezics/job-runner`. `@rezics/history` is not a direct
Sequin sink because job-runner owns durable side effects and enqueues
`history.outbox.ingest` work on the `history.ingest` lane. The history fallback
poller is temporary and opt-in; do not run it while the job-runner history
worker is consuming the same outbox rows.

## Production Roles

Run `JOB_RUNNER_ROLE=all` for a single process, or split:

- `JOB_RUNNER_ROLE=http` for enqueue, webhook, health, readiness, and admin API.
- `JOB_RUNNER_ROLE=worker` for pg-boss workers.

`http` and `all` require `SEQUIN_HEALTH_URL` to return 2xx before
`/webhooks/sequin` is exposed. `worker` skips this check so existing pg-boss
jobs can drain while Sequin is stopped or restarting.

Health endpoints:

- `GET /health`
- `GET /ready`

Queue database expectations:

- `JOB_DATABASE_URL` points at a dedicated pg-boss database.
- The database itself must exist before startup. For local development, run
  `bun --filter=@rezics/job-runner run db:ensure` to create it from
  `JOB_DATABASE_URL` when missing.
- pg-boss owns its internal schema, tables, functions, and version migrations
  inside that database. Do not add Prisma migrations for the job queue schema.
- Back up the queue database with normal Postgres backups.
- Do not expose `JOB_DATABASE_URL` to `@rezics/server`.

## Runtime Selection

The Sequin wrapper chooses a runtime in this order:

1. `CONTAINER_RUNTIME`, when set to `podman`, `podman-compose`, or `docker`.
2. `podman compose`.
3. `podman-compose`.
4. `docker compose`.

Docker local development uses `host.docker.internal`; Podman uses
`host.containers.internal`. On Linux with SELinux enforcing, the wrapper applies
`:Z` to the read-only config bind mount so rootless Podman can read
`sequin.yml`.

## Verification

Before enabling Sequin in a non-production environment:

1. Confirm `wal_level=logical` and the replication role permissions.
2. Start Sequin and confirm `bun run service:sequin:health` succeeds.
3. Confirm `JOB_RUNNER_BASE_URL` reaches `@rezics/job-runner`.
4. Confirm unauthorized `/webhooks/sequin` requests return 401.
5. Change one search-affecting table and verify a search lane receives work.
6. Insert one `HistoryOutbox` row and verify `history.outbox.ingest` receives
   work.
7. Query `pg_replication_slots` and confirm the configured slot is active and
   `confirmed_flush_lsn` advances after test traffic.
8. Stop job-runner, push one source-DB change, observe Sequin retrying, restart
   job-runner, and confirm the message is redelivered without duplicate effects.

## Rollback

- Server producers can temporarily stop enqueueing by unsetting
  `JOB_RUNNER_BASE_URL` or `JOB_RUNNER_INTERNAL_SECRET`; affected mutations will
  fail fast when they attempt to enqueue.
- History ingestion fallback requires `HISTORY_OUTBOX_POLLER_FALLBACK=1`; do
  not run it while the `history.ingest` worker is active for the same outbox
  rows.
- Search drift after rollback should be repaired with targeted
  `maintenance.search.driftRepair` or `maintenance.search.rebuildIndex` jobs.
- If Sequin is paused but expected to resume, configure source-DB
  `max_slot_wal_keep_size` and monitor slot lag.
- If Sequin is being decommissioned, stop the stack and drop the source-DB slot
  and publication:

```sql
SELECT pg_drop_replication_slot('rezics_sequin_slot_development');
DROP PUBLICATION rezics_sequin_pub_development;
```
