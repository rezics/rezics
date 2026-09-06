# Email delivery and claim ownership

Authentication writes an outbox intent before acknowledging the request. Only
the delivery worker calls the external provider. Notification email remains
disabled by its policy until preference, unsubscribe and content contracts pass.

Claims lock at most 100 rows using `FOR UPDATE SKIP LOCKED`, first expired leases
through `email_outbox_processing_lease_idx`, then due pending rows through
`email_outbox_pending_idx`. The scans have their own index order and limit; an
OR predicate followed by sorting the whole eligible union is not used. Queue
order is best effort, not strict FIFO among concurrent consumers.

`attempt_count` is the monotonic claim generation. Never reset it on retry or
operator recovery. Acceptance, failure, retry scheduling and renewal require the
same ID, processing status, generation, and an unexpired lease using the database
clock. A failed conditional update aborts the transaction before notification
state can change. The dispatcher renews after rendering and before sending;
each send currently has a 10-second transport timeout inside a 60-second lease.

A process can still stop after external acceptance but before database
acknowledgement. The dispatcher leaves that claim for recovery and records an
outbox processing failure; it does not immediately rewrite it as a provider
rejection. Reclamation can send again: this is at-least-once delivery, without
an exactly-once claim. Provider idempotency and uncertain-send reconciliation
remain separate activation work. Database fencing cannot retract a network
request already in flight.

`scripts/check-email-outbox.ts` exercises the actual writer on a fresh loopback
`rezics_atlas` migration replay. It requires
`REZICS_DISPOSABLE_MIGRATION_FIXTURE=1` and `DATABASE_URL`; it refuses a nonempty
outbox and removes only the fixture IDs it inserted. It proves expiry and
reclamation reject old renewal/completion/failure, acceptance removes sensitive
intent payload, and concurrent claims do not overlap. It never calls a provider.

## Workload and capacity boundary

The initial measurement input is 20 email intents/s and at most 100 in-flight
messages per delivery process (default batch 20), with a separate three-connection
production pool. Two processes during a rollout cap in-flight sends at 200.
An ordinary one-minute lease gives a working estimate of 1,200 active intents
at that rate; an outage can grow this backlog and this is not a proven hard cap.
Every claim increments one existing integer, so this change adds no stored
columns, indexes, or per-message history rows. A successful attempt performs
claim, renewal and acceptance writes; a failed attempt performs claim, optional
renewal and failure/retry writes. WAL amplification must include index maintenance
and full-page images, not only row width.

For 500M / 3B retained terminal rows, an illustrative 160-byte heap row plus
40-byte primary-key entry costs 100 GB / 600 GB before free space, WAL, replicas
and backups. A provider ID index with an illustrative 64-byte entry adds
32 GB / 192 GB when every retained row has a provider ID. These are explicit
estimates pending measured widths; authentication payloads are cleared at terminal
state. At 20 intents/s, unretired history adds 1.728M rows/day (630.72M/year).

Claims depend on the active partial indexes, not the retained terminal corpus;
fenced updates are primary-key lookups. Memory and result transfer are O(batch),
while locked candidates skipped across simultaneous workers add contention work.
The fixed registry has five lanes and ten recurring batches. No growing
source registry or message history is covered by that configuration bound.

Retention, bounded oldest-age monitoring, admission control and time/owner-routed
archival are required before sustained source/notification activation. Stop bulk
admission at P10's disk/latency thresholds and complete archive/partition routing
before the active index or backlog exceeds the measured recovery budget. This
slice does not qualify one deployment for 500M/3B rows or the whole P10 workload.

The 2026-09-06 disposable benchmark used 300,000 rows (100,000 each terminal,
pending and processing), two container CPUs and a 1 GiB memory limit. Both
queries returned 20 rows through their expected partial indexes with no Sort;
each visited 24 shared buffer blocks, with 0.035 ms / 0.023 ms measured execution
time on a warm cache. Sparse fixture row sizes were 104 / 144 / 152 bytes for
accepted / pending / processing respectively; heap and indexes totaled
41,582,592 / 17,416,192 bytes. This is plan/shape evidence, not production latency,
WAL, throughput or target-cardinality qualification. The reproducible command is
`scripts/benchmark-email-outbox.ts` with the same disposable flags; it rolls back
its fixture transaction.

An initial build exposed PostgreSQL package drift from 18.4 to 18.6. The Dockerfile
now pins server/client/development/JIT packages to the base image's `PG_VERSION`
using PGDG's signed archive. The rebuilt image retained PostgreSQL 18.4 and
PGroonga 4.0.8. All 37 migrations and the claim race check passed on that image;
the repeated 300,000-row fixture had the same widths/sizes and index plans
(0.051 ms pending / 0.026 ms expired). These remain local measurements.

Primary references: [PostgreSQL queue locking](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE),
[transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html),
[Better Auth email callbacks](https://better-auth.com/docs/concepts/email).
