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

Sequin runs as part of the Nomad dev environment. Start it with `task dev`
before testing CDC or running job-runner HTTP ingress.

Run locally with:

```bash
task job-runner:dev
```

Use `JOB_RUNNER_ROLE=all` for local development when Sequin is running.
`task dev` starts `job-runner` automatically via Nomad because runtime server
mutations enqueue queue-backed search and history synchronization work.

## Roles

- `JOB_RUNNER_ROLE=all`: HTTP API and workers in one process.
- `JOB_RUNNER_ROLE=http`: enqueue, webhook, health, readiness, and admin API.
- `JOB_RUNNER_ROLE=worker`: pg-boss workers only.

Production may split HTTP and worker roles into separate processes using the
same package.

`all` and `http` require `SEQUIN_HEALTH_URL` to return 2xx during startup. This
fails before webhook ingress is exposed; ensure `task dev` is running.
`worker` skips the Sequin health check so it can drain already-enqueued
pg-boss jobs while Sequin is stopped or restarting.

## Producer Configuration

Runtime producers such as `@rezics/server` need only:

- `JOB_RUNNER_BASE_URL`
- `JOB_RUNNER_INTERNAL_SECRET`

They should not receive `JOB_DATABASE_URL`; the queue database belongs to this
service.
