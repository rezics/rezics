# Production Troubleshooting Runbook

## Logs

- Every backend emits **structured JSON** to the container log stream
  (`OBSERVABILITY_LOG_FORMAT=json`): `kamal app logs -d <unit>` /
  `docker logs rezics-<unit>-…`.
- When the `infra-observability` unit is up, services also export **OTLP** to
  the Collector (`OTEL_EXPORTER_OTLP_ENDPOINT` + `OBSERVABILITY_TELEMETRY=enabled`);
  query traces in ClickStack.

## Failed healthchecks

- `/health` = liveness, `/ready` = readiness (queue/db wiring). A unit that
  boots but fails `/ready` usually cannot reach its database or a dependency.
- kamal-proxy will not promote a container that fails `/health`; the previous
  container keeps serving. Inspect `kamal app logs -d <unit>` for the boot
  error, fix env/secrets, redeploy.
- Check the env gate first: `bin/deploy <sha> validate`.

## Migration failures

- The release aborts before service rollout (see
  [release runbook](./production-release.md)). The migrate image of the same
  `<sha>` ran `prisma migrate deploy`; read its job output for the failing
  migration. Fix forward (migrations are forward-only); never hand-edit
  `_prisma_migrations`.

## Proxy routing

- Public hosts (`api`, `auth`, `notify`, `reaction`) route through kamal-proxy
  with TLS; `history` is internal-proxied; `ranking` and all workers have **no**
  proxy route (container DNS only). A 404/502 on an internal name usually means
  calling it by the wrong container alias — services resolve each other as
  `rezics-<service>:<port>` on the `kamal` network.

## Replication-slot lag (both CDC sources)

Sequin streams **two** sources — the main database (`rezics_booklib`) and the
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

- `job-runner` (HTTP) ingests Sequin webhooks and the enqueue API;
  `job-runner-worker` consumes the default lanes; `ranking-worker` consumes only
  the `ranking` lane. If ranking recompute is backed up but search/history are
  fine, scale `ranking-worker` independently — the lanes are isolated by design.
- Confirm `SEQUIN_HEALTH_URL` is reachable from `job-runner`; a failing Sequin
  preflight blocks HTTP-role startup.
