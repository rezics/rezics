# Resource subject-association reading

Association-card reads target a ResourceRef plus explicit semantic/presentation
context. Detail previews and full association pages use the same bounded data
contract for descriptions, media, accepted measurements, credits and visible Tag
Expressions. The current `/units/.../subject-associations` adapter is implementation
reference; route or table names do not change relationship identity.

## Workload and bounds

Capacity planning assumes 500,000,000 `subject_association` rows and evaluates
3,000,000,000 rows. Associations are skewed: most Resources have fewer than 20,
catalog works may have thousands, and one Resource may be reused by many works.
The expected read load is 200 requests/second steady and 1,000 requests/second
burst, with fewer than 50 association or Tag-source writes/second. The target
is p95 below 250 ms from a warm database and a response comfortably below
2 MiB.

One request reads at most eight associations. Keyset pagination follows the
existing `(unit_id, position, id)` B-tree, so page work is `O(log N + 8)` and
does not grow with page depth. With an estimated 80-byte index tuple, that
index is roughly 40 GB at 500 million rows and 240 GB at 3 billion rows before
replication and free-space overhead. At 3 billion rows, measure index residency, maintenance and skew and select
same-database partitioning/projections before the limiting budget is exceeded.
Reference uniqueness and cursor compatibility need explicit proof at cutover.

Each returned Resource hydrates at most 128 visible Expressions. A definition
has at most 32 presentation components, making the absolute result fan-out
eight times 128 times 32, or 32,768 component rows. Normal VNDB cards are much
smaller (the current maximum is 97 Expressions). The API returns
`expressionsComplete`; callers must not interpret a bounded result as complete
when it is false.

The source scan is also hard-bounded at 512 assertion identities per Resource.
It reads one additional identity to detect truncation and sets
`expressionsComplete=false` whenever the scan or the 128-definition response
bound is exceeded. This makes pathological owner skew a bounded, observable
partial result instead of an unbounded request.

The Expression read starts from the `(unit_id, expression_id)` assertion key,
uses the `tag_path_sense_expression_route_idx` and the unique
`(unit_id, sense_id)` Application key to prove accepted source visibility, and
filters focus-Tag content rating before label hydration. All cards are batched:
there is no per-card query, no deep offset, and no whole-corpus in-memory
operation. Credits, context posts, and measurements are likewise read with
bounded owner sets; measurement candidates are selected by context/property and exact accepted facts,
with bounded pages and explicit completeness.

## Skew, backpressure, and cutover

A malicious or pathological Resource with more than 512 Expression assertions
receives an explicitly partial result. Track
association endpoint latency, rows removed by content/spoiler filters, response
bytes, and `expressionsComplete=false` frequency. Treat 10,000 assertions on
one Resource or a 250 ms p95 breach as the cutover threshold for a viewer-policy
visibility projection keyed by `(policy_bucket, unit_id, expression_id)`.
Build that projection incrementally from judgment and content-rating changes;
do not repair it through whole-corpus request work. Apply queue backpressure
and partition projection maintenance by `unit_id`.

Source-local reads and target/context inverse reads require separate access paths.
Colocate related authoritative children where useful, but do not assert that one
hash key optimizes every query or maintains every unique constraint. Use the
[same-database storage policy](database/resource-storage.md) and qualify logical
and operation equivalence before replacing a binding. Development/test rebuilds
are permitted; online dual-read/backfill is not a blanket compatibility requirement.
