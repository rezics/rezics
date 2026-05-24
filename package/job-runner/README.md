# @rezics/job-runner

Internal Bun/Elysia service that owns durable side-effect delivery for runtime
search and history synchronization.

## Local startup

Required environment:

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

Use `JOB_RUNNER_ROLE=all` for local development. Production may split HTTP and
worker roles into separate processes using the same package.
