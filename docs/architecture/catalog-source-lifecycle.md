# Catalog source lifecycle

The source owner registers exact external identities, stores immutable observations,
and records reversible correspondence with independently owned catalog objects.
Provider adapters write native domain structures. An archive or a generic JSON
tree is not evidence that a field has native semantics.

## Identity and authority

`source-record-key.ts` fixes the source identity protocol: SHA-256 over UTF-8
`source + LF + objectType + LF + externalId`, with the first 128 bits represented
as UUIDv8 (version and variant nibbles fixed to `8`). Source and object type have
strict ASCII token grammars excluding LF; the final external ID is exact,
nonempty, well-formed UTF-8 without NUL. It is not Unicode-normalized. The database
checks the derivation. Registration compares the original tuple after its
primary-key lookup and rejects a hash collision instead of aliasing two records.
The natural tuple and ID cannot change. All record lookups know the partition ID.

Mapping identity is `(source_record_id, mapping_key)`, with a unique scoped path.
Owner bindings use this composite key and concrete native foreign keys. A binding
revision stores exactly one checked owner target and its immutable policy state.
Pause, resume and rebind append revisions; rebind leaves adoption paused. Deferred
checks verify that the binding, revision and target agree at commit. A newly
referenced object can be initialized from its own endpoint only while its stored
baseline native revision still matches. Subsequent user edits require review.

The worker commits an acquisition generation before fetching. A completion must
match that generation and its check-plan revision. Late completion records a
superseded check receipt without moving the head. Changed observations publish an
outbox event; identical observations update check metadata. HTTP 404 or a missing
query row is an error, not a tombstone. The exact endpoint's HTTP 410 is handled
as authoritative disappearance. Tombstones preserve canonical objects.

Observation events admit source fan-out tasks through the operational task-intent
owner. Each task handles at most 32 mappings, atomically commits proposal work,
its fan-out cursor, the next task and its terminal receipt, then acknowledges the
broker. Transactions have 25-second total, 10-second statement and 5-second lock
budgets. Applying a proposal rechecks source, binding, policy and native revisions;
the provider's canonical command must advance the actual native revision. A
withdrawal callback is admitted only while that applied native revision remains
current. Whole-record structural update/compensation requires an actual native
command; the lifecycle does not manufacture one or treat a scalar update as full
structural reconciliation.

## Capacity and partitioning

The minimum baseline is 500,000,000 rows **per growing family**, also estimated at
3,000,000,000. These are planning estimates, not measured production row sizes.
Typical source ID text is 36 bytes, path 64 bytes, payload reference 160 bytes;
indexes assume UUID keys with normal B-tree tuple overhead and no extreme bloat.

| Family | Approx. heap plus index bytes/row | 500M rows | 3B rows | Partition key |
| --- | ---: | ---: | ---: | --- |
| Source records | 232 | 116 GB | 696 GB | `id` |
| Snapshots | 536 | 268 GB | 1.61 TB | `source_record_id` |
| Mapping claims | 488 | 244 GB | 1.46 TB | `source_record_id` |
| Owner bindings | 136 | 68 GB | 408 GB | `source_record_id` |
| Binding revisions | 240 | 120 GB | 720 GB | `source_record_id` |
| Proposals | 448 | 224 GB | 1.34 TB | `source_record_id` |
| Subscriptions | 192 | 96 GB | 576 GB | `source_record_id` |
| Check plans | 216 | 108 GB | 648 GB | `routing_bucket` |
| Check receipts / fan-out cursors | 136 | 68 GB | 408 GB | `source_record_id` |

Use 256 initial hash partitions and the source ID as the eventual shard route.
At 3B rows a family averages 11.7M rows per partition; distribution and individual
large-source skew still need measurement. All source-record operations use its
ID; mapping/proposal/history pages use composite keyset indexes. Due plans use a
DB-checked 0..1023 bucket in the primary key, allowing the scheduler's bucket
predicate to prune its partition and use `(bucket,state,next_check_at,record)`.
No operation scans the source corpus or all target history. Hot source fan-out is
serialized per record, with pages of 32; increasing concurrency for unrelated
sources does not increase a single target's authority.

At a daily semantic change fraction of 0.1% and 1.5 mappings per source, 500M
records produce approximately 750K target checks/day (8.7/s average); 3B produce
4.5M/day (52/s). Budget a 10x burst plus retries. Each changed snapshot writes a
snapshot, source head and outbox row; each fan-out page additionally writes its
task intent, cursor, outbox and receipt. Each proposal adds bounded secondary
index maintenance. Measure actual WAL, replication lag and p99 latency before
accepting a workload; do not infer throughput from these row-size calculations.
Operational capacity reservations reject admission when task/outbox/receipt
budgets are exhausted; operators must resolve lag before increasing admission.

Payloads are capped at 8 MB, fetched with a 20-second request deadline and a
25-second total I/O signal extending through S3 upload. Worker concurrency must
include JSON materialization overhead (often several times encoded bytes),
archive/network buffers and database memory; four simultaneous maximum-sized
objects can use several hundred MB. Keep the existing worker concurrency limit
and measure RSS before increasing it. Large dumps must stream bounded records.

Provider request admission is a separate, strictly bounded three-row PostgreSQL
control table. It coordinates all replicas and defaults to at least 1.1 seconds
between admissions per provider. MusicBrainz's public web service requires at
most one request per second. [MusicBrainz rate limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)
A 500M-record refresh at one request/second would take about 5,787 days, and 3B
about 34,722 days. Therefore direct API checks are bounded enrichment, not a
full-corpus refresh solution. Eligible bulk snapshots/replication and their
manifests are still needed for source-wide freshness. Private acquisition scopes
are not admitted to the current public shared-check plan.

PostgreSQL unique constraints on a partitioned relation must include its partition
key. The checked natural ID and composite mapping/check-plan keys satisfy that
requirement. [PostgreSQL partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)
Partition creation must run before `catalog-source-integrity.sql`; rerun its
constraint-trigger installation when adding leaves. Payload retention and rights
withdrawal must delete/restrict applicable archive copies separately while keeping
only permissible immutable audit metadata. Old revisions cannot be removed while
referenced by current bindings or review evidence.
