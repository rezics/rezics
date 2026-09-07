# PostgreSQL operational durability

Status: implemented and checked against disposable PostgreSQL on 2026-09-07.
Production capacity, relay checkpoint cleanup and business-owner adoption are
separate qualification work. No ordinary development data is changed by the checks.

## Authority and commit boundary

`durability.ts` imports the transport envelope parser. The outbox stores its exact
serialized envelope (at most 65,536 UTF-8 bytes) and an equal JSONB value for CDC;
JSONB whitespace/representation expansion is charged separately. SQL requires
non-null matching message ID, class, kind, route, aggregate key and occurrence
instant, the derived broker subject, and the same SHA-256 owner/key bucket as
transport. These are routing checks, not native owner existence or authorization.
No table references a global Unit parent.

All writers require an explicit `DatabaseTransaction`; passing the pooled root
executor also fails at runtime. Admission, outbox batches, event application and
task completion use savepoints, so catching an error inside the surrounding
transaction cannot commit their partial writes. The outer transaction must commit
before the consumer acknowledges its delivery. Return values inside a transaction
callback are not evidence that its later commit succeeded.

Task identity is `(routingBucket, operationId)`, with immutable consumer purpose,
request fingerprint, source envelope, attempt budget and deadline. Fingerprints
hash canonically ordered kind, aggregate, payload and routing bucket. The task
payload includes operation ID, consumer key, maximum attempts and deadline.
Transport message ID, routing epoch, occurrence time and correlation metadata are
excluded, so explicit republishing preserves business identity. Republish uses a
new outbox message ID with the original semantic operation, while lost-ACK relay
retry resends the original message. Reusing an admitted operation for changed
business semantics fails. A deliberately new attempt after terminal failure needs
a new operation ID linked by its business owner; terminal rows cannot be reset.

Claim, renew, retry and complete address exactly one delivered operation. There
is no ready-task polling query or ready-state index. A claim increments a bigint
generation and attempt count. Renew/complete/retry require matching identity,
generation, running state and an unexpired database-clock lease and deadline.
Completion locks the task, invokes only local transactional business work, then
checks the fence again before writing its terminal receipt. Business callbacks
must validate current authorization, revisions and cancellation state. External
effects require provider idempotency or uncertain-result reconciliation; they
cannot be made atomic by this database wrapper.

`OperationalLeaseLost` means no ACK or terminal disposal. Consumer adapters must
translate it to transport's `lease_lost` outcome. A committed retained receipt
permits duplicate ACK. Consumer keys include output generation for rebuilds.
Broker delivery exhaustion needs a durable terminal disposition through the
same fenced API; merely setting MaxDeliver does not finish a task.

## Admission and retained storage

Provision explicit rows in `operational_capacity` before enabling a producer.
Absent rows fail closed with PostgreSQL SQLSTATE `53000`. The allowed keys are
1,024 buckets times four lanes: `event-outbox`, `task-outbox`, `task-intent`, and
`receipt`, so this control table has a proven maximum of 4,096 rows. There are no
automatic production budgets. The disposable harness uses 100,000 rows and
1,000,000,000 charged bytes for its one exercised bucket/lane.

AFTER INSERT triggers reserve capacity transactionally, including direct SQL
inserts. Conflicting inserts that do nothing do not consume credits. Charges are
one outbox row plus serialized and expanded JSONB bytes plus 2,048 bytes, or
2,048 bytes per intent/receipt row. Task admission reserves its terminal receipt
in advance, so a full ordinary lane cannot prevent an admitted task from
completing. Credits represent conservative logical storage admission, not an
estimate of WAL, backups, vacuum debt or filesystem free space.

Limits per task are 32 attempts and a deadline within seven days of admission;
leases are at most five minutes and retry delay at most fifteen minutes.
Outbox calls accept at most 100 messages / 1 MiB. Cross-bucket entries in one
call sort by bucket, class and message ID. Owners composing several calls still
need deterministic lock order or retry the entire transaction on deadlock; a
transaction must never emit network effects before retrying.

All credits count retained rows, including terminal history. There is deliberately
no credit release or age-based cleanup yet. At the configured cap producers stop
until a qualified maintenance/capacity change occurs. The intent-origin FK and
receipt-intent FK couple retention; removing an outbox before dependent retained
tasks is not legal. Cleanup requires a commit-order-safe connector checkpoint,
replay/receipt horizon and archive/erasure policy. A maximum UUID or creation
timestamp is not a commit watermark. Do not remove receipts while a historical
event can still be replayed into the same consumer generation.

## Partitioning and capacity model

Every corpus relation has 64 actual RANGE partitions over immutable buckets
0..1023, 16 buckets each; primary and foreign keys include routing bucket.
The typed exporter owns columns/constraints and the narrow partition transform
owns parent placement. Atlas Community inspected the parent `PARTITION BY` but
omitted children in the local experiment. Therefore the forward migration has a
physical-partition post-overlay, and `check-operational-partitions.ts` checks all
192 child names, ranges and parent partition keys separately from Atlas drift.

Uniform distribution yields 7,812,500 rows per partition at 500M rows and
46,875,000 at 3B, or 488,281 / 2,929,688 rows per logical bucket. A hot aggregate
still serializes within one bucket. Control counters and row locks are potential
hotspots; more broker replicas cannot cure that contention.

Planning inputs (not measured throughput): 1,000 / 5,000 / 10,000 arrivals per
second, average compact envelope 1 KiB, p99 tested against the 64 KiB bound,
one task receipt per intent and one receipt per independent event consumer.
Three purposes therefore cost three event receipts. At 10k/s uniformly spread,
one bucket sees about 9.8 arrivals/s; 20% skew to one bucket instead causes
2,000/s on that lane counter. Measure that serial contention before admission.
One task admission performs outbox and intent inserts, three credit updates,
FK checks, and PK index writes; terminal completion updates the task and inserts
its prepaid receipt. Each independent consumer adds its own receipt/index/WAL.

Illustrative row-plus-PK allowances:

| Relation | Assumed bytes/row incl. PK | 500M rows | 3B rows |
| --- | ---: | ---: | ---: |
| Outbox with both envelope representations | 2,800 | 1.40 TB | 8.40 TB |
| Task intent | 512 | 256 GB | 1.536 TB |
| Application receipt, per consumer purpose | 384 | 192 GB | 1.152 TB |

These decimal figures exclude WAL, replica copies, backup/restore workspace,
TOAST/index bloat and free-space reserve. Admission uses the larger fixed
charges rather than claiming these average assumptions are hard disk bounds.
The tiny fixture measured mean tuple sizes around 1,051 / 205 / 171 bytes for
its much smaller envelopes, which does not validate the 1 KiB workload or the
capacity table. Keep at least the larger of 30% free space or measured
restore/rebuild/WAL reserve; investigate at 70% resource utilization.

All request operations prune by bucket and use a complete primary key: memory,
network payload and touched rows remain bounded, while B-tree cost grows with
partition cardinality. Workers must bound pool size, concurrent deliveries and
retry queues independently. The harness uses eight connections; this is not a
production concurrency recommendation. Parent P10 targets remain p95 <=400ms /
p99 <=1.2s for foreground paths; no operational throughput SLO is certified here.

Before one host reaches disk, write-IOPS, vacuum/WAL or hot-bucket limits, move
whole bucket ranges and their outbox/intents/receipts together. The explicit
cutover is: stop admission for selected buckets, fence/drain their workers,
checkpoint retained broker and connector progress, copy and verify the three
co-located relations and capacity counters, publish a new placement epoch, then
resume. Do not activate old and new database ownership concurrently. Cross-host
placement and that cutover executor are not implemented by this slice; the
finite admission cap is its current safe limit. The 500M/3B formulas establish
key compatibility and required resources, not approval to deploy at that size.

## Checks and research

The dedicated loopback `rezics_atlas_durability` harness creates only its own
four-table schema and effect fixture. It covers concurrent identical admission,
eight-way claim and receipt races, lease expiry/reclamation, stale completion and
retry, mutation expiry with caught savepoint rollback, finite attempts, deferred
retry, rollback of storage credits, terminal completion with full lanes, immutable
records, missing envelope fields, subject mismatch and mismatched task origin.
The exact-key EXPLAIN pruned to one PK index scan with three shared buffer hits
in the tiny fixture. That is query-shape/race evidence, not a large-data benchmark.

Primary references consulted:
[PostgreSQL partition keys and uniqueness](https://www.postgresql.org/docs/18/ddl-partitioning.html),
[transaction isolation and concurrent updates](https://www.postgresql.org/docs/current/transaction-iso.html),
[Atlas partition support](https://atlasgo.io/blog/2025/07/21/v036-snowflake-postgres-partitions-and-azure-devops).
Actual local Atlas inspection determined the required child overlay.
