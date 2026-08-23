# VNDB v11 Phase 0 capacity and cutover record

Status: **FAIL / PENDING** on 2026-08-23. This record is the Phase 0 gate for
the Entity/Tag delivery. The storage-layout evidence supports the co-located
contract, but the latest 64-writer synthetic hot-key run breached the 150 ms
mutation target and did not exercise the migrated trigger/FK/admission path.
The migration gate remains closed until the real-schema benchmark described
below satisfies every acceptance threshold. Production telemetry must still
replace these local measurements before deployment.

## Sources and reproducibility

The source distribution comes from the official
[VNDB database dump](https://vndb.org/d14), timestamp
`2026-08-23 08:00:10+00`. The dump contained 1,861,867 `tags_vn` judgment
rows, 1,004,400 distinct VN–Tag relationships, 60,340 VNs, 2,909 used Tags,
and 8,218 voting users. The public [VNDB schema](https://query.vndb.org/schema)
was used only to corroborate live relation cardinalities; the dump, rather
than the query service, supplied the benchmark distribution.

Run the guarded fixture against only the disposable migration-test database:

```powershell
$env:VNDB_V11_CAPACITY_DISPOSABLE = "vndb-v11-capacity-v1"
$env:DATABASE_ADMIN_URL = "postgres://postgres:postgres@localhost:5433/rezics_atlas?sslmode=disable"
yarn exec tsx scripts/benchmark-vndb-v11-capacity.ts --yes --rows 1000000 --samples 128 --output ../../.temp/vndb-v11-capacity-output.json
```

The harness accepts only a `postgres` or `postgresql` URL whose authority is
exactly `localhost`, `127.0.0.1`, or `::1` and whose database path is exactly
`rezics_atlas`. It checks both the parsed URL and node-postgres's resolved
target, so a query option such as `?host=...` cannot override the guarded
loopback authority. It also refuses fewer or more than 1,000,000 logical
judgments, owns only the `vndb_v11_capacity` schema, validates database
results at runtime, and requires the intended named indexes in every recorded
plan. The measured runtime was PostgreSQL 18.4 with 128 MiB
`shared_buffers` and 4 MiB `work_mem`.

## Workload and source skew

The capacity baseline applies independently to every VNDB-v11 relation that
can grow with Units, Tags, Paths, Realms, Profiles, or associations:

- 500,000,000 rows is the minimum capacity-planning point and 3,000,000,000
  rows is the partition/shard estimate.
- The existing vote-governance targets remain 20,000 community writes/s,
  100,000 reads/s, warm service p95 below 100 ms for bounded lists, and
  mutation p95 below 150 ms.
- Reads are equality lookups, keyset pages of at most 50, bounded hierarchy
  joins, and bounded per-target aggregates. No request scans or sorts a
  corpus relation.
- Quick-add Path length `L` is at most 16 and is normally 2–4. A fresh positive
  global Path application mutates one application, one judgment, one
  application aggregate, and `L` rows in each of support provenance, effective
  Tag, effective Profile vote, and Tag aggregate: exactly `3 + 4L` focused
  heap rows under the intended single-refresh trigger ownership. The formula
  excludes revision-history writes and the removed duplicate/no-op aggregate
  refresh defect.
- The official dump has 61.2% fit-only judgment rows and 33.8% rows in which
  fit and spoiler evidence overlap. VNDB has no spoiler-only application
  row, so the fixture reserves a deliberately adverse 5.0% spoiler-only
  product population.
- Source judgments per relationship were p50 1, p90 3, p95 5, p99 12,
  p99.9 about 41, and max 111. Spoiler judgments were p50 0, p90 1, p95 2,
  p99 5, p99.9 17, and max 74.
- Source rows per Tag were p50 184, p90 1,442, p95 2,391, p99 6,757,
  p99.9 23,068, and max 53,507. Rows per VN were p50 10, p90 63, p95 106,
  p99 321, p99.9 1,441, and max 10,104. Rows per Profile were p50 12,
  p90 213, p95 588, p99 3,715, p99.9 22,791, and max 59,423.
- The fixture preserves the 61.2/33.8/5.0 overlap and adds a long relationship
  tail. A separate single-aggregate contention tier is deliberately more
  adversarial than the source maximum.

These are implementation and procurement assumptions, not claims about
production traffic. Production telemetry replaces rates and latency values,
but cannot weaken the bounded access shapes.

## Co-located versus split judgment decision

The accepted sparse row stores nullable `fit_vote` and
`spoiler_level` with independent timestamps and requires at least one
dimension. The representative fixture produced exactly 612,000 fit-only,
338,000 combined, and 50,000 spoiler-only rows.

| Layout at 1M logical judgments | Heap + indexes | Bytes/logical judgment | Initial-load WAL | Load time |
| --- | ---: | ---: | ---: | ---: |
| Co-located sparse row | 333,684,736 B | 333.685 B | 591,541,672 B | 10.610 s |
| Split fit + spoiler tables | 435,298,304 B | 435.298 B | 714,874,880 B | 8.289 s |

Co-location uses 23.34% less heap-plus-index storage and 17.25% less WAL.
The split load reads the already-built co-located relation and is therefore
not an equivalent ingest benchmark; its shorter elapsed time does not offset
the permanent extra relation/index footprint or the two-read/two-write
application path. **Decision: keep the co-located sparse layout** for
`unit_tag_judgment`, `unit_structure_application_judgment`,
`realm_tag_judgment`, and
`realm_structure_application_judgment`. `unit_structure_vote` and
`realm_structure_vote` remain fit-only definition votes.

At 500M logical judgments the measured co-located shape is 155.38 GiB versus
202.70 GiB split. At 3B it is 932.30 GiB versus 1,216.20 GiB split, before
free-space headroom, replicas, backups, or WAL retention.

## Physical storage projections

The measurements include heap, TOAST, primary keys, and the secondary indexes
required by the proposed access paths. Values below exclude the mandatory 30%
operating headroom, WAL retention, replicas, backups, and space for concurrent
index builds.

| Measured shape | Applies to | B/row | 500M | 3B |
| --- | --- | ---: | ---: | ---: |
| co-located global judgment | both global application judgment tables | 333.69 | 155.38 GiB | 932.30 GiB |
| Realm application judgment | both Realm application judgment tables | 417.43 | 194.38 GiB | 1,166.29 GiB |
| global definition vote | `unit_structure_vote` | 219.86 | 102.38 GiB | 614.27 GiB |
| Realm definition vote | `realm_structure_vote` | 271.93 | 126.63 GiB | 759.77 GiB |
| association spoiler judgment | `subject_association_judgment` | 220.47 | 102.66 GiB | 615.99 GiB |
| global structure support | `unit_tag_structure_support` | 300.11 | 139.75 GiB | 838.51 GiB |
| Realm structure support | Realm support provenance | 366.00 | 170.43 GiB | 1,022.60 GiB |
| global effective projection | `unit_effective_tag` | 217.92 | 101.48 GiB | 608.87 GiB |
| Realm effective projection | `realm_unit_effective_tag` | 269.64 | 125.56 GiB | 753.36 GiB |
| ends-at inverse | accepted Path ending index | 167.35 | 77.93 GiB | 467.58 GiB |
| primary display Path | one selected Path per Tag | 173.54 | 80.81 GiB | 484.86 GiB |
| Entity measurement | canonical/contextual measurement facts | 286.30 | 133.32 GiB | 799.92 GiB |

The following required relations use conservative measured proxies until
post-migration measurements replace them:

| Relation | Cardinality and bound | Planning proxy |
| --- | --- | --- |
| `unit_tag` and `unit_structure_application` | one candidate per exact Unit/target pair; unbounded history | global effective projection |
| `unit_structure` and `realm_structure` | one immutable definition/adoption; corpus-scale | global/Realm definition-vote shape |
| `unit_structure_member` | exactly `L <= 16` per definition | ends-at inverse |
| `unit_structure_edge` | exactly `L - 1 <= 15` per definition | global definition-vote shape |
| `unit_effective_tag_vote` | one effective Profile judgment per Unit/Tag | global support shape, conservatively retaining an extra UUID |
| Realm effective viewer judgment | one per Realm/Unit/Tag/Profile | Realm support shape |
| `tag` vocabulary | corpus-scale; two policy columns add no fan-out | the established 480 B/row indexed-vocabulary/reference budget |
| Entity measurements | max one canonical plus eight contextual rows per Entity | measured measurement shape; 500M rows implies at least 55.6M Entities and 3B implies at least 333.3M |

A cold application creates `3 + 4L` heap rows and approximately `6 + 8L`
B-tree entries across these seven row families. In the adverse no-overlap
envelope, each of the four `L`-scaled relations reaches the corpus planning
threshold after far fewer fresh applications:

| Path length | Applications at 500M rows/relation | Applications at 3B rows/relation |
| ---: | ---: | ---: |
| 2 | 250,000,000 | 1,500,000,000 |
| 4 | 125,000,000 | 750,000,000 |
| 16 | 31,250,000 | 187,500,000 |

Effective Tags, votes, and aggregates can deduplicate across overlapping
Paths, but support provenance cannot assume that reduction. Partition and
shard gates therefore use each derived relation's live cardinality and growth
rate, not the smaller application count.

At 500M rows, one measured corpus relation therefore needs 77.93–194.38 GiB
before headroom. With 30% headroom the range is 101.31–252.69 GiB. At 3B,
the Realm judgment shape alone needs about 1.14 TiB raw and 1.48 TiB with
headroom. A two-replica topology triples resident heap/index storage; backups,
WAL retention, and concurrent index construction are additional capacity.

## Read plans, memory, and network

All measured request shapes used named B-tree indexes with no rows removed by
filter:

| Operation | Chosen index | Execution | Shared blocks |
| --- | --- | ---: | ---: |
| co-located aggregate | `co_judgment_target_idx` | 0.182 ms | 28 read |
| viewer judgment | `co_judgment_profile_idx` | 0.058 ms | 1 hit + 3 read |
| split fit aggregate | `split_fit_judgment_target_idx` | 0.151 ms | 28 read |
| split spoiler aggregate | `split_spoiler_judgment_target_idx` | 0.041 ms | 4 read |
| target keyset browse | `co_judgment_target_idx` | 0.317 ms | 28 hit + 25 read |
| Paths ending at Tag | `structure_ends_at_tag_idx` | 0.298 ms | 53 read |

This validates complexity and index selection, not 3B-row latency. Index depth,
cache pressure, and storage IOPS must be load-tested per physical
partition/shard. Each request retains at most a page of 50 rows, one viewer
row, a bounded `L <= 16` breadcrumb, or a bounded aggregate input; no
corpus result is loaded into process memory. The fixture passed with 4 MiB
`work_mem`.

Co-located load WAL was 591.54 B/logical judgment. At 20,000 new judgments/s,
that is about 11.83 MB/s of primary WAL and the same network stream per
physical replica before protocol overhead. The split layout would be
14.30 MB/s. Two streaming replicas therefore consume at least 23.66 MB/s
versus 28.59 MB/s of replication network for those facts alone.

## Quick-add amplification and concurrency

| Path length | Row mutations/add | Mean elapsed/add | WAL/add | WAL/row mutation |
| ---: | ---: | ---: | ---: | ---: |
| 2 | 11 | 7.783 ms | 6,353 B | 577.500 B |
| 4 | 19 | 10.848 ms | 8,448 B | 444.632 B |
| 16 | 67 | 12.147 ms | 27,456 B | 409.791 B |

These are 128-sample cold-projection measurements on an isolated fresh
PostgreSQL 18.4 container. WAL covers the full heap and production-shaped
index fan-out under intended single-refresh ownership. Elapsed time includes
one local transaction with explicit set-based writes; it excludes production
trigger rescans, advisory-lock waits, revision history, and the removed
duplicate/no-op aggregate refresh defect, so it is not a production latency or
throughput claim.

If all 20,000 community writes/s were fresh quick adds, primary WAL would be
about 127.06 MB/s at `L=2`, 168.96 MB/s at `L=4`, and 549.12 MB/s at
`L=16`, before checkpoint variability and protocol overhead. Two streaming
replicas would require about 254.12 MB/s, 337.92 MB/s, and 1,098.24 MB/s of
replication network respectively. The 20,000 writes/s planning rate is
therefore not a quick-add admission guarantee. API quotas, the database pool,
and a bounded queue must cap quick adds to the approved primary-WAL budget and
the slowest replica's replay/network budget; no caller may create an unbounded
retry or projection queue.

All contention samples updated one aggregate key and inserted distinct fact
rows, with a 1.5 s statement timeout:

| Concurrent writers | Global p50 / p95 / p99 / max | Realm p50 / p95 / p99 / max | Timeouts |
| ---: | --- | --- | ---: |
| 1 | 2.482 / 3.743 / 4.369 / 6.952 ms | 2.664 / 3.618 / 4.523 / 6.495 ms | 0 |
| 16 | 15.642 / 46.933 / 78.902 / 89.716 ms | 13.868 / 49.030 / 71.864 / 98.600 ms | 0 |
| 64 | 62.871 / 188.456 / 194.612 / 196.424 ms | 59.122 / 154.579 / 167.135 / 170.496 ms | 0 |

The 64-writer p95 exceeds the 150 ms service mutation target for both global
and Realm writes. This synthetic row-lock design therefore fails the Phase 0
implementation gate. It is shape evidence only and cannot accept the intended
synchronous design. The source maximum of 111 facts/relationship is not
evidence for simultaneous writers. The replacement must be measured through
the migrated tables, foreign keys, triggers, deterministic fail-fast admission,
and bounded service retry behavior at 64 workers for global and Realm Paths of
length 2, 4, and 16. For every key, the measured run must record attempted,
committed, backpressured, and unexpected outcomes; sustain at least 100
successful commits/s; keep terminal all-attempt p95 below 150 ms and lock-wait
p95 below 25 ms; keep pool utilization below 80%; produce no deadlocks or
timeouts; and prove exact fact/aggregate/projection parity with no partial
writes. The existing
asynchronous threshold remains binding: cut over if for five minutes one
target sustains 100 writes/s, aggregate lock-wait p95 exceeds 25 ms, mutation
p95 exceeds 150 ms with pool use above 80%, or WAL/replica lag breaches its
SLO. The cutover is the partitioned, idempotent vote-event outbox and
watermarked micro-batch reducer in
[vote-and-reference-governance.md](./vote-and-reference-governance.md).

## Partition, projection, and maintenance path

Logical keys make every hot and recurring cost partitionable:

- global judgments, candidates, supports, effective rows, measurements, and
  hierarchy projections route by `unit_id`, `entity_id`, or owning
  `structure_id`;
- definition votes route with `structure_id`;
- association judgments route with `association_id`;
- Realm facts route by `hash(realm_id, unit_id)`, keeping one Realm/Unit
  authority decision co-located;
- primary display rows route by `tag_id`; and
- ends-at reads route by `final_tag_id`. Global Structure IDs remain
  application-generated and an idempotent reconciliation job detects the
  cross-partition duplicate that PostgreSQL cannot express as a global unique
  index when the routing key differs.

The first repository migration keeps current preview-scale relations
unpartitioned so it does not impose empty-partition planning overhead.
Partition/shard preparation starts at the earliest of 100M live rows,
a relation's largest index exceeding 30% of database RAM, autovacuum or
checkpoint p95 consuming 20% of its interval, or a concurrent index build
no longer fitting the maintenance window. Promotion past 500M requires the
partition layout and production-shaped `EXPLAIN (ANALYZE, BUFFERS)`
evidence. A starting target is 64 hash partitions for global facts and 128
for Realm facts at 500M; revise from skew telemetry. At 3B, the estimate is
256 global and 512 Realm partitions (about 11.7M and 5.9M rows/partition
respectively) or horizontal shards using the same keys.

Support and effective projections update incrementally under
transaction-scoped logical-key advisory locks. Ordinary requests never
recompute a whole Unit, Tag, Realm, or corpus. Administrative Path correction
uses bounded batches and a durable checkpoint; its `O(A x L)` fan-out is
off the request path, rate-limited by replica lag and WAL budget, and can
resume idempotently. Primary-display refresh scans only accepted Paths ending
at one Tag through the inverse index. Full spoiler aggregate recomputation is
allowed only for the initial import-scale cutover; subsequent maintenance is
incremental or outbox-driven.

## Online migration and release cutover

This is one MAJOR RomVer cutover with no compatibility aliases.

1. Pause affected Tag, Path, and Realm judgment writes and drain every old
   writer before changing the persisted contract. Writes remain paused through
   verification; there is no dual-write or compatibility interval.
2. Apply the generated `atlas:txmode none` migration in the single release
   window. It renames the existing judgment and aggregate relations in place,
   maps `value` to `fit_vote` by a metadata column rename, adds the nullable
   spoiler and per-dimension timestamp columns, attaches proof constraints as
   `NOT VALID`, and builds replacement indexes with `CREATE INDEX CONCURRENTLY`.
   The same migration creates the additive measurement, association-judgment,
   policy, guard, and primary-display projection contracts. It does not create
   shadow judgment tables or copy their rows. Registry and kind guards are
   active before the four platform Tag Units are inserted.
3. Run the bounded cutover runner. It backfills the fit and spoiler dimension
   timestamps and recomputes the corresponding dual-dimension aggregate rows.
   Populated timestamps are durable completion checkpoints, and each batch
   advances over bounded ordered keys. Backpressure gates every batch on
   latency, WAL, replica lag, lock waits, and connection-pool pressure.
4. Deploy the API and frontend from the same release and invalidate all
   incompatible cursors. While affected writes remain paused, run the runner's
   separate online `VALIDATE CONSTRAINT` stage so validation is not hidden in
   application startup or the metadata migration.
5. Verify judgment and aggregate parity, registry readiness, cursor
   invalidation, projection watermarks, lock waits, WAL/replica lag, and
   idempotent pack re-application; only then resume writes. Rollback is the
   previous binary plus a database restore; there is no pre-v1 adapter.

The generated migration and cutover runner expose these stages rather than
hiding unbounded recurring work inside application startup. Batch size starts
at 10,000 and adapts downward if a batch exceeds 500 ms, replica replay lag
exceeds 5 s, WAL generation exceeds the approved rate, or the connection pool
passes 70%. Resume after backpressure clears; do not skip or weaken parity.

## Phase 0 gate

The accepted implementation choices are:

- sparse co-located fit/spoiler judgment rows;
- fit-only Path-definition votes;
- exact composite indexes for target, viewer, inverse, and Realm routes;
- synchronous incremental projections initially, with the binding outbox
  threshold above;
- no corpus scan, deep offset, unbounded recursive hierarchy read, or
  in-process corpus materialization; and
- a partition/shard cutover before the 500M promotion and complete 3B routing
  plan.

The storage-layout and bounded-query design evidence passes, but the Phase 0
capacity gate is **FAIL / PENDING** because the required real-schema admission
benchmark has not passed. Migration landing and all later phases remain
blocked. Deployment is additionally gated on production-shaped validation,
capacity procurement, and maintainer authorization.
