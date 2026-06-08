# @rezics/job-runner

Internal Bun/Elysia service that owns durable side-effect delivery for search,
history, and maintenance jobs.

`@rezics/job-runner` is the runtime service. It reads env, opens the pg-boss
queue database, exposes internal HTTP endpoints, accepts Sequin webhooks, and
runs workers.

It pairs with `@rezics/job`, which is only the shared command contract and
enqueue client. `@rezics/job` defines what a command looks like; this package
decides how that command is stored and executed.

```text
@rezics/server
  -> uses @rezics/job to create/send commands
  -> POST /jobs/enqueue

@rezics/job-runner
  -> validates with @rezics/job
  -> stores commands in pg-boss
  -> workers execute search/history/maintenance handlers
```

## Local startup

Create a local env file first:

```bash
cp package/job-runner/.env.example package/job-runner/.env
```

Required environment for this service:

- `JOB_DATABASE_URL`: independent Postgres database for pg-boss.
- `SERVER_DATABASE_URL`: canonical server database for current-state reads.
- `HISTORY_DATABASE_URL`: history database for outbox ingestion.
- `MEILI_HOST` and `MEILI_MASTER_KEY`: Meilisearch admin connection.
- `JOB_RUNNER_INTERNAL_SECRET`: shared secret for producer/admin requests.
- `SEQUIN_WEBHOOK_SECRET`: shared secret for Sequin webhook delivery.
- `SEQUIN_HEALTH_URL`: Sequin `/health` endpoint required by `http` and `all`
  roles before exposing `/webhooks/sequin`.
- `JOB_RUNNER_ROLE`: `all`, `http`, or `worker`; defaults to `all`.
- `PORT`: optional HTTP port, defaults to `3005`.

Create the dedicated queue database before starting the service:

```bash
task job-runner:db:ensure
```

The script reads `JOB_DATABASE_URL`, connects through the `postgres` or
`template1` maintenance database, and creates the target database if it is
missing. pg-boss owns its internal schema and migrations inside that database;
the job-runner package only creates/verifies queues and queue policies at
startup.

Start Sequin explicitly when testing CDC or running job-runner HTTP ingress:

```bash
cp tool/.env.example tool/.env

# Generate real local secrets before first startup.
openssl rand -base64 48 # SECRET_KEY_BASE
openssl rand -base64 32 # VAULT_KEY

task service:up
task service:health
```

The managed runtime uses Docker Compose v2 through `tool/service`.
It starts source PostgreSQL, Meilisearch, Sequin state services, and Sequin in
one repo compose project. Its checked-in config delivers only to this service at
`/webhooks/sequin` with the `x-internal-secret` value from
`SEQUIN_WEBHOOK_SECRET`. It does not target `@rezics/history` directly; history
ingestion is enqueued by the job-runner `history.outbox.ingest` worker lane.

Tool-owned Sequin runtime settings live in `tool/.env`. The
`SEQUIN_WEBHOOK_SECRET` value in `tool/.env` must match
`package/job-runner/.env`.

Run locally with:

```bash
task job-runner:dev
```

Use `JOB_RUNNER_ROLE=all` for local development when Sequin is running. The root
`task dev` zellij session starts the `job-runner` process automatically
because runtime server mutations enqueue queue-backed search and history
synchronization work. If this service is not running, those runtime writes
either fail while enqueueing or leave derived state stale.

## Roles

- `JOB_RUNNER_ROLE=all`: HTTP API and workers in one process.
- `JOB_RUNNER_ROLE=http`: enqueue, webhook, health, readiness, and admin API.
- `JOB_RUNNER_ROLE=worker`: pg-boss workers only.

Production may split HTTP and worker roles into separate processes using the
same package.

`all` and `http` require `SEQUIN_HEALTH_URL` to return 2xx during startup. This
fails before webhook ingress is exposed and points operators at
`task service:up`. `worker` skips the Sequin health check so it can
drain already-enqueued pg-boss jobs while Sequin is stopped or restarting.

## Producer Configuration

Runtime producers such as `@rezics/server` need only:

- `JOB_RUNNER_BASE_URL`
- `JOB_RUNNER_INTERNAL_SECRET`

They should not receive `JOB_DATABASE_URL`; the queue database belongs to this
service.
