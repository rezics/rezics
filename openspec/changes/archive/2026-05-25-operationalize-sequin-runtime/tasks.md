## 1. Sequin Configuration (schema verified against v0.14.6)

- [x] 1.1 Rewrite `package/job-runner/sequin/sequin.yml` against the verified
  Sequin v0.14.6 schema: top-level `databases`, `http_endpoints`, and `sinks`
  sections using `${VAR:-default}` interpolation for all
  environment-dependent values.
- [x] 1.2 Configure `databases[].slot` with an environment-suffixed name
  (`rezics_sequin_slot_${ENV}`) and `create_if_not_exists: true`, and
  `databases[].publication` with `create_if_not_exists: true` plus an
  `init_sql` block.
- [x] 1.3 Write the `init_sql` `CREATE PUBLICATION` statement listing every
  table routed by `package/job-runner/src/sequin/router.ts` as
  `public."<PascalCaseName>"` (HistoryOutbox, Unit, UnitTranslation, UnitTag,
  TagVote, UnitAlias, CreditAttribution, SubjectAttribution, RealmUnit,
  RealmTagApplication, RealmTagUnit, ShelfUnit, Post, User, UserUnitProgress,
  Feedback). Keep the list in sync with the router via a doc comment.
- [x] 1.4 Define one `http_endpoints` entry for job-runner using
  `encrypted_headers` (not plain `headers`) with `x-internal-secret:
  ${SEQUIN_WEBHOOK_SECRET}` so the secret is encrypted at rest in Sequin's
  state DB.
- [x] 1.5 Define one webhook sink with `destination.type: webhook`,
  `destination.batch: false`, `destination.http_endpoint_path:
  /webhooks/sequin`, and `source.include_tables` listing
  `public.<PascalCaseName>` for every routed table (defense-in-depth filter).
- [x] 1.6 Do NOT include `initial_backfill` in the checked-in config; document
  it as a runbook step operators add per-environment for first deploy of
  HistoryOutbox only.
- [x] 1.7 Confirm the source database connection fields
  (`SOURCE_DB_HOST/PORT/NAME/USER/PASSWORD`) and `SEQUIN_WEBHOOK_SECRET` are
  the only credential surfaces; no plaintext secret values in the file.

## 2. Compose Runtime

- [x] 2.1 Add `tool/external-services/sequin/compose.yml` with:
  - `sequin` service on `sequin/sequin:v0.14.6` (pinned, no
    `pull_policy: always`), port `7376`, env vars
    `PG_HOSTNAME`/`PG_DATABASE`/`PG_USERNAME`/`PG_PASSWORD`/`PG_POOL_SIZE`/
    `REDIS_URL`/`SECRET_KEY_BASE`/`VAULT_KEY`/`CONFIG_FILE_PATH=/config/sequin.yml`,
    read-only bind mount of
    `package/job-runner/sequin/sequin.yml:/config/sequin.yml:ro`, HTTP
    healthcheck against `/health` on 7376, restart policy `unless-stopped`.
  - `sequin-postgres` on `postgres:16`, persistent volume, healthcheck via
    `pg_isready`; do NOT pass `-c wal_level=logical` (state DB only).
  - `sequin-redis` on `redis:7`, persistent volume.
  - `depends_on` with `condition: service_healthy` for `sequin-postgres` and
    `condition: service_started` for `sequin-redis`.
  - Do NOT include the reference compose's Prometheus/Grafana services.
- [x] 2.2 Add `tool/external-services/sequin/compose.dev.yml` overriding:
  - Expose Sequin UI on `7376` and Sequin-postgres on `7377` to the host.
  - Default `SOURCE_DB_HOST` to `host.docker.internal` (overridden by
    wrapper to `host.containers.internal` for Podman).
  - Default `JOB_RUNNER_BASE_URL` to the host-gateway URL.
  - Linux Docker hosts: add `extra_hosts:
    ["host.docker.internal:host-gateway"]`.
- [x] 2.3 Update `package/job-runner/.env.example` adding source DB vars,
  `SEQUIN_WEBHOOK_SECRET`, `SECRET_KEY_BASE`, `VAULT_KEY`, and an inline
  comment showing the generation commands (`openssl rand -base64 48` for
  `SECRET_KEY_BASE`, `openssl rand -base64 32` for `VAULT_KEY`). Mark the
  example values as DO-NOT-USE-IN-PRODUCTION.
- [x] 2.4 Ensure the base compose file requires
  `SOURCE_DB_HOST`/`JOB_RUNNER_BASE_URL`/secrets from env with no fallback,
  so production deployments cannot silently fall back to dev defaults.

## 3. Runtime Wrapper and Scripts

- [x] 3.1 Add `tool/external-services/compose-runtime.ts` for shared
  Docker/Podman compose detection and command execution, without importing it
  from application packages.
- [x] 3.2 Add `tool/external-services/sequin.ts` (Bun) that resolves
  `compose -f sequin/compose.yml -f sequin/compose.dev.yml` for local dev,
  `-f sequin/compose.yml` for production, and wraps `up`/`down`/`logs`/
  `health`/`config plan`/`config apply`.
- [x] 3.3 Implement deterministic runtime selection:
  explicit `CONTAINER_RUNTIME` → `podman compose` → `podman-compose` →
  `docker compose`. Distinguish "unknown runtime name" vs "name known but
  binary not on PATH" in failure messages. (Legacy hyphenated `docker-compose`
  v1 is intentionally out of scope; the wrapper SHALL print explicit guidance
  if it detects only v1.)
- [x] 3.4 Add runtime-specific defaults for local host aliases:
  `host.containers.internal` for Podman, `host.docker.internal` for Docker.
- [x] 3.5 On Podman + Linux with SELinux enabled, rewrite the config
  bind-mount with the `:Z` suffix to avoid permission denied on the mounted
  `sequin.yml`.
- [x] 3.6 Refuse to start when `SECRET_KEY_BASE` or `VAULT_KEY` equals the
  documented example value, with a clear `openssl rand` suggestion.
- [x] 3.7 Make wrapper failures actionable when no supported runtime is
  available or when compose startup exits unsuccessfully.
- [x] 3.8 Add root scripts for Sequin lifecycle through the wrapper (e.g.
  `bun run service:sequin:up`, `service:sequin:down`,
  `service:sequin:logs`, `service:sequin:health`). Do not add package-local
  scripts that make `@rezics/job-runner` own the runtime lifecycle.

## 4. Job-runner Sequin Dependency Check

- [x] 4.1 Add `SEQUIN_HEALTH_URL` to `package/job-runner/src/env.ts` and
  `.env.example`, with local default guidance pointing at the Sequin `/health`
  endpoint exposed by the external-service wrapper.
- [x] 4.2 Add a small job-runner startup preflight that requests
  `SEQUIN_HEALTH_URL` and requires a 2xx response.
- [x] 4.3 Run the Sequin preflight only when `JOB_RUNNER_ROLE` is `http` or
  `all`; do not run it for `worker`.
- [x] 4.4 Make preflight failure messages actionable: include the checked URL,
  the role that required it, and the root command used to start Sequin.
- [x] 4.5 Add unit coverage for `http`/`all` failing when Sequin is
  unreachable, `http`/`all` passing when Sequin is healthy, and `worker`
  skipping the check.

## 5. Dev Orchestration

- [x] 5.1 Do NOT add a Sequin tab or pane to `tool/dev-script` layouts.
- [x] 5.2 Keep existing backend panes, including `@rezics/job-runner`, eligible
  to auto-start from the dev layout. Do not suspend app panes solely because
  they depend on external services.
- [x] 5.3 Treat missing external dependencies as application startup diagnostics:
  the service should fail with an actionable error, and docs should tell
  developers which external-service command to run.

## 6. Documentation

- [x] 6.1 Update `CONTRIBUTING.md` Development Setup with the repo-wide external
  dependency contract: `bun run dev` starts application processes, not external
  dependencies; developers should start required external services first; a
  service failing fast because Postgres, Meilisearch, Sequin, Redis, or another
  external dependency is unavailable is expected behavior.
- [x] 6.2 Update `package/job-runner/README.md` with Sequin startup, runtime
  requirements (`SECRET_KEY_BASE`/`VAULT_KEY` generation), job-runner
  `http`/`all` Sequin health dependency, `worker` independence, and the single
  job-runner webhook ownership model.
- [x] 6.3 Update `package/job-runner/docs/operations.md` with:
  - `wal_level=logical` check and `CREATE ROLE ... WITH REPLICATION LOGIN
    PASSWORD '...'` SQL example for the source DB.
  - `init_sql` publication semantics: created once, and how to use `ALTER
    PUBLICATION ... ADD TABLE` / drop-and-recreate when the routed table
    set changes.
  - Environment-suffixed slot naming convention.
  - Slot lifecycle on rollback: `pg_drop_replication_slot` and
    `DROP PUBLICATION` SQL for decommission, `max_slot_wal_keep_size`
    guidance for pause.
  - `pg_replication_slots.confirmed_flush_lsn` monitoring.
  - Sequin's at-least-once webhook semantics (exp backoff cap ~3 min,
    indefinite retry, only 2xx counts as success) and the implication that
    the job-runner handler MUST return 2xx for accepted and coalesced
    deliveries.
- [x] 6.4 Document why Sequin does not target `@rezics/history` directly and
  when the history fallback poller may be used.
- [x] 6.5 Document Docker vs Podman runtime selection, the environment
  variables operators can use to override defaults, and the rootless-Podman
  SELinux `:Z` mount caveat.
- [x] 6.6 Update `tool/README.md` with the `tool/external-services` boundary:
  lifecycle wrappers live in `tool/`, application packages expose env and
  health contracts, and app runtime code must not import tool helpers.

## 7. Validation

- [x] 7.1 Run `openspec validate operationalize-sequin-runtime --strict`.
- [x] 7.2 Run format/check commands for changed TypeScript and Markdown files.
- [ ] 7.3 Boot the Sequin runtime with `sequin/sequin:v0.14.6` and verify the
  config loads cleanly from `CONFIG_FILE_PATH`, slot + publication are
  created, and startup logs show no schema errors.
- [ ] 7.4 Manually verify unauthorized `/webhooks/sequin` requests are
  rejected by job-runner.
- [ ] 7.5 Manually verify one search-affecting table change reaches a search
  job lane through Sequin and job-runner.
- [ ] 7.6 Manually verify one `HistoryOutbox` insert reaches
  `history.outbox.ingest` through Sequin and job-runner.
- [ ] 7.7 Query `pg_replication_slots` and confirm the configured slot is
  active and `confirmed_flush_lsn` advances after handling test traffic.
- [ ] 7.8 Stop the job-runner, push one source-DB change, observe Sequin
  retrying with exp backoff; restart job-runner and confirm the message is
  redelivered exactly-once-effectively (idempotency key dedup).
- [ ] 7.9 Verify `JOB_RUNNER_ROLE=http` and `all` fail startup when
  `SEQUIN_HEALTH_URL` is unreachable, and verify `JOB_RUNNER_ROLE=worker`
  starts without checking Sequin.
