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
- `JOB_RUNNER_ROLE`: `all`, `http`, or `worker`; defaults to `all`.
- `PORT`: optional HTTP port, defaults to `3005`.

Run locally with:

```bash
bun --filter=@rezics/job-runner run dev
```

Use `JOB_RUNNER_ROLE=all` for local development. In the root `bun run dev`
zellij layout, the `job-runner` tab exists but starts suspended; resume it only
when you need queue-backed runtime sync.

## Roles

- `JOB_RUNNER_ROLE=all`: HTTP API and workers in one process.
- `JOB_RUNNER_ROLE=http`: enqueue, webhook, health, readiness, and admin API.
- `JOB_RUNNER_ROLE=worker`: pg-boss workers only.

Production may split HTTP and worker roles into separate processes using the
same package.

## Producer Configuration

Runtime producers such as `@rezics/server` need only:

- `JOB_RUNNER_BASE_URL`
- `JOB_RUNNER_INTERNAL_SECRET`

They should not receive `JOB_DATABASE_URL`; the queue database belongs to this
service.
