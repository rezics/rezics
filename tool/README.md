# Tooling

Repo-level automation lives under `tool/`. Application packages may expose env
contracts and health checks, but runtime application code must not import helper
modules from `tool/`.

## Dev External Services

`tool/service` owns the repo-managed local dependency stack for
PostgreSQL, Meilisearch, Sequin state PostgreSQL, Sequin Redis, and Sequin.
This workflow requires Docker Compose v2 through `docker compose`; Podman,
podman-compose, and docker-compose v1 are not supported.

```sh
cp tool/.env.example tool/.env
```

Set real local values for `SECRET_KEY_BASE` and `VAULT_KEY` before starting
Sequin. `SEQUIN_WEBHOOK_SECRET` must match `package/job-runner/.env`.

```sh
bun run service up
bun run service health
bun run service ps
bun run service logs
bun run service down
```

The managed source Postgres container starts with logical replication enabled:
`wal_level=logical`, `max_replication_slots=10`, and `max_wal_senders=10`.
On a fresh Docker volume it also creates the local development databases used
by package env examples: `rezics_server`, `rezics_auth`, `rezics_jobs`,
`rezics_history`, `rezics_notify`, and `reaction`. Schema-owning package
migrations run through the repo `db:*` tooling; `job-runner` only runs
`db:ensure` because pg-boss owns its internal schema.

Validate the compose plan without starting services:

```sh
bun run service config plan
```

Verify the managed source database after startup:

```sh
bun run service source verify
```

Use repair only for existing, external, or broken local source databases:

```sh
bun run service source repair
bun run service source repair --force-active-slot
```

Repair can recreate the local Sequin publication and replication slot. If it
changes Postgres settings with `ALTER SYSTEM`, restart that Postgres instance
and verify again. The repair path is not part of the fresh managed Docker
happy path.

User-managed PostgreSQL, Meilisearch, Redis, or Sequin instances remain manual.
Point package env files at them yourself and avoid `service` commands for
those services. The managed Docker workflow only starts, stops, inspects, and
repairs the repo Docker Compose project; it will not stop host services or
unrelated containers. If a default port is already in use, stop the conflicting
service manually or override the published port in `tool/.env`.

Use `bun run service ...` for the repo-managed local Docker workflow.

## Deploy

Production deploys as Docker images via [Kamal](https://kamal-deploy.org) (config
in `config/`, workflows in `.github/workflows/`), with static frontends on
Cloudflare Pages. See [`docs/guide/deployment.md`](../docs/guide/deployment.md).

```sh
bin/deploy <git-sha>   # validate → infra → migrate → services → workers → backfill
```

The previous systemd + rsync single-host path is retired.
