## 1. Sequin Configuration (schema verified against v0.14.6)

- [ ] 1.1 Rewrite `package/job-runner/sequin/sequin.yml` against the verified
  Sequin v0.14.6 schema: top-level `databases`, `http_endpoints`, and `sinks`
  sections using `${VAR:-default}` interpolation for all
  environment-dependent values.
- [ ] 1.2 Configure `databases[].slot` with an environment-suffixed name
  (`rezics_sequin_slot_${ENV}`) and `create_if_not_exists: true`, and
  `databases[].publication` with `create_if_not_exists: true` plus an
  `init_sql` block.
- [ ] 1.3 Write the `init_sql` `CREATE PUBLICATION` statement listing every
  table routed by `package/job-runner/src/sequin/router.ts` as
  `public."<PascalCaseName>"` (HistoryOutbox, Unit, UnitTranslation, UnitTag,
  TagVote, UnitAlias, CreditAttribution, SubjectAttribution, RealmUnit,
  RealmTagApplication, RealmTagUnit, ShelfUnit, Post, User, UserUnitProgress,
  Feedback). Keep the list in sync with the router via a doc comment.
- [ ] 1.4 Define one `http_endpoints` entry for job-runner using
  `encrypted_headers` (not plain `headers`) with `x-internal-secret:
  ${SEQUIN_WEBHOOK_SECRET}` so the secret is encrypted at rest in Sequin's
  state DB.
- [ ] 1.5 Define one webhook sink with `destination.type: webhook`,
  `destination.batch: false`, `destination.http_endpoint_path:
  /webhooks/sequin`, and `source.include_tables` listing
  `public.<PascalCaseName>` for every routed table (defense-in-depth filter).
- [ ] 1.6 Do NOT include `initial_backfill` in the checked-in config; document
  it as a runbook step operators add per-environment for first deploy of
  HistoryOutbox only.
- [ ] 1.7 Confirm the source database connection fields
  (`SOURCE_DB_HOST/PORT/NAME/USER/PASSWORD`) and `SEQUIN_WEBHOOK_SECRET` are
  the only credential surfaces; no plaintext secret values in the file.

## 2. Compose Runtime

- [ ] 2.1 Add `package/job-runner/sequin/compose.yml` with:
  - `sequin` service on `sequin/sequin:v0.14.6` (pinned, no
    `pull_policy: always`), port `7376`, env vars
    `PG_HOSTNAME`/`PG_DATABASE`/`PG_USERNAME`/`PG_PASSWORD`/`PG_POOL_SIZE`/
    `REDIS_URL`/`SECRET_KEY_BASE`/`VAULT_KEY`/`CONFIG_FILE_PATH=/config/sequin.yml`,
    read-only bind mount of `./sequin.yml:/config/sequin.yml:ro`, TCP
    healthcheck on 7376, restart policy `unless-stopped`.
  - `sequin-postgres` on `postgres:16`, persistent volume, healthcheck via
    `pg_isready`; do NOT pass `-c wal_level=logical` (state DB only).
  - `sequin-redis` on `redis:7`, persistent volume.
  - `depends_on` with `condition: service_healthy` for `sequin-postgres` and
    `condition: service_started` for `sequin-redis`.
  - Do NOT include the reference compose's Prometheus/Grafana services.
- [ ] 2.2 Add `package/job-runner/sequin/compose.dev.yml` overriding:
  - Expose Sequin UI on `7376` and Sequin-postgres on `7377` to the host.
  - Default `SOURCE_DB_HOST` to `host.docker.internal` (overridden by
    wrapper to `host.containers.internal` for Podman).
  - Default `JOB_RUNNER_BASE_URL` to the host-gateway URL.
  - Linux Docker hosts: add `extra_hosts:
    ["host.docker.internal:host-gateway"]`.
- [ ] 2.3 Update `package/job-runner/.env.example` adding source DB vars,
  `SEQUIN_WEBHOOK_SECRET`, `SECRET_KEY_BASE`, `VAULT_KEY`, and an inline
  comment showing the generation commands (`openssl rand -base64 48` for
  `SECRET_KEY_BASE`, `openssl rand -base64 32` for `VAULT_KEY`). Mark the
  example values as DO-NOT-USE-IN-PRODUCTION.
- [ ] 2.4 Ensure the base compose file requires
  `SOURCE_DB_HOST`/`JOB_RUNNER_BASE_URL`/secrets from env with no fallback,
  so production deployments cannot silently fall back to dev defaults.

## 3. Runtime Wrapper and Scripts

- [ ] 3.1 Add `package/job-runner/scripts/sequin.ts` (Bun) that resolves
  `compose -f compose.yml -f compose.dev.yml` for local dev, `-f compose.yml`
  for production, and wraps `up`/`down`/`logs`/`config plan`/`config apply`.
- [ ] 3.2 Implement deterministic runtime selection:
  explicit `CONTAINER_RUNTIME` → `podman compose` → `podman-compose` →
  `docker compose`. Distinguish "unknown runtime name" vs "name known but
  binary not on PATH" in failure messages. (Legacy hyphenated `docker-compose`
  v1 is intentionally out of scope; the wrapper SHALL print explicit guidance
  if it detects only v1.)
- [ ] 3.3 Add runtime-specific defaults for local host aliases:
  `host.containers.internal` for Podman, `host.docker.internal` for Docker.
- [ ] 3.4 On Podman + Linux with SELinux enabled, rewrite the config
  bind-mount with the `:Z` suffix to avoid permission denied on the mounted
  `sequin.yml`.
- [ ] 3.5 Refuse to start when `SECRET_KEY_BASE` or `VAULT_KEY` equals the
  documented example value, with a clear `openssl rand` suggestion.
- [ ] 3.6 Make wrapper failures actionable when no supported runtime is
  available or when compose startup exits unsuccessfully.
- [ ] 3.7 Add package and root scripts for starting Sequin through the
  wrapper (e.g. `bun --filter=@rezics/job-runner run sequin:up`,
  root-level `bun run sequin:up`).

## 4. Dev Orchestration

- [ ] 4.1 Add a Sequin entry to `tool/dev-script/layouts/backend.kdl` with
  `start_suspended=true` so ordinary `bun run dev` does not hard-fail when
  Docker/Podman or logical replication prerequisites are absent.
- [ ] 4.2 Ensure ordinary `bun run dev` remains usable when Docker/Podman or
  logical replication prerequisites are absent.
- [ ] 4.3 Document how to start Sequin independently from the root script
  when CDC behavior needs to be tested.

## 5. Documentation

- [ ] 5.1 Update `package/job-runner/README.md` with Sequin startup, runtime
  requirements (`SECRET_KEY_BASE`/`VAULT_KEY` generation), and the single
  job-runner webhook ownership model.
- [ ] 5.2 Update `package/job-runner/docs/operations.md` with:
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
- [ ] 5.3 Document why Sequin does not target `@rezics/history` directly and
  when the history fallback poller may be used.
- [ ] 5.4 Document Docker vs Podman runtime selection, the environment
  variables operators can use to override defaults, and the rootless-Podman
  SELinux `:Z` mount caveat.

## 6. Validation

- [ ] 6.1 Run `openspec validate operationalize-sequin-runtime --strict`.
- [ ] 6.2 Run format/check commands for changed TypeScript and Markdown files.
- [ ] 6.3 Boot the Sequin runtime with `sequin/sequin:v0.14.6` and verify the
  config loads cleanly from `CONFIG_FILE_PATH`, slot + publication are
  created, and startup logs show no schema errors.
- [ ] 6.4 Manually verify unauthorized `/webhooks/sequin` requests are
  rejected by job-runner.
- [ ] 6.5 Manually verify one search-affecting table change reaches a search
  job lane through Sequin and job-runner.
- [ ] 6.6 Manually verify one `HistoryOutbox` insert reaches
  `history.outbox.ingest` through Sequin and job-runner.
- [ ] 6.7 Query `pg_replication_slots` and confirm the configured slot is
  active and `confirmed_flush_lsn` advances after handling test traffic.
- [ ] 6.8 Stop the job-runner, push one source-DB change, observe Sequin
  retrying with exp backoff; restart job-runner and confirm the message is
  redelivered exactly-once-effectively (idempotency key dedup).
