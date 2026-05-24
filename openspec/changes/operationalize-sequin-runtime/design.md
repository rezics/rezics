## Context

`@rezics/job-runner` already owns the Sequin webhook endpoint, pg-boss lanes,
and handlers that turn CDC messages into typed search and history jobs. The
current checked-in `package/job-runner/sequin/sequin.yml` is only a local
scaffold: it names a webhook sink and table list, but it does not describe the
source database, replication slot, publication, endpoint resource, or the
runtime services Sequin needs.

Sequin is operationally different from Meilisearch. Meilisearch can be treated
as an already-running external HTTP service. Sequin must be started with:

- Sequin's own state Postgres database.
- Redis.
- A source database connection with logical replication enabled.
- A config file path that Sequin applies at startup.
- A webhook destination that can reach `@rezics/job-runner`.

History remains part of the CDC path, but it is not a separate Sequin webhook
target. `@rezics/history` serves read APIs and has a fallback poller; normal
queued ingestion is owned by `@rezics/job-runner` through the
`history.outbox.ingest` lane.

## Goals / Non-Goals

**Goals:**

- Provide a reproducible Sequin runtime that works for local development and can
  be adapted for production deployment.
- Upgrade `package/job-runner/sequin/sequin.yml` to an IaC-style configuration
  that defines source database, publication/slot, HTTP endpoint, and sink.
- Keep a single Sequin webhook target: `@rezics/job-runner`.
- Support Docker and Podman without hard-coding one container runtime.
- Document and preflight the Postgres logical replication requirements,
  including Prisma's PascalCase table names and quoted publication SQL.
- Keep ordinary `bun run dev` usable when Sequin prerequisites are absent.

**Non-Goals:**

- Do not redesign job routing or replace pg-boss.
- Do not send Sequin messages directly to `@rezics/history`.
- Do not make seed, factory, or one-shot repair scripts require Sequin.
- Do not introduce application API contract changes.
- Do not make production secrets or database credentials part of checked-in
  files.

## Decisions

### Decision 1: Sequin delivers only to job-runner

Sequin SHALL deliver CDC messages to `@rezics/job-runner` at
`/webhooks/sequin`. The job-runner webhook routes `HistoryOutbox` inserts to
`history.outbox.ingest` and routes search-affecting table changes to search
lanes.

Alternative considered: add a second Sequin sink for `@rezics/history`.
Rejected because it creates two delivery owners for the same main database
outbox. The current architecture explicitly makes `@rezics/job-runner` the
durable side-effect owner; `@rezics/history` is a read service plus fallback
consumer.

```text
main Postgres
  -> Sequin
    -> @rezics/job-runner /webhooks/sequin
      -> search.sync.fast / search.sync.slow
      -> history.ingest
      -> maintenance
```

### Decision 2: Use one env-driven Sequin IaC config

`package/job-runner/sequin/sequin.yml` will become the source-controlled Sequin
IaC config. It will define:

- Source database connection fields via environment interpolation.
- Replication slot and publication names.
- The HTTP endpoint for job-runner.
- One non-batched webhook sink for the tables routed by
  `src/sequin/router.ts`.

The config should avoid hard-coded secrets. Local defaults may be safe host and
port defaults, but credentials and webhook secret values come from environment
variables.

Alternative considered: generate Sequin config entirely from a Bun script.
Rejected for v1 because Sequin's native IaC file is easier to inspect, use in
production, and compare in review. A wrapper script can still interpolate and
launch the runtime.

### Decision 3: Base compose is production-capable, dev behavior is an override

Use a base compose file for the reusable runtime topology:

- `sequin`
- `sequin-postgres`
- `sequin-redis`
- persistent volumes
- `CONFIG_FILE_PATH=/config/sequin.yml`
- restart and health-oriented settings
- image pinned to an explicit Sequin version

Use a dev override for host-local assumptions:

- expose the Sequin UI/API port
- map host gateway aliases
- default source database host values for local Postgres
- default job-runner webhook host values for local Bun services

Alternative considered: a dev-only compose file. Rejected because production
would need to rediscover the same topology and env contract.

### Decision 4: Runtime wrapper chooses Podman or Docker deterministically

The Sequin startup command will run through a small Bun wrapper instead of
embedding `docker compose` directly in zellij. Selection order:

1. Use explicit `CONTAINER_RUNTIME` if set.
2. Prefer `podman compose` when available.
3. Use `podman-compose` when available.
4. Use `docker compose` when available.
5. Fail with clear install/configuration guidance.

The wrapper owns runtime-specific host alias defaults:

- Docker local development normally uses `host.docker.internal`, with Linux
  `host-gateway` support in the dev override.
- Podman local development normally uses `host.containers.internal`.

Alternative considered: always use Docker. Rejected because some target
environments use Podman and the script can reasonably abstract the compose
entrypoint without changing the Sequin topology.

### Decision 5: Publication SQL is the authority for PascalCase tables

Prisma creates quoted PascalCase table names such as `"HistoryOutbox"` and
`"UnitTranslation"`. Postgres folds unquoted identifiers to lowercase, so
publication setup must quote these names:

```sql
CREATE PUBLICATION rezics_sequin_pub FOR TABLE
  public."HistoryOutbox",
  public."Unit",
  public."UnitTranslation";
```

The implementation should prefer quoted publication SQL as the authoritative
table filter. If Sequin sink-level `include_tables` is also used, the exact
string format for quoted PascalCase table names must be verified against Sequin
configuration validation or boot logs before relying on it.

Alternative considered: rely only on a YAML table list. Rejected until the
quote handling for PascalCase table names is verified because a wrong string can
silently miss the intended tables or fail startup.

### Decision 6: Sequin is visible in dev orchestration but not a hard default

The local zellij layout may include a Sequin tab, but it should be suspended or
otherwise opt-in by default unless the implementation proves prerequisites can
be checked without noisy failure. Developers can run a dedicated root script
when they need CDC.

Alternative considered: always auto-start Sequin from `bun run dev`. Rejected
because many local environments will not have Docker/Podman or logical
replication enabled, and normal frontend/backend development should remain
available without CDC.

## Risks / Trade-offs

- [Risk] Source Postgres lacks `wal_level=logical` or replication-capable
  permissions. -> Mitigation: add preflight checks and explicit docs before
  startup.
- [Risk] Incorrect table quoting causes Sequin to miss Prisma PascalCase
  tables. -> Mitigation: use quoted publication SQL and include manual
  verification tasks for Sequin config validation or boot logs.
- [Risk] Docker and Podman host networking aliases differ. -> Mitigation:
  centralize runtime detection and default host alias selection in the wrapper.
- [Risk] Production deployments accidentally use dev host defaults. ->
  Mitigation: keep production-capable compose in the base file and put
  host-local defaults in a dev override.
- [Risk] Operators run the history fallback poller and the job-runner history
  worker simultaneously. -> Mitigation: keep docs explicit that Sequin feeds
  job-runner and the fallback poller is temporary/opt-in only.

## Migration Plan

1. Add the Sequin IaC config, compose base, compose dev override, env examples,
   and runtime wrapper.
2. Add root and package scripts for starting Sequin through the wrapper.
3. Add or adjust the local zellij Sequin entry as opt-in/suspended by default.
4. Document source database logical replication setup, publication SQL, secrets,
   and runtime selection.
5. Verify locally with an unauthorized webhook request, one search-affecting
   table change, and one `HistoryOutbox` insert.
6. For production, deploy Sequin with production env values and run the same
   verification against non-production data before enabling CDC for live use.

Rollback: stop the Sequin compose stack and leave job-runner running. Server
producer enqueue paths and explicit repair/rebuild jobs continue to work.
History fallback polling may be enabled only if the job-runner history worker is
not consuming the same rows.

## Open Questions

- Which Sequin image tag should be pinned for the first production-capable
  compose file?
- Should publication creation be owned entirely by Sequin `initial_snapshot` or
  `init_sql` config, or should the repo expose a separate operator SQL script?
- Should the zellij tab be suspended by default or hidden behind an explicit
  environment flag?
