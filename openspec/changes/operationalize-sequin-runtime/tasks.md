## 1. Sequin Configuration

- [ ] 1.1 Inspect current Sequin YAML documentation and pin the exact config
  schema shape used by the target Sequin image version.
- [ ] 1.2 Update `package/job-runner/sequin/sequin.yml` to define the source
  database, replication slot, publication, job-runner HTTP endpoint, and one
  non-batched webhook sink.
- [ ] 1.3 Ensure all source database credentials, Sequin runtime secrets, and
  `SEQUIN_WEBHOOK_SECRET` values are read from environment variables.
- [ ] 1.4 Define the routed table set from
  `package/job-runner/src/sequin/router.ts` and keep `HistoryOutbox` included
  for `history.outbox.ingest`.
- [ ] 1.5 Add quoted publication SQL or equivalent publication setup for
  Prisma PascalCase tables such as `"HistoryOutbox"` and `"UnitTranslation"`.
- [ ] 1.6 Verify whether Sequin sink-level table filters support quoted
  PascalCase table strings; if not verified, rely on the publication boundary
  instead of duplicating table filters.

## 2. Compose Runtime

- [ ] 2.1 Add `package/job-runner/sequin/compose.yml` with Sequin, Sequin state
  Postgres, Redis, persistent volumes, config mount, restart policy, and a
  pinned Sequin image tag.
- [ ] 2.2 Add `package/job-runner/sequin/compose.dev.yml` for local host
  networking, local port exposure, and host-local source Postgres/job-runner
  defaults.
- [ ] 2.3 Add or update `package/job-runner/.env.example` with Sequin runtime
  variables, source DB variables, and clear production-secret placeholders.
- [ ] 2.4 Ensure the base compose file can be used without dev-only host aliases
  when services are deployed on the same production compose network.

## 3. Runtime Wrapper and Scripts

- [ ] 3.1 Add `package/job-runner/scripts/dev-sequin.ts` or an equivalent Bun
  wrapper that launches the compose stack.
- [ ] 3.2 Implement deterministic runtime selection:
  explicit `CONTAINER_RUNTIME`, then `podman compose`, then
  `podman-compose`, then `docker compose`.
- [ ] 3.3 Add runtime-specific defaults for local host aliases:
  `host.containers.internal` for Podman and `host.docker.internal` for Docker.
- [ ] 3.4 Make wrapper failures actionable when no supported runtime is
  available or when compose startup exits unsuccessfully.
- [ ] 3.5 Add package and root scripts for starting Sequin through the wrapper.

## 4. Dev Orchestration

- [ ] 4.1 Add a Sequin entry to `tool/dev-script/layouts/backend.kdl` that is
  opt-in or suspended by default unless preflight checks are implemented.
- [ ] 4.2 Ensure ordinary `bun run dev` remains usable when Docker/Podman or
  logical replication prerequisites are absent.
- [ ] 4.3 Document how to start Sequin independently from the root script when
  CDC behavior needs to be tested.

## 5. Documentation

- [ ] 5.1 Update `package/job-runner/README.md` with Sequin startup, runtime
  requirements, and the single job-runner webhook ownership model.
- [ ] 5.2 Update `package/job-runner/docs/operations.md` with production and
  local CDC setup, logical replication prerequisites, publication setup, slot
  naming, secrets, and rollback.
- [ ] 5.3 Document why Sequin does not target `@rezics/history` directly and
  when the history fallback poller may be used.
- [ ] 5.4 Document Docker vs Podman runtime selection and the environment
  variables operators can use to override defaults.

## 6. Validation

- [ ] 6.1 Run OpenSpec validation for `operationalize-sequin-runtime`.
- [ ] 6.2 Run format/check commands for changed TypeScript and Markdown files.
- [ ] 6.3 Validate the Sequin config with the chosen Sequin image or startup
  logs.
- [ ] 6.4 Manually verify unauthorized `/webhooks/sequin` requests are rejected.
- [ ] 6.5 Manually verify one search-affecting table change reaches a search
  job lane through Sequin and job-runner.
- [ ] 6.6 Manually verify one `HistoryOutbox` insert reaches
  `history.outbox.ingest` through Sequin and job-runner.
