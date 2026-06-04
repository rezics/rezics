# Job Runner Operations

## Local CDC Setup

Sequin CDC is started outside `@rezics/job-runner`:

```bash
cp tool/.env.example tool/.env
bun run service up
bun run service health
bun run service logs
bun run service down
```

The wrapper loads `tool/.env`, requires Docker Compose v2, and manages source
PostgreSQL, Meilisearch, Sequin state PostgreSQL, Sequin Redis, and Sequin as
one repo compose project. It mounts `package/job-runner/sequin/sequin.yml` into
Sequin through `CONFIG_FILE_PATH=/config/sequin.yml`.

`SEQUIN_WEBHOOK_SECRET` in `tool/.env` must match
`package/job-runner/.env`.

Generate Sequin secrets with:

```bash
openssl rand -base64 48 # SECRET_KEY_BASE
openssl rand -base64 32 # VAULT_KEY
```

The documented example values in `.env.example` are refused by the wrapper.

## Source Database Prerequisites

The source Postgres database, not Sequin's state database, must allow logical
replication. The repo-managed source Postgres container starts with
`wal_level=logical`, `max_replication_slots=10`, and `max_wal_senders=10`.

```sql
SHOW wal_level;
```

The value must be `logical`. Create a dedicated replication-capable user for
Sequin in each environment:

```sql
CREATE ROLE rezics_sequin WITH REPLICATION LOGIN PASSWORD 'replace-me';
GRANT CONNECT ON DATABASE rezics_server TO rezics_sequin;
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
- Rezics PascalCase table names are quoted in `init_sql`;
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
Ranking projection backfill should use `ranking.fullSync` after Meili sortable
settings have been applied.

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
`history.outbox.ingest` work on the `history.ingest` lane.

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

## Internal Status Page

Root/admin operators can use the Rezics admin status page at `/status` after
the main server and admin SPA are running. The public app does not expose an
internal diagnostics route. The admin page reads only the main server APIs:

- `GET /diagnostic/system`
- `GET /meili/status`

The browser never calls Meilisearch, Sequin, Postgres, or job-runner admin
endpoints directly. The main server performs bounded read-only checks and
returns safe summaries.

Configure these non-secret values on `@rezics/server` so the status page can
show links and reach optional dependencies:

| Variable | Local default / example | Purpose |
| --- | --- | --- |
| `STATUS_APP_URL` | `http://localhost:35001` | Browser-facing app URL. |
| `STATUS_SERVER_URL` | `http://localhost:3000` | Main server URL for operators. |
| `STATUS_AUTH_HEALTH_URL` | `http://localhost:3001/health` | Auth service health check. |
| `STATUS_JOB_RUNNER_URL` | `http://localhost:3300` | Job-runner health/admin base URL. Falls back to `JOB_RUNNER_BASE_URL`. |
| `STATUS_MEILI_URL` | `http://localhost:7700` | Meilisearch operator URL. Falls back to `MEILI_HOST`. |
| `STATUS_SEQUIN_UI_URL` | `http://localhost:7376` | Optional Sequin UI URL. |
| `STATUS_SEQUIN_HEALTH_URL` | `http://localhost:7376/health` | Optional Sequin health URL. |
| `STATUS_SEQUIN_WEBHOOK_TARGET_NAME` | `job-runner /webhooks/sequin` | Safe display name for the configured sink target. |
| `STATUS_CDC_PUBLICATION_NAME` | `rezics_sequin_pub_development` | Expected source DB publication. |
| `STATUS_CDC_REPLICATION_SLOT_NAME` | `rezics_sequin_slot_development` | Expected source DB replication slot. |
| `STATUS_CDC_LAG_WARNING_BYTES` | `268435456` | Lag threshold that marks CDC degraded. |

Do not configure database URLs, passwords, API keys, or internal secrets as
status link values. `JOB_RUNNER_INTERNAL_SECRET` and `MEILI_MASTER_KEY` remain
server-only secrets and are never returned by status APIs.

The admin status page replaces most manual spot checks during normal operations:

- Use the Sequin and CDC panels before running the publication/slot SQL below.
- Use the queue panel before querying pg-boss directly.
- Use the Meili panel or the admin Meili status-observability route before
  opening the Meilisearch dashboard for index drift or failed tasks.

The admin status page and Meili observability route are diagnostic only. These
checks are read-only: service health, Meilisearch health/version/stats/index
settings/tasks, source DB `wal_level`, publication table membership,
replication slot state/lag, job-runner health/readiness, queue counts, and
failed job summaries.

Existing Meili init/sync/delete/key endpoints keep their current root/admin
guards in the admin Meili operations area. Init and sync operations may be
useful repair follow-ups, but `deleteAll`, `resetAll`, key creation, and key
deletion remain destructive or sensitive operations and must not be treated as
status checks.

Environments without Sequin or job-runner can leave the optional status URLs
unset. The system status response will mark those sections `unknown` instead of
failing the whole page. Enable the URLs later when the services are deployed.

Queue database expectations:

- `JOB_DATABASE_URL` points at a dedicated pg-boss database.
- The database itself must exist before startup. For local development, run
  `bun --filter=@rezics/job-runner run db:ensure` to create it from
  `JOB_DATABASE_URL` when missing.
- pg-boss owns its internal schema, tables, functions, and version migrations
  inside that database. Do not add Rezics schema-owner migrations for the job
  queue schema.
- Back up the queue database with normal Postgres backups.
- Do not expose `JOB_DATABASE_URL` to `@rezics/server`.

## Runtime Selection

Repo-managed local services require Docker Compose v2 through `docker compose`.
Podman, podman-compose, and docker-compose v1 are not supported by this managed
workflow. User-managed services remain possible by configuring package env
files manually, but the managed workflow does not discover, start, stop, or
repair unrelated services.

## Verification

Before enabling Sequin in a non-production environment:

1. Confirm `wal_level=logical` and the replication role permissions.
2. Start managed services and confirm `bun run service health` succeeds.
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
- History ingestion resumes by restarting the job-runner `history.ingest`
  worker; outbox rows remain pending or failed until the worker claims them.
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
