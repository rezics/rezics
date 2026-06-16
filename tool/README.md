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
task service:up
task service:health
task service:ps
task service:logs
task service -- logs --tail=200 sequin
task service:down
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
task service -- config plan
```

Verify every Sequin CDC source database after startup:

```sh
task service -- cdc verify
```

Use recovery for existing, external, or broken local CDC sources. Recovery stops
Sequin, repairs the selected source publication/slot, starts Sequin again, and
verifies the source state:

```sh
task service -- cdc recover
task service -- cdc recover --source=reaction
task service -- cdc recover --source=reaction --force-active-slot
```

`task service -- source repair` is a legacy main/source-only repair command;
prefer `cdc recover` so reaction CDC is not skipped. Low-level repair can
recreate local Sequin publications and replication slots. If it changes
Postgres settings with `ALTER SYSTEM`, restart that Postgres instance and verify
again. The repair path is not part of the fresh managed Docker happy path.

User-managed PostgreSQL, Meilisearch, Redis, or Sequin instances remain manual.
Point package env files at them yourself and avoid `service` commands for
those services. The managed Docker workflow only starts, stops, inspects, and
repairs the repo Docker Compose project; it will not stop host services or
unrelated containers. If a default port is already in use, stop the conflicting
service manually or override the published port in `tool/.env`.

Use `task service -- ...` for the repo-managed local Docker workflow.

## Browser Inspect Workbench

`tool/browser-inspect` is a headed Playwright workbench for agent-led live URL
inspection when normal fetch/headless access is blocked by Cloudflare, login,
captcha, consent, or other browser-state flows.

Reusable helpers live in `tool/browser-inspect/src/`; one-off investigation
scripts go in the ignored `tool/browser-inspect/work/` directory.

```sh
task browser:inspect -- current.ts
```

The browser profile is stored in the ignored `tool/browser-inspect/profile/`
directory so user-completed verification and login state can be reused. The
default helper flow leaves the browser open for screenshots, DevTools, and
manual DOM/CSS copying.

## Deploy

Production deploys as Docker images via [Kamal](https://kamal-deploy.org) (config
in `config/`, workflows in `.github/workflows/`), with static frontends on
Cloudflare Pages. See [`docs/guide/deployment.md`](../docs/guide/deployment.md).

```sh
bin/deploy <git-sha>   # validate → infra → migrate → services → workers → backfill
```

The previous systemd + rsync single-host path is retired.
