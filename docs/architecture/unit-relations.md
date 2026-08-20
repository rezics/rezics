# Generic Unit relations

Status: Accepted

Owner: Units

## Decision

`unit_relation` is the generic, source-owned edge primitive for relationships
whose meaning is neither a Variant nor a Content Structure occurrence. The
registry begins with `adapted_audio`, whose fixed signature is Video to Audio.
Adding another relation means extending the generic registry and its signature,
not adding a Video-specific table or traversal path.

The edge stores source and target Unit IDs plus their proven Unit kinds. Its
primary key is `(source_unit_id, kind, target_unit_id)`. Composite Unit foreign
keys prove both persisted kinds. Deleting the owning source cascades its edges;
deleting a referenced target is restricted so another Unit's authored relation
cannot disappear without an explicit source mutation. A registry-generated
database check proves every relation signature. There are no per-edge timestamps:
the semantic state is the edge set, and Unit revision history records changes.

The generic service owns validation, bounded reads, exact replacement, and
history restore. The Video API exposes the domain projection
`adaptedAudioUnitIds`: omission on PATCH means no change, `null` and `[]` both
clear the edge set, and GET canonicalizes no edges to `null`. At most 64 target
IDs are accepted. IDs are UUID-normalized before uniqueness is proved, then
sorted by code point for deterministic validation, history, and lock behavior.

The existing Unit `relations` revision slot stores the minimal outgoing state
`{ kind, targetUnitId }`. Released v1 snapshots without `unitRelations` mean an
empty set. Mutation uses the Unit compare-and-swap, relation set diff, and
revision write in one transaction. Restore validates source and target
signatures before replacing the owned set in that same transaction. It never
silently omits relation state from history.

`adapted_audio` only informs the bounded, one-hop content-language evidence
projection. It does not change `availableLanguages`, localization, availability,
wiki, community, comments, reviews, or any other non-consumption semantics. No
code follows Content Structure children or infers adapted Audio from co-location.

## Access paths and bounded work

- Forward reads seek the primary-key prefix `(source_unit_id, kind)` and fetch
  at most 65 rows: 64 valid edges plus one corruption sentinel.
- Exact replacement reads that bounded set, validates at most 64 live Audio
  targets, deletes only obsolete edges, and inserts only missing edges. An
  identical PATCH creates no edge WAL, index churn, or revision difference.
- Reverse integrity and future target-centric reads use
  `(target_unit_id, kind, source_unit_id)`. Target deletion remains explicit and
  never scans the heap.
- Video language evidence seeks one `adapted_audio` source and pages by target
  ID. Candidate and presentation hydration both reapply viewer read
  authorization; an Audio Unit that becomes unreadable between statements is
  omitted rather than leaking its support declaration.
- Request memory, SQL parameters, result rows, and response bytes are all
  `O(64)` for mutation and `O(page size)` with a maximum page of 50 for evidence.
  There is no offset pagination, N+1 query, recursive tree walk, or corpus scan.

The common mutation transaction is short: Unit authorization and CAS occur
before the edge diff, target proofs use indexed Unit IDs, and the revision is
written before commit. UUID ordering avoids application-created lock inversions.
One unusually popular Video can serialize its own writes, but unrelated source
IDs share neither a relation row nor an application lock. API quotas and the
fixed bounds are the admission backpressure. When pool occupancy, lock waits,
WAL, or replica lag exceed service budgets, shed or retry editor evidence before
weakening mutation correctness.

## Cardinality and storage

Let `N` be all Units, `q` the Video fraction, and `f` the average explicit
adapted-Audio targets per Video. Edge cardinality is `R = qNf`; it is not bounded
by `N`. The hard per-Video product ceiling gives a theoretical `64N` envelope.

| Scenario | Assumptions | 500M Units | 3B Units |
| --- | --- | ---: | ---: |
| Typical planning | `q = 0.10`, `f = 2` | 100M edges | 600M edges |
| Stress planning | `q = 0.20`, `f = 8` | 800M edges | 4.8B edges |
| Theoretical envelope | every Unit treated as Video, `f = 64` | 32B edges | 192B edges |

The provisional heap plus two B-tree estimate is 180–260 bytes per edge,
including ordinary tuple and index overhead but excluding free space, bloat,
WAL, replicas, backups, and temporary maintenance space. It must be replaced by
production-shaped `pg_column_size` and `pg_relation_size` measurements.

| Scenario | 500M-Unit corpus | 3B-Unit corpus |
| --- | ---: | ---: |
| Typical | about 18–26 GB | about 108–156 GB |
| Stress | about 144–208 GB | about 0.86–1.25 TB |
| Theoretical envelope | about 5.8–8.3 TB | about 34.6–49.9 TB |

Provisioning must include WAL peaks from import/reconciliation, at least one
replica, backups, autovacuum headroom, bloat, and temporary index builds. Track
edge count, `q`, p50/p95/p99 `f`, rows changed per replacement, bytes per edge,
WAL bytes per edge, reverse-index residency, autovacuum duration, replica lag,
and source/target hot-key distributions. The theoretical envelope is a failure
boundary, not a claim that one PostgreSQL node can host it.

Before production cutover, run `EXPLAIN (ANALYZE, BUFFERS)` against typical and
stress distributions. Forward reads must use the primary-key prefix, reverse
reads the target index, and target validation the Unit primary key. Benchmark
no-op, one-edge diff, 64-edge replacement, evidence pagination, concurrent
writes to one hot Video, and deletion of a referenced Audio. Record p50/p95/p99
latency, rows visited, buffer reads, lock waits, WAL, and connection-pool time;
toy row counts alone are not acceptance evidence.

## Partitioning and sharding

The source owns mutation and history, so the primary horizontal key is a stable
hash of `source_unit_id`. Co-locate a source Unit, its outgoing edge partition,
and Unit revision state when possible. At the stress case, 64 source-hash shards
average 12.5M edges per shard at 500M Units and 75M at 3B Units. Actual shard
counts come from measured index residency, write throughput, autovacuum, and
recovery time rather than those averages.

Reverse target queries scatter across source shards. They are currently an
integrity/administrative path, not a request fan-out. Before target-centric
traffic or deletion coordination exceeds a measured scatter budget, add an
asynchronous target-partitioned reverse projection with idempotent outbox
events, lag telemetry, bounded consumers, and reconciliation. That projection
does not become the authoritative edge owner.

Start partition or shard cutover when the 12-month forecast exceeds 60% of a
measured storage/index budget, autovacuum cannot complete inside its interval,
reindex/recovery exceeds the operational window, or sustained WAL/replica lag
exceeds the service objective. Copy by source UUID keyset in bounded batches,
apply backpressure, dual-write one bucket, compare per-bucket counts and
checksums, switch reads, then retire the old bucket only after the rollback
window.

## Migration and future integrations

The generated release migration
`20260820063101_content_language_support_and_unit_relations.sql` creates the
empty `unit_relation` table and its indexes and constraints through the
repository migration workflow. It performs no corpus backfill and has no reason
to scan 500M Units. The typed schema is not a live database cutover until this
migration is applied. Deploy database DDL before code that reads Video
relations, run schema reconciliation, exercise create/replace/clear/undo, then
enable traffic while watching lock, WAL, replica, and error telemetry. Rollback
before any authored edge can drop the empty table; after writes begin, retain a
compatible reader and prefer a forward fix.

The current VNDB showcase pack contains no Video or Audio objects, so this
release does not invent a pack-only contract with no consumer. Before the first
real media pack seeds these edges, extend the generic `unitRelations` importer,
validate signatures and bounds, and write all edges before the source Unit's
first recorded revision.

Video and Audio are not currently Unit-merge-eligible. If that changes, add
durable source-edge and target-edge convergence phases, include them in every
in-progress merge phase registry, and prove restart/idempotency behavior before
enabling the new merge kinds. The target-side phase is required because target
deletion is restricted; it must never be replaced with silent cascade loss.

## Separate Entity Variant subtype integrity

Main–Variant stars remain in `unit_variant`; they are not encoded as generic
`unit_relation` edges. Entity support adds no subtype copy, composite Entity
unique constraint, or Entity-wide index. `entity.id` remains the only subtype
identity index. The existing Unit `(id, kind)` proof, `unit_variant` primary
key, and `unit_variant_main_created_at_idx` remain the complete persistent
index set for this feature.

At the 500M-Unit baseline and 3B-Unit estimate, let `v` be the fraction of Units
stored as Variants. The relation has `vN` rows: a 10% planning case is 50M and
300M rows; the full safety envelope is 500M and 3B rows. Enabling Entity as one
additional kind does not add a row or byte to an existing relationship. It
also avoids an `(entity.id, entity.kind)` B-tree that would duplicate the
Entity primary-key cardinality and require a corpus-scale index build.

An Entity Variant write performs a fixed two-Unit primary-key lock and two
Entity primary-key subtype probes. Both ID sets are locked in UUID order. An
Entity subtype update or direct deletion performs two indexed existence probes:
the Variant-side primary key and the Main-side index prefix. Group reads and
mutations remain capped at 128 members. Work is therefore `O(1)` per integrity
proof and `O(group bound)` per group operation, never `O(entity corpus)`.

The generated migration replaces the canonical trigger before dropping the old
closed-kind CHECK. Existing rows were already proved by that CHECK, and the
catalog-only drop performs no validation scan or backfill at 500M or 3B rows.
Monitor trigger latency, row-lock waits, deadlocks, and hot Main IDs. If Variant
groups are later sharded, route or co-locate the entire bounded star by its Main
ID; do not replace the integrity proof with a cross-shard corpus lookup.
