# PostgreSQL backup and recovery

REZICS uses [Databasus](https://github.com/databasus/databasus) `v3.51.0` to manage
PostgreSQL 18 logical backups. Databasus owns `pg_dump`, compression, encryption, scheduling,
the backup catalog and UI, Cloudflare R2 transfer, GFS retention, notifications, and scheduled
restore verification. REZICS does not implement another backup format or object-transfer
protocol.

The initial objective is a newest successful, verified off-host recovery point no more than 24
hours old. The retained logical recovery points are 7 daily, 4 weekly, and 12 monthly. A complete
restore into an isolated disposable database runs every week. This is a backup and disaster
recovery design, not high availability or point-in-time recovery.

## Data and responsibility boundaries

The authoritative database is backed up as a complete PostgreSQL custom-format logical archive.
The archive includes extension declarations, tables, authoritative text, rows, sequences,
constraints, functions, and index definitions. It does not include PostgreSQL heap files or
PGroonga physical index files. During restore PostgreSQL recreates all three PGroonga indexes
from `unit_localization` and `unit_alias`.

The components have deliberately narrow ownership:

| Component                            | Responsibility                                                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Databasus `v3.51.0`                  | Backup creation, zstd compression, AES-256-GCM encryption, R2 upload/download, GFS retention, catalog, audit UI, notification, and verification scheduling |
| Databasus verification agent         | Download the selected archive and perform a real restore in a throwaway PostgreSQL container                                                               |
| REZICS `postgres-verification` image | Supply PostgreSQL 18.4, PGroonga 4.0.8, `approx_count` 1.0, and post-restore search acceptance                                                             |
| Cloudflare R2 Terraform              | Dedicated private bucket, disabled public domain, seven-day Bucket Lock floor, Infrequent Access transition, and incomplete multipart cleanup              |
| Nomad Variables                      | Keep the Databasus master key, source read-only database credential, and bucket-scoped R2 credential outside images and jobspec source                     |

The R2 credential must be an account-owned, bucket-scoped **Object Read & Write** token for only
the backup bucket. Databasus needs both directions because the same product uploads archives,
downloads them for restore, and deletes recovery points after GFS expiry. Cloudflare R2 does not
offer a single object credential that can write and delete without also reading. Terraform's
account-level credential is separate and is never installed into Databasus.

Bucket Lock protects every object below `postgresql/databasus/` from deletion or overwrite for
seven days. Databasus remains the only owner of 7-daily/4-weekly/12-monthly selection and
deletion. Do not add an R2 expiry lifecycle to the same prefix: independent time-based deletion
cannot express Databasus's GFS selection. R2 moves objects below this prefix to Infrequent Access
after 30 days and aborts incomplete multipart uploads after one day.

## Deployment

Build and publish two PostgreSQL images from the same commit:

```text
docker build --target postgres ...
docker build --target postgres-verification ...
```

The sibling NixOS repository is the runtime source of truth. It pins the ordinary image in
`hosts/B/jobs/database/rezics-postgres.nomad.hcl` and Databasus in
`hosts/B/jobs/backup/databasus.nomad.hcl`; activate that repository to reconcile the stateful
jobs. Publish the verification target in a repository where its PostgreSQL-major tag `:18`
resolves to the exact ordinary build; this is the repository passed to the Databasus
verification agent. Databasus itself remains
`databasus/databasus:v3.51.0@sha256:<digest>`.

The NixOS host must define a writable `rezics-databasus` host volume. The Databasus allocation
mounts it at `/databasus-data`, advertises port 4005 only on B's WireGuard network, and mounts its
`secret.key` read-only from `rezics-infrastructure/database/databasus-control`. B's firewall
allows that port only on `wg-rezics`; A exposes it to the existing Cloudflare Tunnel through a
socket-activated loopback proxy, so there is no public origin port or idle proxy process. The
independently stored key is sufficient for Databasus's documented manual recovery path even if
its allocation and control database are lost.

Run `install-production-variables.sh` once before the first deployment. Its input has separate
`r2.application` and `r2.backupManager` credentials. It tests both buckets, creates a distinct
read-only PostgreSQL source role, generates the Databasus master key, and stores the values in:

| Namespace               | Path                                    | Consumer                                           |
| ----------------------- | --------------------------------------- | -------------------------------------------------- |
| `rezics`                | `database/operations`                   | Database installation and privilege reconciliation |
| `rezics-infrastructure` | `database/databasus-control`            | Databasus `secret.key` template only               |
| `rezics-infrastructure` | `database/databasus-source`             | One-time Databasus source and R2 setup             |
| `rezics-infrastructure` | `database/databasus-verification-agent` | Verification-agent identity and one-time token     |

Never print a complete Variable or paste its secret items into a ticket, shell history, or
Databasus URL. Access the UI only through the Cloudflare Access-protected operator tunnel.

## One-time Databasus configuration

The setup is intentionally completed in Databasus's UI rather than through an undocumented
internal API. Record the resulting Databasus audit entries and test results in the operations
system.

1. Create the owner account and production workspace. Disable public registration after the
   required operators exist and require a separate account for each operator.
2. Read the `database/databasus-source` Nomad Variable through the operator path. Add one
   Cloudflare R2 storage with its endpoint, bucket, region `auto`, credentials, and immutable
   prefix `postgresql/databasus/authoritative`. Test both upload and download.
3. Add the `rezics` PostgreSQL database as a **logical** PostgreSQL 18 source. Use the supplied
   backup role, never the superuser or application writer. Select the whole database and do not
   exclude extension, schema, or index objects.
4. Enable encrypted daily backups at a quiet UTC time. Select GFS retention with 0 hourly, 7
   daily, 4 weekly, 12 monthly, and 0 yearly slots. Enable failure notifications and at least one
   separately monitored delivery channel.
5. Create a verification agent under Settings, copy its ID and one-time token, and immediately
   pass the token on standard input to `install-databasus-verification-agent.sh`. The sibling
   NixOS repository pins the lightweight runner and the untagged REZICS verification PostgreSQL
   repository and reconciles the agent job.
6. Enable scheduled verification for `rezics` once per week. Enable verification-failure
   notification. Trigger one manual backup and one manual verification before accepting the
   installation.
7. Add Databasus's own loopback PostgreSQL 17 `databasus` database as a second logical source,
   using a read-only user created by Databasus rather than retaining its internal administrator
   credential. Store its encrypted daily backup in a second R2 storage configuration with prefix
   `postgresql/databasus/control` and retain 7 daily and 4 weekly copies. This preserves the UI,
   schedules, encrypted credential records, and backup history; the independently stored
   `secret.key` remains the primary recovery prerequisite.
8. Only after the R2 backup, weekly-style verification, and failure-notification acceptance all
   succeed, run `finalize-databasus-cutover.sh --confirm-verified-managed-backup`. This purges the
   superseded custom Nomad jobs and their uploader/reader Variables without creating a backup
   coverage gap during migration.

The verification agent runs in the foreground under Nomad and mounts the Docker socket because
Databasus creates and destroys the isolated restore containers itself. It is limited to one
concurrent job, 2 CPUs, 4 GiB RAM, and 200 GiB disk by default. Raise the disk budget before the
backup file plus restored raw database plus Databasus's 5 GiB safety allowance can exceed it.

## What a weekly complete isolated restore proves

“Complete isolated restore” means that Databasus downloads the latest encrypted R2 archive,
decrypts it, starts a disposable PostgreSQL 18 container, restores the entire archive, compares
source/restored table counts, reports the result, and destroys the container. It never overwrites
or connects to the primary as a restore target.

The verification repository's `:18` image wraps only `pg_restore`. After the upstream restore
succeeds, the wrapper runs a generated SQL acceptance file. The file takes the canonical index
names from `database/schema/pgroonga.ts` at image-build time and proves:

- PGroonga is exactly 4.0.8 and `approx_count` is exactly 1.0;
- all canonical indexes use PGroonga and are ready and valid;
- metadata, published body, and alias fixture queries each use indexed scoring and return a
  nonzero `pgroonga_score`;
- the fixture transaction rolls back, so the disposable restored database remains unchanged.

This wrapper does not schedule work, handle encryption, read R2, select backups, or implement
retention. Failure exits through Databasus's normal verification result and notification path.

## Monitoring and acceptance

Alert when any of these conditions is true:

- no successful off-host backup exists in the last 24 hours;
- the newest backup has not completed verification inside the weekly schedule;
- backup, retention cleanup, storage connection, notification, or verification fails;
- the backup role loses whole-database read coverage;
- the R2 bucket becomes public, its lock/lifecycle configuration drifts, or its object inventory
  grows without matching Databasus catalog entries;
- verification disk headroom falls below the documented requirement.

The initial installation is accepted only after the UI shows a successful R2 backup, a successful
weekly-style verification using the REZICS image, the expected table-count report, and successful
failure-notification delivery. Record elapsed backup, download, restore, index-build, and total
verification time; their sum is the measured recovery time, not a theoretical estimate.

## Disaster recovery

If Databasus is healthy, use its restore workflow and restore into a new database first. Never
restore directly over `rezics`. Run the normal runtime and search-index checks before switching
writers or readers.

If Databasus itself is unavailable, retrieve the master key from the independent
`database/databasus-control` Variable and follow Databasus's
[manual recovery procedure](https://databasus.com/how-to-recover-without-databasus) for the R2
archive and matching `.metadata` object. Restore with the REZICS PostgreSQL image so PGroonga and
`approx_count` are available. The encrypted control-database backup can reconstruct the UI and
configuration, but it is not required to decrypt or restore the authoritative archive.

Physical `PGDATA`, `pg_basebackup`, WAL-G, pgBackRest, and Barman are outside this v1 logical-only
policy because they carry PGroonga physical index bytes or establish a different physical/PITR
recovery contract. A future point-in-time objective must add a separately reviewed physical
backup design; a replica is not a backup.
