# Semantic interoperability capacity

Owner: [Schema.org and Wikidata interoperability](semantic-interoperability.md),
M07/M09. This is a planning envelope, not measured storage or throughput. The
[capacity policy](data-integrity-and-workload-budgets.md#capacity-planning) requires
500,000,000-row and 3,000,000,000-row estimates for every growing family. The
existing generated [native workbook](database/capacity.md) does not yet include
these source representations and indexes; its totals do not qualify this extension.

## Denominators and storage

Let N be source-described subjects, s statements/subject, q qualifiers/statement,
r reference groups/statement and v snaks/reference group. One equivalent statement
row includes its main snak; separate physical main-value storage must be added.
The core row count is `N * s * (1 + q + r + r*v)`. It excludes source identity,
names, payloads, histories, lexical/list members, native adoption and extra postings.
These are adjustable distributions, not observed Wikidata averages or input limits.

For s=20, q=2, r=1, v=3:

| Component | Rows/subject | Rows at 500M subjects | Rows at 3B subjects |
| --- | ---: | ---: | ---: |
| Statement including main snak | 20 | 10B | 60B |
| Qualifier occurrence | 40 | 20B | 120B |
| Reference group | 20 | 10B | 60B |
| Reference snak occurrence | 60 | 30B | 180B |
| Core total | 140 | 70B | 420B |

At an illustrative average 256 bytes per equivalent row including basic owner
indexes, core storage is 17.92 TB / 107.52 TB, decimal units. This coarse model is
not a claim that arbitrary values, composite keys and all query indexes fit into
256 bytes. At 512 bytes it doubles. With one replica and 2x provisioning per copy,
the 256-byte core alone requires 71.68 TB / 430.08 TB; backups and WAL are additional.

Each row family below also needs its own independent baseline. The widths are
placeholders for heap plus basic keys/indexes; these independent baselines must
not be added to the subject-expansion example as if they described one dataset.

| Growing family / each listed role | Assumed bytes/row | 500M rows, GB | 3B rows, TB |
| --- | ---: | ---: | ---: |
| Source node; observation/representation manifest entry | 320 | 160 | 0.960 |
| Statement including main-snak descriptor; qualifier occurrence; reference snak occurrence | 256 | 128 | 0.768 |
| Reference group; collection/lexical membership | 192 | 96 | 0.576 |
| Typed value descriptor; name/description term; sitelink; vocabulary term; shape-document descriptor | 320 | 160 | 0.960 |
| Mapping revision; per-field coverage outcome | 320 | 160 | 0.960 |
| Query posting beyond basic owner indexes | 128 | 64 | 0.384 |
| Job receipt; acquisition/reconciliation checkpoint entry | 256 | 128 | 0.768 |

Inventory term strings, shape bodies and source bytes separately by measured
compressed length. For illustration, 10 KiB retained payload per subject costs
5.12 TB / 30.72 TB before replication/history. Deduplication requires measured
reuse and cannot collapse independent evidence. Bounded local configuration can
use its declared inventory; externally supplied terms and namespaces must not be
assumed to be permanently small control tables.

Record exact per-family counts, p50/p95/p99/max widths, language counts, statement
degree, qualifier/reference fan-out and history retention before implementation
sizing. Schema.org list/Role graphs, large literals and adversarial shared references
need separate mixes. Incremental copy-on-write manifests may share unchanged
observations; neither every update nor every index generation should duplicate
the entire corpus. Shared native roots/observations must be deduplicated when
combining this envelope with the native workbook.

## Access paths and admission

Logical access paths are source/generation/subject/property/statement;
source/generation/property/value-kind/comparison-key/statement; and
source/generation/object-reference/property/subject/statement. Qualifier and
reference postings include their role and exact statement/group key so predicates
cannot accidentally correlate unrelated claims. Oversized comparison values use
digest candidates with bounded exact rechecks. High-collision/skew cases remain
subject to scanned-row and byte budgets.

Use source/record routing and hash partitions for subject-owned data. Global
property lookup requires its own partitioned postings and bounded bucket
continuation; subject sharding alone does not solve predicate search. A popular
property or external target cannot require an unbounded all-shard request.
Postings are reconstructible, versioned and joined to authorized exact observations.
No unrestricted GIN over every archived JSON payload is assumed.

The generation prefix denotes logical manifest membership. Reuse immutable posting
segments for unchanged observations rather than copying every posting per refresh.
Bound delta segments and merge fan-out with admitted compaction; benchmark both
steady state and compaction before choosing its physical layout. Graph-scoped
queries include graph identity without combining assertions from different graphs.

Initial request budgets: at most 50 returned items, 2 MiB response bytes, 5,000
examined candidates and a 1.5-second query deadline. Statement detail pages its
children instead of returning an unbounded aggregate. A large authorized value
can be fetched through a bounded artifact stream. Partial pages retain examined
progress; expired generations return an explicit restart outcome. Graph reads
add explicit node/edge/depth budgets. Arbitrary joins, closure and exact global
counts require separately admitted background work.

Initial qualification workload: 100 mixed source reads/s, 20 foreground native
writes/s, 50 source-subject refreshes/s, 32 clients and a 5x burst, consistent with
the native planning profile. These are test inputs, not a production forecast.
Read mix covers identity, rare/dense property values, multilingual terms, reverse
references and high-degree statement details. Indexed 50-item reads target p95
250 ms; property searches target p95 1.5 seconds, with p99, rejection and partial
rates reported separately. Schema.org fetch concurrency has additional per-host
rate/byte limits.

At the illustrative density, replacing 50 subjects/s creates 7,000 core rows/s
before histories and postings; the burst is 35,000 rows/s. With k extra postings
per statement, add `50 * 20 * k` postings/s. Measure WAL/row and amortized object
writes; replacing unchanged source records should not rewrite their representation.
Very large changed records stage chunks and activate a sealed manifest. A per-chunk
budget of 4,096 rows or 8 MiB, whichever comes first, does not cap total subject size.

Worker concurrency, pending bytes, backlog age and provider quotas are finite.
Start qualification with at most eight staging workers and a 256 MiB memory
budget per worker; disk-backed staging handles large records. Bound context
expansion and decompression separately. If a record cannot be processed, retain
its payload and action-required coverage outcome instead of reporting success.
Source bytes, index writes and fetch traffic each consume admission permits.

## Bulk operations, recovery and scale decisions

At 50 subjects/s, 500M/3B subjects take about 116/694 days to process. At a hypothetical
10,000 subjects/s they still take about 13.9/83.3 hours, producing about 1.4M core
rows/s at the assumed density. Bulk bootstrap therefore requires measured dedicated
capacity and backpressure; the incremental profile cannot qualify it.

At a constant effective 250 MB/s, transferring the 17.92/107.52 TB core takes at
least 19.9/119.5 hours, before index construction, objects, WAL replay or integrity
checks. This is a transfer lower bound, not an RTO. Record baseline installation,
checkpoint catch-up and restore RPO/RTO against the actual retained event window.
Buffer changes durably during long baselines and reconcile missing coverage.

Measure working-set/cache misses, partition pruning, value-hash recheck bytes,
locks, WAL/checkpoints, vacuum lag, disk reserve, replica lag and per-source queue
age. Admission pauses bulk builds before disk falls below the active-generation
plus next-generation and recovery reserve. If incremental lag approaches the
available upstream history window, preserve durable intake and mark freshness
degraded; replay expiry requires reconciliation rather than silent catch-up.

The initial PostgreSQL/object-storage choice remains subject to these measurements.
Predicate-sharded read projections, cold-history storage and separately provisioned
bulk workers are the first physical alternatives to evaluate. Cross-database
operation requires its separate activation and integrity policy; if required to
meet the full-index envelope, record it as a prerequisite before claiming capacity
acceptance. A rebuild must retain the old complete generation, authority and
erasure frontiers, then switch only after all manifest parts are accounted for.

The verification phase must split placeholder row roles into actual physical
families, extend the owning capacity generator and retain query plans, skewed
load evidence and crash/restore results. Do not hand-edit the existing generated
workbook or infer capacity from its unrelated totals. Required semantic and
operational cases live in [source conformance](../testing/source-conformance.md#schemaorg-and-wikidata-acceptance).
