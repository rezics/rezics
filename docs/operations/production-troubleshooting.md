# Production Troubleshooting Runbook

## Logs

- Every backend emits **structured JSON** to the container log stream
  (`OBSERVABILITY_LOG_FORMAT=json`): `nomad alloc logs <alloc-id>` /
  `docker logs <container>`.
- When the `infra-otel` job is up, services also export **OTLP** to
  the Collector (`OTEL_EXPORTER_OTLP_ENDPOINT` + `OBSERVABILITY_TELEMETRY=enabled`);
  query traces in ClickStack.

## Failed healthchecks

- `/health` = liveness, `/ready` = readiness (queue/db wiring). A unit that
  boots but fails `/ready` usually cannot reach its database or a dependency.
- Nomad will not promote an allocation that fails health checks; the previous
  allocation keeps serving (`auto_revert = true`). Inspect
  `nomad alloc logs <alloc-id>` for the boot error, fix env/secrets, redeploy.

## Migration failures

- The release aborts before service rollout (see
  [release runbook](./production-release.md)). The migrate image of the same
  `<sha>` ran the package `db:deploy` command; read its job output for the
  failing migration. Fix forward (migrations are forward-only); never hand-edit
  Drizzle migration journal tables. Schema owners use Drizzle Kit's default
  migration journal table; there is no separate Rezics migration ledger.
- For `server` migrations, `ltree extension is missing` means the custom SQL
  migration did not create the required extension. If preflight also says the
  connected role cannot create extensions, ask a DBA/elevated role to run
  `CREATE EXTENSION IF NOT EXISTS ltree;` on the server database, then rerun
  `db:deploy`.

## Proxy routing

- Public hosts (`api`, `auth`, `notify`, `reaction`) route through the reverse
  proxy with TLS; `history` is internal-proxied; `ranking` and all workers have
  **no** proxy route (Nomad service discovery only). A 404/502 on an internal
  name usually means calling it by the wrong address — services resolve each
  other via Nomad service discovery or Docker networking.

## Replication-slot lag (both CDC sources)

Sequin streams **two** sources — the main database (`rezics_server`) and the
reaction database (`rezics_reaction`) — each with its own publication and
logical replication slot. An offline/slow consumer grows WAL on the source DB,
which can fill disk.

- Monitor lag per slot:

  ```sql
  SELECT slot_name, active,
         pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained_wal
  FROM pg_replication_slots;
  ```

  Watch `rezics_sequin_slot_*` (main) and `rezics_reaction_sequin_slot_*`
  (reaction). Alert when `active = false` or `retained_wal` keeps climbing.
- If a slot is wedged and WAL is dangerously high, the documented recovery is to
  drop and recreate the slot/publication (Sequin re-snapshots on reconnect):

  ```sql
  SELECT pg_drop_replication_slot('<slot_name>');   -- only when its consumer is stopped
  ```

  Then let Sequin recreate it from `sequin.yml`. Expect a re-sync window.

## Worker queue readiness

- `job-runner-http` ingests Sequin webhooks and the enqueue API;
  `job-runner-worker` consumes the default lanes; `ranking-worker` consumes only
  the `ranking` lane. If ranking recompute is backed up but search/history are
  fine, scale `ranking-worker` independently — the lanes are isolated by design.
- Confirm `SEQUIN_HEALTH_URL` is reachable from `job-runner-http`; a failing
  Sequin preflight blocks HTTP-role startup.
