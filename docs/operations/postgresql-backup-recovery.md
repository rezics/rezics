# PostgreSQL backup and recovery

REZICS v1 retains complete PostgreSQL 18 logical archives in a dedicated private Cloudflare R2
bucket. The application asset bucket and its credentials are never used for database backups.
The design targets one completed, verified off-host recovery point every 24 hours and makes no
point-in-time-recovery claim.

## What is backed up

`postgres-logical-backup` runs `pg_dump --format=directory` against the entire authoritative
database. The archive contains schemas, extensions, tables, rows, sequences, constraints, and
index definitions. Logical archives do not contain PostgreSQL heap or index relation files, so
the physical `pgrn*` PGroonga index bytes are absent while all source text in
`unit_localization` remains present.

Each UTC run is classified exactly once: day 1 is monthly, Sunday is weekly, and all other days
are daily. Objects are uploaded to a never-reused prefix, all SHA-256 and TOC checks run first,
and `COMPLETED.json` is uploaded last with an `If-None-Match: *` precondition. A prefix without a
valid completion marker is not a recovery point.

Terraform under `infrastructure/cloudflare/r2` creates the bucket separately, disables its
managed public domain, and intentionally creates no CORS or custom-domain configuration. Bucket
Lock and lifecycle enforce these policy floors:

| Class   | Prefix                | Immutable for | Lifecycle deletion | Storage                    |
| ------- | --------------------- | ------------: | -----------------: | -------------------------- |
| daily   | `postgresql/daily/`   |        8 days |             9 days | Standard                   |
| weekly  | `postgresql/weekly/`  |       35 days |            36 days | Standard                   |
| monthly | `postgresql/monthly/` |      370 days |           371 days | Standard, IA after 30 days |

The R2 uploader token is bucket-scoped Object Read & Write. The restore job has a different,
bucket-scoped read-only token. Neither token may configure or expose the bucket, and the API,
web, workers, and ordinary object-storage workload receive neither token.

## Daily job

`deploy/nomad/postgres-backup.nomad.hcl` runs once per UTC day with overlap prohibited. It uses
the pinned `postgres-backup` image, a mode-0700 allocation staging directory, PostgreSQL 18
client/server version checks, a readable archive TOC, per-file hashes, extension/migration
metadata, conditional R2 writes, and a remote inventory check. Local staging is removed only
after R2 confirms the completion marker. Failed staging is retained for the allocation failure
evidence and never acquires a completion marker.

Operators must alert when the newest valid marker is approaching 24 hours old, a job overlaps or
fails, R2 inventory differs, local staging fills, or the next scheduled start cannot finish
before the RPO target. `BACKUP_JOBS` starts at 2 and may be raised only after foreground latency,
I/O, connections, dump duration, and free-space measurements justify it.

## Weekly complete isolated restore

“Complete isolated restore” means the job downloads the newest complete R2 snapshot, verifies
every archive file, restores the whole logical database into a disposable PostgreSQL 18.4
instance, rebuilds both PGroonga indexes from authoritative rows, runs `ANALYZE`, and verifies
the pinned extension versions and index validity. It never restores over the primary and is given
no production database credential.

`deploy/nomad/postgres-restore-drill.nomad.hcl` provides a weekly disposable sidecar database and
ephemeral disk. The restore script requires the database name `rezics_restore_drill`, rejects an
archive unless exactly the two checked-in PGroonga indexes are excluded from its TOC, restores
everything else with `--exit-on-error --no-owner --no-privileges`, and recreates the indexes from
`services/main/search/pgroonga-indexes.sql`. The allocation and its database storage are destroyed
after the drill.

The job log is operational evidence, but a passing exit alone is not enough for a production RTO
claim. Record download, restore, PGroonga rebuild, `ANALYZE`, verification, peak disk, and total
duration. The measured RTO is their sum. Alert on any failure and retain the previous known-good
recovery points; locked objects cannot and must not be manually cleaned up early.

## Manual maintenance

- Check extensions and indexes: `database-operation.sh search-index check`.
- Rebuild online: `database-operation.sh search-index reindex-concurrently`.
- Rebuild offline/local: `task local:search:rebuild`.
- Trigger a restore drill with Nomad's periodic-job force command after confirming sufficient
  disposable CPU and disk. Never point the restore script at `rezics` or supply production DB
  credentials.

Physical snapshots and `pg_basebackup` include PGroonga index files and are outside this retained
backup design. Streaming replicas may be added later for HA, but replicas are not backups. A
future sub-24-hour/PITR requirement must explicitly add physical base backups (accepting index
bytes) or a separately designed continuous logical archive.
