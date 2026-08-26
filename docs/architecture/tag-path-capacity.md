# Tag Path capacity and operations

Status: accepted capacity contract. Synthetic evidence is reproducible; every
deployment must replace hardware-dependent latency with staging and production
telemetry.

## Planning baseline

Every relation whose cardinality grows with Units, Profiles, Paths, or Realms
is planned independently at 500,000,000 rows and estimated at 3,000,000,000
rows. The contract assumes:

- Path length L is at most 16 and is normally two to four;
- up to 20,000 community judgment attempts/s and 100,000 bounded reads/s;
- warm bounded-read p95 below 100 ms and terminal mutation p95 below 150 ms;
- result pages of at most 50 and governance pages of at most 100;
- keyset rather than offset pagination;
- no request-path full scan, corpus sort, whole-graph traversal, or
  corpus-sized in-process materialization; and
- skewed traffic in which one popular Unit, Tag, Path, or Realm/Unit key may
  receive much more traffic than the median.

These rates are procurement envelopes, not an admission promise. Pool,
statement-timeout, WAL, replica-lag, and aggregate-lock telemetry drive
fail-fast backpressure before the database becomes an unbounded queue.

## Cardinality and write amplification

A new accepted global Unit–Path application writes one application, one
initial sparse judgment, and one aggregate row. Positive support affects
exactly L members in each Path-derived projection. The upper planning envelope
is 3 + 4L focused row mutations and never depends on corpus size.

For L = 2, 4, and 16, the envelope is 11, 19, and 67 mutations. Overlapping
Paths can reduce effective rows but must not be assumed to reduce support
provenance. One support relation reaches 500M rows after at most 250M, 125M,
or 31.25M non-overlapping applications respectively; the corresponding 3B
points are 1.5B, 750M, and 187.5M applications.

Definition projection is bounded at one header, exactly L member rows, and
exactly L - 1 adjacency rows. Compound search performs at most 15 CJK cuts,
four identity candidates per side, 32 relational pair probes, and five
decomposed results.

## Storage envelope

Representative PostgreSQL 18 heap-plus-B-tree measurements from the preceding
schema-shape study are retained only as planning proxies. They include heap,
TOAST, primary key, and request indexes, but exclude 30% operating headroom,
replicas, backups, WAL retention, and concurrent-index workspace.

| Final relation shape | B/row proxy | 500M | 3B |
| --- | ---: | ---: | ---: |
| unit_tag_path_judgment | 333.69 | 155.38 GiB | 932.30 GiB |
| realm_unit_tag_path_judgment | 417.43 | 194.38 GiB | 1,166.29 GiB |
| tag_path_vote | 219.86 | 102.38 GiB | 614.27 GiB |
| realm_tag_path_vote | 271.93 | 126.63 GiB | 759.77 GiB |
| subject_association_judgment | 220.47 | 102.66 GiB | 615.99 GiB |
| unit_tag_path_support | 300.11 | 139.75 GiB | 838.51 GiB |
| realm_unit_tag_path_support | 366.00 | 170.43 GiB | 1,022.60 GiB |
| unit_effective_tag | 217.92 | 101.48 GiB | 608.87 GiB |
| realm_unit_effective_tag | 269.64 | 125.56 GiB | 753.36 GiB |
| tag_path_member inverse shape | 167.35 | 77.93 GiB | 467.58 GiB |
| entity_measurement | 286.30 | 133.32 GiB | 799.92 GiB |

With 30% headroom, one 500M-row relation requires about 101–253 GiB. At 3B
rows, the Realm judgment proxy requires about 1.14 TiB raw and 1.48 TiB with
headroom. Two replicas triple resident heap and index storage. Capacity alerts
use each relation's live cardinality and growth rate.

Sparse co-location is retained for fit and spoiler. At one million logical
judgments the measured co-located shape was 333.69 B/judgment versus 435.30 B
for split fit and spoiler tables: 23.34% less persistent heap-plus-index space.
It also avoids two reads and two writes for the common combined judgment.

## Routing and partition compatibility

Every primary key, foreign key, request index, worker cursor, and lock key
starts with its future routing key:

| Family | Routing key |
| --- | --- |
| Path header, member, edge, definition vote/stat | path_id |
| global application, judgment, support, effective Tag | unit_id |
| Realm application, judgment, support, effective Tag | realm_id, unit_id |
| hierarchy inverse reads | tag_id |
| Entity measurements | entity_id |
| subject-association judgments | association_id |

This preserves equality routing and keyset order when a table moves to hash
partitions or application shards. PostgreSQL declarative partitioning routes
inserted rows by the declared key and supports pruning, but unique and primary
constraints on a partitioned table must include every partition column:
[Table partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html).
Exact Path-array uniqueness therefore moves to a small definition directory
when Path headers are physically sharded; it cannot become per-shard
uniqueness.

Physical partitioning is triggered before a heap or hot index exceeds the
approved node memory/IO envelope, and no later than 100M live rows or 25% of a
node's usable data volume for one fact relation. The cutover uses shadow
partitions, key-routed ingestion inside an explicitly versioned maintenance
operation, checksum parity, and an atomic writer switch. This is never a
public API compatibility mode.

At 3B rows the required topology is application sharding by the same stable
hash keys, with a small global Path-definition directory. Cross-shard work is
limited to bounded fan-out reads or idempotent event delivery; no synchronous
global aggregate is allowed.

## Request access paths

Binding indexes are:

- tag_path(terminal_tag_id, id);
- tag_path_member(path_id, ordinal);
- tag_path_member(tag_id, path_id, ordinal);
- tag_path_edge(parent_tag_id, child_tag_id, path_id);
- tag_path_edge(child_tag_id, parent_tag_id, path_id);
- tag_path_vote_stat(usage_count DESC, path_id);
- unit_tag_path(unit_id, pinned, position, path_id);
- unit_tag_path_judgment(unit_id, path_id, profile_id);
- unit_tag_path_support(unit_id, tag_id, profile_id);
- realm_unit_tag_path(realm_id, unit_id, path_id);
- realm_unit_tag_path_judgment(realm_id, unit_id, path_id, profile_id); and
- realm_unit_tag_path_support(realm_id, unit_id, tag_id, profile_id).

Hierarchy parents and children use adjacency indexes and bounded keyset pages.
Breadcrumb hydration fetches at most 16 members for each bounded Path set.
Ordinary Tag search uses PGroonga's bounded candidate function; only curation
requests unit_kind = tag_path. Ranking reads usage aggregates and never scans
applications.

The pending merge queue uses (status, created_at, id) and reports
time-to-decision from persisted timestamps. Accepted-source resolution uses a
unique partial index and a bounded cycle-checked chain. No queue uses deep
offset pagination.

## Concurrency, WAL, and backpressure

The shape fixture observed approximately 6.35 KiB, 8.45 KiB, and 27.46 KiB
WAL for fresh L = 2, 4, and 16 applications. If all 20,000 writes/s were fresh
applications, that would be about 127, 169, and 549 MB/s primary WAL before
protocol and checkpoint variation. Two replicas require at least twice those
network streams. The global write envelope therefore cannot be admitted as
fresh applications without measured WAL and replica capacity.

Vote writes acquire deterministic advisory locks for their logical aggregate
key. Admission returns retryable backpressure rather than waiting behind an
unbounded hot-key queue. Move a family to the partitioned idempotent
vote-event outbox and watermarked micro-batch reducer when any threshold is
sustained for five minutes:

- one target exceeds 100 mutation attempts/s;
- aggregate lock-wait p95 exceeds 25 ms;
- terminal mutation p95 exceeds 150 ms while pool utilization exceeds 80%;
- primary WAL exceeds its approved budget; or
- replica replay lag breaches its SLO.

## Validation contract

The deterministic capacity harness must:

- run only against the disposable rezics_atlas migration database on a
  loopback authority;
- build representative hot Unit, Path, Tag, Profile, and Realm/Unit skew;
- cover Path lengths 2, 4, and 16 and global plus Realm writes;
- record attempts, commits, backpressure, timeouts, deadlocks, pool use, lock
  wait, latency distribution, WAL, and aggregate/projection parity;
- capture hierarchy, ending-Path, viewer-judgment, keyset, merge-queue, and
  compound-search plans; and
- reject sequential scans, unbounded sorts, or missing routing predicates.

Use EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON) only for safe statements in
the disposable fixture; PostgreSQL documents that EXPLAIN ANALYZE executes the
statement:
[Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html).
Toy-row latency proves access complexity and index selection, not 500M or 3B
latency. Storage math and shard thresholds cover cardinality.

Acceptance requires no deadlock or unexpected timeout, exact fact/aggregate
parity, at least 100 successful hot-key commits/s after explicit backpressure,
terminal all-attempt p95 below 150 ms, lock-wait p95 below 25 ms, and pool
utilization below 80%.
