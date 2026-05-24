# Job Runner Operations

## Local CDC Setup

The checked-in `sequin/sequin.yml` is a scaffold for local development. It
routes non-batched webhook messages to `/webhooks/sequin` with
`x-internal-secret: ${SEQUIN_WEBHOOK_SECRET}`.

Postgres must allow logical replication for CDC routing:

- enable `wal_level=logical`;
- create or use a replication-capable database role;
- grant publication ownership for the tables in `sequin/sequin.yml`;
- keep primary keys available for all routed tables;
- use replica identity settings that preserve primary-key routing on deletes.

When Sequin is unavailable in local development, runtime producers can still
enqueue commands through `/jobs/enqueue`. CDC-derived invalidations simply will
not be produced until Sequin is running.

## Production Roles

Run `JOB_RUNNER_ROLE=all` for a single process, or split:

- `JOB_RUNNER_ROLE=http` for enqueue, webhook, health, readiness, and admin API.
- `JOB_RUNNER_ROLE=worker` for pg-boss workers.

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

## Rollback

- Server producers can temporarily stop enqueueing by unsetting
  `JOB_RUNNER_BASE_URL` or `JOB_RUNNER_INTERNAL_SECRET`; affected mutations will
  fail fast when they attempt to enqueue.
- History ingestion fallback requires `HISTORY_OUTBOX_POLLER_FALLBACK=1`; do not
  run it while the `history.ingest` worker is active for the same outbox rows.
- Search drift after rollback should be repaired with targeted
  `maintenance.search.driftRepair` or `maintenance.search.rebuildIndex` jobs.
