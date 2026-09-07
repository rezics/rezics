# Event worker runtime and local qualification

`src/event-worker.ts` is an independent Bun process. It does not share the email
worker's process or database pool. Source owners register exact event/task kinds;
messages cannot supply SQL, executable code, URLs, consumer names or authority.
The source acquisition owner separately selects allowed provider endpoints.

The preferred relay is Debezium Server 3.6.2.Final. Its real offset, partition-root,
restart and lost-publication-ACK qualification is recorded in
[debezium-qualification.md](debezium-qualification.md). `EVENT_WORKER_RELAY=external`
is the default. `sql` explicitly selects the bounded fallback, using the same
immutable outbox and stable publication IDs. Never run both relay modes merely
to improve throughput: both will publish the same records, even though receipts
and broker deduplication make their repeats safe.

## Configuration and lifecycle

Required environment: `DATABASE_URL`, `NATS_URL`, `EVENT_WORKER_BUCKETS` (explicit
comma-separated bucket assignment), `EVENT_WORKER_STREAM_BYTES`, and
`EVENT_WORKER_STREAM_MESSAGES`. Optional: `EVENT_WORKER_EPOCH=1`,
`EVENT_WORKER_DEPLOYMENT=qualification`, `EVENT_WORKER_RELAY=external`,
`EVENT_WORKER_HEALTH_HOST=127.0.0.1`, `EVENT_WORKER_HEALTH_PORT=3032`, and
`EVENT_WORKER_POLL_MS=250`. Production requests three broker replicas and a TLS
NATS endpoint; qualification requests one. Operator credentials, CA trust and
broker permissions must be provisioned by the deployment owner.

Each process has an eight-connection PostgreSQL pool, 5-second connection timeout,
10-second statement timeout, at most 16 assigned buckets, and at most 128 lanes.
Each consumer fetches 32 bounded envelopes and starts four handlers. There is no
corpus-sized in-memory schedule. `/health/live` answers process liveness and
`/health/ready` requires every registered lane to have completed successfully
within 60 seconds. Failure names are reported without exception content or raw
source payloads. Failure retries back off to 30 seconds and abort interrupts the
sleep. SIGINT/SIGTERM stop fetching, drain started work, then close broker, health
listener and pool. Domain handlers must honor their cancellation signal and
transaction/network deadlines.

Broker `max_deliver=-1` deliberately differs from the finite application budget
of ten deliveries. A crash on the tenth delivery, unavailable receipt storage,
or a lost ACK must not strand a message beyond broker redelivery. Every delivery
at or above the application limit can still persist a terminal failure before
ACK. Exact admitted tasks additionally have persisted attempt/deadline caps and
fencing. Busy/lease-lost work is left untouched. Storage failure makes its lane
unready and backs off; it never ACKs unrecorded work. The retained broker queue is
bounded by configured bytes/messages and admission rejects new work at capacity.
An indefinite outage can retry indefinitely in time; it does not allocate an
unbounded queue or bypass the persisted execution budget.

## Source execution chain

The process runs one due-plan scheduler lane per assigned bucket. Each scheduler
transaction claims up to four plans and admits their source-check task intents
and outbox records atomically. It performs no provider I/O. NATS delivers those
ready tasks to `catalog-source-checks-v1`; the handler first claims the task,
rechecks the exact source generation, plan revision and active subscription,
then acquires the provider outside any database transaction. The final transaction
commits the source-check outcome, observation/outbox and terminal task receipt
together under both task and acquisition fences. The task allows three execution
attempts and has a 110-second deadline. A paused subscription cancels pending
execution before fetching; a lost ACK finds the terminal receipt and does not
repeat acquisition.

The source owner maps reviewed VNDB, MusicBrainz and Bangumi endpoints. It also
consumes observed events into admitted fan-out tasks, each updating at most 32
mapping claims before committing its cursor, next task and receipt. It never
places an unbounded mapping list in a message. Its native proposal/adoption
commands retain their own target/binding/policy authority checks.

Normal backend storage configuration is also required by the source archive owner;
the worker-specific environment does not replace that owner's credentials. Provider
rate limits must be enforced across worker replicas, not inferred from per-process
concurrency. Raw acquisition bodies are bounded to 8 MB; 16 assigned buckets with
four simultaneous source handlers can hold up to 512 MB of body bytes before
concatenation, JSON decoding, archive copies and network buffers. Budget at least
those additional copies and reduce the bucket assignment before memory pressure;
these upper bounds are not a measured deployment memory promise.

## Relay, failure and retention authority

The SQL relay reads at most four pending envelopes per route in one transaction,
with `FOR UPDATE SKIP LOCKED`, and waits concurrently for four publication ACKs.
The pending index begins with bucket/class/epoch and then created time/UUID; the
outbox join is its exact composite primary key. A row is removed only after ACK.
A lost ACK, failed commit, or relay death retains the row for stable-ID replay.
There is no timestamp or sequence watermark that can skip a late-committing
transaction. Unpublished transport rows are not executable-task scheduling.

The insert trigger installs a pending row in the outbox transaction. Existing
history must be backfilled through `backfillRelayPage` after installing the
trigger: its explicit UUID cursor visits at most 100 rows and preserves message
IDs. Run this only for an operator-reviewed relay cutover/replay, not periodically;
restarting it at the beginning republishes already delivered history. New inserts
are captured by the trigger regardless of the backfill cursor.

Malformed deliveries write a bounded failure receipt keyed by stream/consumer/
sequence and body SHA-256, without retaining hostile bodies. Valid exhausted tasks
are resolved through the task owner's exact fingerprint, fence and terminal
receipt. A spoofed task fingerprint cannot terminate a different operation.

A consumer checkpoint records the stream creation identity, routing epoch and
contiguous ACK floor. When a consumer has no pending/unacknowledged messages its
checkpoint can advance through irrelevant subject gaps to the stream head. A
retained floor crossing the persisted checkpoint or stream recreation records
`replay_required` before throwing. This is conservative: prolonged downtime can
require a rebuild even when only unrelated messages expired. It never silently
skips a possibly lost business event. Checkpoint slots are deterministic and
unique within 64 slots per bucket/family; a hash collision fails closed instead
of overwriting another consumer. This bounds the table to 131,072 rows, including
old consumer generations.

Destructive outbox/receipt cleanup remains disabled. Neither broker ACK nor its
current retained log proves that every required business generation can rebuild.
Credits remain charged until an owner-approved archival/rebuild frontier and
revocation-aware cleanup are implemented. Exhausting finite credits stops new
admission; it does not delete the sole durable recovery copy. An external
Debezium relay does not delete SQL fallback pending rows. Before admitting a
long-running deployment, reserve this retained copy too and qualify its cleanup
with connector offsets; do not claim this initial retention gate is automatic GC.

## Workload and scale

For 500M/3B catalog objects, two bindings/object, 1% daily changes and six transport
messages/change imply approximately 694/4,167 messages/s. Source fetches are
coalesced separately. At 1 KiB/message, 72-hour R3 event storage is approximately
553 GB/3.32 TB before index, broker, WAL, backup and task retention costs.
Every additional independent consumer adds about 0.71/4.27 MB/s before framing.
A stalled SQL relay adds one indexed pending row per retained outbox envelope;
its admission charge is included in the existing 2,048-byte outbox overhead
reserve, in addition to serialized body plus JSONB widths.

The 12,000-row same-bucket fixture measured 2,637,824 bytes for the pending heap
and two indexes (219.8 bytes/row). Linear storage-only estimates are 109.9 GB at
500M rows and 659.4 GB at 3B, excluding vacuum churn, replicas and free space.
This is not a throughput extrapolation. The four-row relay query used its
selective index and four partition-local outbox primary-key lookups, touched 26
shared buffers, and executed in 0.209 ms on the local warmed fixture. At target
cardinalities, each lookup remains index-bounded; 64 bucket-range partitions
allow owner-first pruning and operational relocation. Hot-bucket throughput is
limited by its stream leader, outbox admission-row lock and storage IO. Multiple
workers may share a bucket via SKIP LOCKED, but do not remove those limits.

The theoretical four-publication batch at 250 ms idle delay is not a production
rate guarantee. Measure publish latency, catch-up, pool wait, fsync and retained
credits before assigning enough buckets to achieve the desired rate. Investigate
at 70% storage/credit occupancy and expand before the larger of 30% free capacity
or measured restore/WAL/rebuild reserve is consumed. Partition/stream assignment
is explicit; shard or relocate whole buckets before a hot leader or disk becomes
the limiting resource. R3 fault domains, quorum loss, disk failures, WAL pressure
and 1k/5k/10k mixed-load SLOs remain unqualified.

## Deterministic evidence

`check-event-runtime.ts` requires explicit disposable loopback PostgreSQL database
`rezics_atlas_runtime` and a loopback NATS endpoint. It creates only fresh target
operational tables and removes its streams. It proves lost-publication-ACK
recovery, committed-effect deduplication after consumer ACK loss, terminal fencing
on exhausted delivery, idempotent quarantine, persisted replay-required state,
and the skewed relay index plan. It does not reset any existing development DB.

`check-source-check-runtime.ts` runs four real PostgreSQL/NATS checks with a synthetic
provider callback: atomic due-plan/task admission, source/task receipt commit after
delivery, no repeated acquisition after a lost ACK, and cancellation before I/O
when a subscription is paused. Its isolated schema keeps the source scheduling
owner dependencies and does not claim full native catalog or provider acceptance.

Focused unit checks cover strict configuration, quarantine identities, interrupted
shutdown backoff, transport parsing, ACK/commit ordering and attempt handling.
The local evidence is PostgreSQL 18, Bun 1.4.0 and NATS 2.14.6 with R1/file storage
and `sync_interval: always`; it is not production HA or source semantic acceptance.

Primary references: [JetStream consumer semantics](https://docs.nats.io/nats-concepts/jetstream/consumers),
[official Node/Bun transport](https://github.com/nats-io/nats.js/tree/main/transport-node),
and [Bun process signals](https://bun.sh/guides/process/ctrl-c).
