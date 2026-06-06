# Sequin Source DB Recovery Report

**Status**: Operational report  
**Date**: 2026-06-03  
**Scope**: Recovering Sequin CDC after source database migrations, resets, slot
loss, publication changes, or database replacement  
**Report type**: Engineering runbook + risk notes, not an implementation plan

---

## 1. Executive Summary

Rezics routes source database changes through Sequin into `@rezics/job-runner`.
For history, the path is:

```text
@rezics/server mutation
  -> source DB public."HistoryOutbox"
  -> Sequin source publication + logical replication slot
  -> job-runner /webhooks/sequin
  -> pg-boss history.ingest job
  -> @rezics/history DB UnitRevision / StructureEvent
```

When source DB state changes outside normal row writes, such as local database
reset, migration rebuild, publication table drift, slot deletion, database
restore, or service container recreation, the source DB and Sequin state can
diverge. The common symptom is:

```text
HistoryOutbox rows stay pending
pg-boss has no history.ingest job
history DB has no UnitRevision
```

The fast recovery principle is:

1. Confirm job-runner is reachable.
2. Confirm Sequin is reachable.
3. Confirm source Postgres publication and replication slot exist.
4. Restart Sequin only after source DB prerequisites are valid.
5. If rows were already missed, repair with a bounded backfill/retry path.

Restarting Sequin alone only helps if the source slot/publication exists and
Sequin was merely stuck. If the physical source slot is missing while Sequin
state still believes it exists, stop Sequin, repair the source slot/publication,
then start Sequin.

---

## 2. Current Incident Pattern

Observed local state for a book edit failure:

```text
main DB HistoryOutbox:
  status = pending
  attempts = 0

job DB pgboss.job:
  no history.ingest job for the outbox IDs

history DB UnitRevision:
  no rows for the unit

source DB pg_replication_slots:
  missing rezics_sequin_slot_development

Sequin logs:
  No replication slot found: rezics_sequin_slot_development
  max_wal_senders currently 10
```

This means job-runner was not the failing component. The main source CDC stream
never delivered `HistoryOutbox` inserts to job-runner.

The likely sequence is:

```text
source DB reset / slot dropped / service state changed
  -> physical source replication slot disappeared
  -> Sequin state still had an active slot/sink record
  -> Sequin retried startup replication connections
  -> idle walsenders accumulated
  -> max_wal_senders exhausted
  -> source CDC stayed unavailable
```

---

## 3. Development Environment Runbook

### 3.1 Fast Status Check

Run these first:

```bash
bun run service ps
bun run service health
bun run service source verify
curl -fsS http://localhost:3005/health
curl -fsS http://localhost:3005/ready
curl -fsS http://localhost:7376/health
```

Expected healthy source verification:

```text
ok    wal_level is logical
ok    max_replication_slots is ...
ok    max_wal_senders is ...
ok    tracked tables exist (...)
ok    publication rezics_sequin_pub_development tracks exactly ... table(s)
ok    replication slot rezics_sequin_slot_development exists
```

The expected source table set is code-owned in
`package/job/src/sequin/manifest.ts` (`ROUTED_SEQUIN_TABLES`). Treat that
manifest as the source of truth for publication verification, local source
repair, and Sequin YAML drift tests; do not hand-maintain a separate table list
in this runbook.

If only the replication slot is missing, Sequin restart may be enough only if
Sequin can recreate it cleanly. If logs show repeated slot-not-found or
`max_wal_senders` exhaustion, use the explicit repair flow below.

### 3.2 Quick Sequin Restart

Use this when source verification passes or after a small config change:

```bash
docker compose -p rezics-dev-external-services \
  -f tool/service/compose.yml restart sequin
```

Then verify:

```bash
bun run service source verify
```

### 3.3 Slot Missing or WAL Senders Exhausted

Use this when `source verify` reports:

```text
fail  replication slot rezics_sequin_slot_development does not exist
```

or Sequin logs contain:

```text
No replication slot found matching name=rezics_sequin_slot_development
number of requested standby connections exceeds "max_wal_senders"
```

Development recovery:

```bash
docker compose -p rezics-dev-external-services \
  -f tool/service/compose.yml stop sequin

bun run service source repair

docker compose -p rezics-dev-external-services \
  -f tool/service/compose.yml start sequin

bun run service source verify
```

If the slot is active and must be dropped in development:

```bash
bun run service source repair --force-active-slot
```

Use `--force-active-slot` only in local/dev. It can terminate the backend using
the slot.

### 3.4 Check WAL Sender Leaks

```sql
SELECT pid, state, client_addr, application_name, backend_start
FROM pg_stat_replication
ORDER BY pid;

SELECT pid, backend_type, state, wait_event_type, wait_event, query
FROM pg_stat_activity
WHERE pid IN (SELECT pid FROM pg_stat_replication)
ORDER BY pid;
```

Expected steady local state is one active source slot for main CDC and one for
reaction CDC, not repeated idle walsenders querying a missing slot.

### 3.5 Verify History Recovery

For history, first verify the outbox rows:

```sql
SELECT id, unitId, sequence, status, attempts, createdAt, processedAt, lastError
FROM "HistoryOutbox"
WHERE status IN ('pending', 'failed', 'processing')
ORDER BY createdAt DESC
LIMIT 50;
```

After Sequin is healthy, new `HistoryOutbox` inserts should create pg-boss
`history.ingest` jobs. Existing pending rows that were created while CDC was
broken may need explicit retry/backfill, because CDC only streams changes seen
from the active replication slot.

---

## 4. Production Environment Runbook

Production should not use the local `source repair --force-active-slot` flow as
a blind fix. Treat source DB changes as a controlled CDC maintenance window.

### 4.1 Before Source DB Migration or Restore

1. Confirm job-runner HTTP and worker roles are healthy.
2. Confirm Sequin source and sink health in the Sequin console.
3. Snapshot source CDC state:

```sql
SELECT slot_name, active, active_pid, restart_lsn, confirmed_flush_lsn,
       wal_status, safe_wal_size
FROM pg_replication_slots
WHERE slot_name = 'rezics_sequin_slot_production';

SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'rezics_sequin_pub_production'
ORDER BY schemaname, tablename;
```

4. Record expected sink destinations and secrets:

```text
Sequin source DB -> publication -> replication slot -> webhook endpoint
job-runner /webhooks/sequin -> pg-boss lanes -> consumers
```

5. Pause writes or plan replay for tables whose changes cannot be reconstructed
from current row state. For Rezics history, `HistoryOutbox` is append-only and
can be retried by row ID if the row still exists.

### 4.2 After Schema Migration

If the source DB is the same physical cluster and the slot still exists:

1. Apply publication changes explicitly:

```sql
ALTER PUBLICATION rezics_sequin_pub_production
ADD TABLE public."NewTable";

ALTER PUBLICATION rezics_sequin_pub_production
DROP TABLE public."OldTable";
```

2. Restart Sequin to reload config if the sink source table list changed.
3. Verify slot activity and delivery.
4. Run targeted backfills only for new tables or newly routed projections.

### 4.3 After Source DB Replacement or Restore

If the source database was restored to a different cluster, recreated, or reset,
assume the old slot is invalid even if Sequin state still contains it.

Recommended production sequence:

```text
1. Stop or pause Sequin source consumers.
2. Ensure source DB has wal_level=logical, sufficient max_replication_slots,
   and sufficient max_wal_senders.
3. Ensure publication exists and tracks the intended table set.
4. Create or reconnect the replication slot through Sequin's managed database
   connection flow.
5. Start Sequin.
6. Confirm webhook delivery to job-runner.
7. Run controlled backfill/retry for missed tables.
```

Do not drop an active production replication slot unless the operational goal
is explicitly to discard its retained WAL position. Dropping a slot can lose
the exact change stream between the old confirmed LSN and the new slot start.

### 4.4 Production Recovery Decision Table

| Symptom | Likely cause | First action | Follow-up |
| --- | --- | --- | --- |
| `HistoryOutbox` pending, no pg-boss job | Sequin did not deliver CDC | Check Sequin source/sink, slot, webhook | Retry/backfill missed rows |
| Slot exists but inactive | Sequin stopped or disconnected | Restart Sequin | Verify `active=true` |
| Slot missing, Sequin state says active | Source DB reset or slot dropped | Stop Sequin, reconcile source DB/Sequin state | Recreate slot, backfill |
| `max_wal_senders` exhausted | Reconnect loop or too few senders | Stop Sequin, clear stale walsenders | Increase sender capacity if needed |
| Webhook 401 | Secret mismatch | Fix `SEQUIN_WEBHOOK_SECRET` | Restart Sequin/job-runner HTTP |
| Webhook retries with 5xx | job-runner handler failure | Inspect job-runner logs | Fix handler, allow retry |
| Slot lag grows | job-runner/sink slow or down | Restore consumer capacity | Consider backpressure/backfill |

---

## 5. Backfill and Replay Guidance

CDC restart does not automatically replay source rows written before the new
slot began. Choose recovery based on data shape:

- `HistoryOutbox`: replay pending/failed rows by enqueueing
  `history.outbox.ingest` jobs or using the existing retry endpoint when
  available. The outbox row is durable and idempotency is by outbox ID.
- Search projections: use existing maintenance rebuild or content sync jobs.
- Ranking projections: use ranking full sync after Meili/search settings are
  valid.
- Tables without append-only outbox semantics: use Sequin backfill or a
  domain-specific rebuild.

For new sink creation, Sequin backfills can seed current rows before live
streaming continues. For already-missed discrete events, a backfill reconstructs
current row state, not necessarily every historical transition.

---

## 6. Source DB Change Checklist

Before merging or running migrations that affect CDC-routed tables:

- Update `package/job/src/sequin/manifest.ts` first when a table becomes routed
  or stops being routed.
- Update `package/job-runner/sequin/sequin.yml`.
- Update `package/job-runner/src/sequin/router.ts` for routing behavior.
- Add or update router tests for the table/action.
- Apply `ALTER PUBLICATION ... ADD/DROP TABLE ...` in environments where the
  publication already exists, because Sequin `init_sql` only covers first
  creation.
- Decide whether a backfill is required.
- Verify job-runner receives at least one test event.

---

## 7. Operational SQL Reference

Publication membership:

```sql
SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'rezics_sequin_pub_development'
ORDER BY schemaname, tablename;
```

Slot status:

```sql
SELECT slot_name, slot_type, database, active, active_pid,
       restart_lsn, confirmed_flush_lsn, wal_status, safe_wal_size
FROM pg_replication_slots
ORDER BY slot_name;
```

Replication connections:

```sql
SELECT pid, state, client_addr, application_name, backend_start
FROM pg_stat_replication
ORDER BY pid;
```

WAL sender related settings:

```sql
SELECT name, setting, pending_restart
FROM pg_settings
WHERE name IN ('wal_level', 'max_replication_slots', 'max_wal_senders')
ORDER BY name;
```

Create a local logical slot manually only when Sequin-managed creation is not
available and the operator accepts the implications:

```sql
SELECT pg_create_logical_replication_slot(
  'rezics_sequin_slot_development',
  'pgoutput'
);
```

Drop a local inactive slot:

```sql
SELECT pg_drop_replication_slot('rezics_sequin_slot_development');
```

---

## 8. Recommendations

1. Keep `bun run service source verify` as the local preflight after any source
   DB reset, schema migration, or Sequin config change.
2. Add a non-following `bun run service logs --tail` or equivalent wrapper so
   agents and humans can inspect recent Sequin logs without starting a long
   tail.
3. Add a dedicated local command for `service restart sequin` to avoid requiring
   raw Docker Compose usage.
4. Add an admin repair operation that can enqueue `history.outbox.ingest` for
   pending `HistoryOutbox` rows, so source CDC outages do not require manual
   pg-boss inserts.
5. In production, document the exact owner of Sequin slot recreation. Do not
   split this between ad hoc SQL and Sequin state unless there is a runbook for
   reconciling both.

---

## 9. References

- Sequin overview: https://sequinstream.com/docs
- Sequin Postgres connection guide: https://sequinstream.com/docs/connect-postgres
- Sequin webhook sink reference: https://sequinstream.com/docs/reference/sinks/webhooks
- Sequin sink overview and delivery behavior:
  https://sequinstream.com/docs/reference/sinks/overview
- Sequin backfills reference: https://sequinstream.com/docs/reference/backfills
- Sequin YAML reference: https://sequinstream.com/docs/reference/sequin-yaml
- PostgreSQL logical replication configuration:
  https://www.postgresql.org/docs/current/logical-replication-config.html
- PostgreSQL replication slot view:
  https://www.postgresql.org/docs/current/view-pg-replication-slots.html
- PostgreSQL publication concepts:
  https://www.postgresql.org/docs/current/logical-replication-publication.html
- PostgreSQL `ALTER PUBLICATION`:
  https://www.postgresql.org/docs/current/sql-alterpublication.html
- PostgreSQL streaming replication protocol:
  https://www.postgresql.org/docs/current/protocol-replication.html
