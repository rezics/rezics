# @rezics/job

Shared job command contract and enqueue client for Rezics background work.

This package does not run jobs. It has no worker process, queue connection,
database client, Meilisearch client, or runtime env. It exists so producers and
consumers agree on the exact command shape before a job is placed on the queue.

## What It Owns

- Command schemas for `search.*`, `history.*`, and `maintenance.*` jobs.
- Queue lane names such as `search.sync.fast`, `search.sync.slow`,
  `history.ingest`, and `maintenance`.
- Idempotency key helpers and searchable job tags.
- `JobEnqueueClient`, the internal HTTP client used by producers to call
  `@rezics/job-runner`.

## Relationship To Job Runner

```text
@rezics/server
  imports @rezics/job
  creates a command
  POSTs it to @rezics/job-runner

@rezics/job
  validates command shape
  provides lanes, tags, idempotency, and HTTP client

@rezics/job-runner
  runs the service process
  stores commands in pg-boss
  executes handlers
```

Use this package when code needs to create, validate, or send a job command.
Use `@rezics/job-runner` when code needs the runtime service that owns pg-boss,
HTTP endpoints, Sequin webhooks, and workers.

## Boundaries

`@rezics/job` must stay lightweight and contract-only. Do not add dependencies
on pg-boss, Elysia, database clients, Meilisearch clients, or env modules here.
