# Tag Path semantic capacity and operations

Status: accepted capacity contract. The model and bounded-access assertions are
implemented. Hardware-dependent latency, WAL, and bytes-per-row figures must be
requalified on staging before a production rollout.

## Planning baseline

Every potentially corpus-scale relation is planned independently at
500,000,000 rows and estimated at 3,000,000,000 rows. Aggregate totals must not
assume that all relations reach the baseline at the same time.

The service envelope is:

- 100,000 bounded reads/s across the deployment;
- 20,000 source or judgment mutation attempts/s;
- warm request p95 below 100 ms;
- accepted mutation p95 below 150 ms;
- pages of at most 50 for ordinary reads and 100 for governance;
- UUID or composite keyset pagination, never deep offset pagination;
- no request-path corpus scan, whole-corpus sort, or corpus-sized in-process
  materialization; and
- skew in which a popular Unit, Expression, Path, Tag, or Realm/Unit key can
  receive far more traffic than the median.

These are procurement and topology envelopes, not unconditional admission
promises. Pool occupancy, lock admission, statement timeouts, WAL, replica lag,
queue age, and index residency must reject or defer work before the database
becomes an unbounded queue.

## Workload and distribution assumptions

The planning distribution is deliberately skewed:

| Quantity | Typical | p99 / hard bound used by design |
| --- | ---: | ---: |
| Path members `L` | 2-4 | 16 hard |
| explicit effective outputs `A` per Expression | 1-4 | 256 hard |
| active rules from one Expression | 0-2 | 16 hard |
| upstream/downstream Expression reach | 1-8 | 64 hard in each direction |
| visible Applications read for one Unit | 10-100 | bounded API page/source limits |
| accepted Applications per Unit/Expression/authority | 1 | polyhierarchy may produce several |
| hierarchy children returned | 10-30 | API bound |
| Path-position page | 10-20 | 50 maximum |

The PostgreSQL inference guards mirror the 16/64/256 constants exported by the
typed schema. They serialize definition graph changes, reject cycles, cap active
outbound rules, cap reachable Expression work, and roll back a closure that
would produce more than 256 Effective Tags. These are product limits, not
benchmark fixture assumptions.

Definitions are read-heavy and mutation-light. Applications and judgments are
write-heavy corpus facts. A representative operating mix is 70% Unit landscape
and search reads, 20% concept/Path reads, 8% judgment updates, and 2% definition
or governance operations. Capacity tests must also run 100% hot-key mutation
and popular-Tag position scans because the mean mix hides the relevant failure
modes.

## Cardinality model

Let:

- `U` be Units with semantic sources;
- `D` be direct Tag sources;
- `P` be Path Applications;
- `J` be sparse Application judgments;
- `E` be distinct asserted Expressions per Unit/authority;
- `A` be distinct Effective Tags in an Expression closure, `A <= 256`;
- `R` be Realm authorities that contain a Unit.

The dominant global relations are:

```text
unit_tag_path_application                     = P
unit_tag_path_application_judgment            = J
unit_expression_assertion                     <= D + P after semantic deduplication
unit_effective_tag                            <= distinct(Unit, effective Tag)
```

Realm relations add the authority key and follow the same formulas. Definition
relations are independent:

```text
tag_path_member                               = sum(Path length)
tag_path_sense_binding                        = sum(explicit bindings)
tag_expression_effective_tag                  <= 256 * Expression count
```

At 500M and 3B rows, all reads remain equality- or range-routed by the leftmost
index key. No correctness path assumes one node can hold the 3B-row physical
relation.

## Write amplification

The former preview model wrote one support fact per Profile and Path member, so
amplification grew with `L`. The semantic model writes one Application source
and one Expression assertion, then materializes only explicit closure outputs:

```text
O(L) -> O(A), normally A = 1
```

Creating an unjudged global Application normally touches one Application row
and performs an indexed assertion check that writes nothing until the source is
accepted. The first positive judgment normally mutates:

1. one sparse judgment row;
2. one judgment-stat row;
3. one Path usage aggregate;
4. one Unit/Expression assertion row; and
5. up to `A` effective Tag rows for the Unit projection.

The planning envelope is therefore `4 + A` focused row mutations after the
Application row, independent of Path length and corpus size. With typical
`A = 1, 4, 8`, that is 5, 8, or 12 focused mutations; the hard semantic ceiling
is 260. Realm writes have the same asymptotic cost with wider keys.

The current projection refresh is routed to one Unit (or one Realm/Unit) and
recomputes that key's direct and asserted Expressions. It never scans the
corpus, but cost grows with semantic sources on that one Unit. A Unit exceeding
4,096 asserted Expressions, a refresh touching more than 32 MiB of buffers, or
a refresh p95 above 50 ms is an operational cutover threshold: move effective
projection maintenance to the key-routed idempotent reducer described below
before admitting further sources for that hot key.

Inference-definition changes update the small Expression closure and upsert one
durable `tag_expression_projection_rebuild` job when the Expression has Global
or Realm assertions. The worker uses `FOR UPDATE SKIP LOCKED`, advances at most
500 assertion keys per transaction, claims at most four pages per poll, and
retries failed pages with a delay capped at 60 seconds. A new rule revision
resets the existing job's authority cursors under the same row lock. Search and
Unit effective projections are therefore refreshed asynchronously without a
synchronous corpus fan-out in the curation request.

## Storage envelope

The 2026-08-29 disposable PostgreSQL 18.4 qualification measured the following
heap-plus-required-index bytes per row. The 1,000-Path fixture includes fixed
relation/index page overhead, so these are deliberately conservative topology
estimates rather than dense production fill-factor predictions. They exclude
TOAST variance, 30% free-space/headroom, WAL retention, backups, replicas, and
concurrent-index workspace.

| Relation shape | Measured B/row | 500M | 3B |
| --- | ---: | ---: | ---: |
| global Path Application | 434.502 | 202.3 GiB | 1,214.0 GiB |
| Realm Path Application | 516.483 | 240.5 GiB | 1,443.0 GiB |
| global Application judgment | 339.854 | 158.3 GiB | 949.5 GiB |
| Realm Application judgment | 324.637 | 151.2 GiB | 907.0 GiB |
| global Expression assertion | 232.107 | 108.1 GiB | 648.5 GiB |
| Realm Expression assertion | 401.408 | 186.9 GiB | 1,121.5 GiB |
| global Effective Tag | 497.664 | 231.7 GiB | 1,390.5 GiB |
| Realm Effective Tag | 731.136 | 340.5 GiB | 2,042.8 GiB |
| Path member | 406.753 | 189.4 GiB | 1,136.5 GiB |

With 30% headroom, 500M global Path Applications need about 263 GiB before
replicas and backups. At 3B they need about 1.54 TiB with headroom. Two replicas
triple resident heap/index storage and require two sustained WAL network
streams. Staging `pg_total_relation_size`, row estimates, bloat, growth rate,
and index hit ratio must replace this conservative small-fixture evidence before
production procurement.

## Routing and indexes

Stable routing keys lead every corpus request key and future partition key:

| Family | Routing key / binding index |
| --- | --- |
| Path definition and vote | `path_id` |
| all positions for a concept | `(node_id, path_id, ordinal)` |
| global Applications for a Unit | `(unit_id, pinned, position, id)` |
| Applications using a Sense | `(sense_id, unit_id, id)` |
| global assertion inverse | `(expression_id, unit_id)` |
| global effective inverse | `(tag_id, unit_id)` |
| Realm Application | `(unit_id, realm_id, sense_id, id)` and `(realm_id, sense_id, unit_id, id)` |
| Realm assertion inverse | `(expression_id, realm_id, unit_id)` |
| Realm effective inverse | `(tag_id, realm_id, unit_id)` |
| inference source/target | `(source_expression_id, status, kind, id)` and target indexes |
| definition projection work | `(available_at, requested_at, expression_id)` with Global UUID and Realm composite cursors |
| typed hierarchy | parent- and child-led relation indexes |

Equality columns precede range/cursor columns. Accepted/active queues use
partial indexes matching their predicates. Path position, governance, and
Application lists use keyset cursors containing every ordering column.

Breadcrumb hydration receives a bounded Path ID set and reads at most 16
members per Path. Unit landscapes read the actual source page, batch-hydrate
Senses/Expressions/Paths, then aggregate in process; they do not issue N+1
definition reads. Definition endpoints are separately capped because their
datasets do not share corpus pagination semantics.

## Query complexity and plan acceptance

The capacity fixture must capture `EXPLAIN (ANALYZE, BUFFERS, WAL, FORMAT JSON)`
for at least:

- accepted Paths containing a Tag with a UUID cursor;
- Unit Application keyset reads;
- Expression assertion inverse reads;
- Effective Tag inverse reads;
- Realm Unit Application reads;
- active Sense and inference-rule reads; and
- hot Application judgment mutation.

Plan acceptance requires the named routing index (or documented equivalent),
no sequential scan of a corpus relation, no unbounded sort, and at most 512
shared blocks for a bounded read fixture. Small definition tables may use a
sequential scan only when the fixture proves the relation remains below its
declared control bound; corpus estimates cannot be extrapolated from that plan.

The reproducible command is:

```text
task services-main:tag-path:capacity -- --yes --units 1000 --paths 1000 --samples 256
```

It is destructive and restricted to loopback `rezics_atlas` with
`TAG_PATH_CAPACITY_DISPOSABLE=tag-path-capacity-v2`. Its JSON output records
fixture distribution, latency, WAL, plans, parity counts, relation bytes, and
straight-line 500M/3B storage estimates. Results are evidence for bounded access
paths, not proof that a small machine contains 500M physical rows.

The 2026-08-29 reference run used PostgreSQL 18.4, `shared_buffers=128MB`,
`work_mem=4MB`, 1,000 Units, 1,000 Paths, 3,997 Applications per authority,
and 256 hot-key mutations per authority. Fixture loading took 5.001 seconds and
45,574,888 WAL bytes. Global committed 230/256 at 335.237 writes/s with 66.650
ms terminal p95; Realm committed 230/256 at 318.454 writes/s with 68.031 ms
terminal p95. Both had zero deadlocks, timeouts, and unexpected errors. Every
corpus plan was index-routed; the largest bounded read touched 388 shared blocks,
and the only paged incremental sort consumed 51 rows. Semantic parity proved
that a 16-member Path produced one qualified Expression assertion, no
intermediate-member assertion, and only its explicit Effective Tags.

The default hot-key tier uses six concurrent writers, a 64-connection pool
capacity, three total attempts per logical mutation, and deterministic bounded
backoff. This is a synchronous-admission qualification, not a promise to absorb
arbitrary fan-in on one aggregate key. The short burst must commit at least 80%
of samples at 100 accepted writes/s with accepted-or-rejected p95 below 150 ms;
the stricter sustained rejection threshold below still triggers the reducer
cutover.

For Paths containing a Tag, each request materializes at most 65 membership
candidates, filters their acceptance projections, and may therefore return a
partially filled page with a continuation cursor. PostgreSQL may use either
`tag_path_member_node_path_idx` (selective Tag) or the
`tag_path_member_pkey` keyset order (extremely popular Tag). Both plans are
accepted only when they avoid corpus scans, keep sort work bounded, and touch no
more than the benchmark's shared-block ceiling.

Because the disposable fixture is deliberately much smaller than a corpus
relation, its corpus `EXPLAIN ANALYZE` transactions set
`enable_seqscan=off`. This qualifies that every query has a bounded index route;
it does not change production settings or treat toy-fixture latency as a
500M-row prediction. A forced plan that still contains a sequential corpus scan
fails, as does a route that exceeds the block or sort bounds.

Realm Unit Application pages accept either the dedicated
`realm_unit_tag_path_application_unit_route_idx` or the unique
`realm_unit_tag_path_application_authority_key`. With Realm and Unit fixed, the
unique authority key yields at most one row per presorted Sense group; any
incremental sort is still checked against the 50-row page plus one executor
lookahead row.

## Concurrency, hot keys, and backpressure

Application judgment aggregates use deterministic transaction advisory keys.
Contention returns retryable `55P03` admission failure instead of waiting in an
unbounded lock queue. Relation and inference graph mutations use separate
serialized definition locks; these rare curation writes must never share the
high-rate judgment admission path.

Move a source family to an idempotent event outbox plus key-routed micro-batch
reducer when any threshold is sustained for five minutes:

- one Application or Unit projection key exceeds 100 attempts/s;
- aggregate admission rejection exceeds 5% after bounded client retry;
- accepted mutation p95 exceeds 150 ms;
- effective projection refresh p95 exceeds 50 ms;
- pool utilization exceeds 80%;
- WAL exceeds the approved primary/replica network budget;
- replica replay lag breaches its SLO; or
- reducer queue oldest age exceeds 60 seconds.

Events carry source revision/idempotency identity. Workers claim bounded pages
with `FOR UPDATE SKIP LOCKED`, coalesce by Unit/authority, acquire keys in UUID
order, update aggregates in one transaction, and advance a durable watermark.
Backpressure rejects or defers new work before queue growth becomes unbounded.

## Partitioning and 3B topology

Partition before one heap or hot index exceeds the approved node IO/memory
envelope, and no later than 100M live rows or 25% of usable node data volume for
one corpus relation. Partition keys are the same stable routing prefixes:

- global Unit facts: hash `unit_id`;
- Realm Unit facts: hash `(realm_id, unit_id)` or a stable combined routing hash;
- assertion/effective inverse serving: separately maintained expression/Tag
  search shards when inverse traffic no longer fits the primary Unit shard;
- definition directory: `path_id`, `expression_id`, or vocabulary namespace.

PostgreSQL unique/primary constraints on partitioned tables must include the
partition key. Global structural and claim-key uniqueness therefore remains in
a small definition directory when definition storage is sharded. The cutover
uses shadow partitions, dual validation inside an explicitly versioned
maintenance operation, checksums and count parity, then an atomic writer switch;
it is not a public compatibility mode.

At 3B rows, application sharding is mandatory. Synchronous cross-shard
aggregates are forbidden. Search/effective consumers receive idempotent events
and publish watermarks; user-facing reads disclose or tolerate the documented
bounded projection lag. Definition graph components are routed by namespace;
cross-namespace edges go through the governed directory rather than a
whole-graph in-memory load.

## Maintenance, rebuild, and migration cost

Projection rebuilds use keyset pages, durable authority cursors, bounded
commits, and explicit rate limits. The job records attempts, availability,
last error, request time, and update time; deployment telemetry must additionally
record rows/s, WAL/s, buffer reads, retry age, and high-water marks. The full
maintenance command is
`task services-main:tag-expression-projections:rebuild`. `VACUUM (ANALYZE)`
and index maintenance are scheduled per partition. No rebuild performs
`OFFSET`, one giant transaction, or delete/reinsert work for the whole corpus.

The destructive dev-preview migration intentionally drops obsolete support
facts rather than converting them. Migration replay validates the canonical
schema on a blank database and on the old preview sequence. After cutover:

1. seed vocabulary definitions, Expressions, Senses, and explicit rules;
2. rebuild definition closure;
3. rebuild assertion/effective projections in routed batches;
4. rebuild search/facet documents and caches;
5. compare source counts, projection counts, and sampled semantic parity; and
6. enable writers only after the new readers and projection watermarks are
   healthy.

Old support-row counts are not a parity target because their all-member meaning
is intentionally rejected.

## Failure modes and observable cutovers

| Signal | Expected failure | Required response |
| --- | --- | --- |
| inference limit constraint | definition would exceed bounded semantic work | split/refine rules; do not raise limits without a new capacity review |
| relation graph write exceeds statement SLO | large/hot vocabulary component | move namespace to topological-rank/graph-directory service before more writes |
| hot-key `55P03` | concurrent aggregate owner | bounded retry, then event reducer |
| Unit projection >32 MiB or >50 ms | one Unit has excessive semantic sources | incremental key/tag reducer and admission cap |
| corpus relation reaches 100M rows | maintenance/index risk | shadow hash partitions on stable routing key |
| inverse index no longer resident | Tag/Expression fan-in dominates | dedicated inverse/search shard |
| 3B estimate exceeds one-node storage/WAL | physical single-node ceiling | application sharding plus idempotent projection events |

These thresholds make the limiting resource and cutover visible before the
500M baseline is endangered; toy fixture latency alone is never accepted as
capacity proof.
