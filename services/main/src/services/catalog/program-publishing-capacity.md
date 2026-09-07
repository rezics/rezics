# Program and publishing structural workloads

The native commands use owner-local structures, independently of Bangumi IDs.
Episodes can be reused by multiple versions; publications need not manufacture a
Work or text version; serial parts form a hierarchy with a maximum of 64 ancestors.
Source snapshots retain the exact original order, display duration, statistics,
wiki syntax and contradictory/null claims. Promoting a wiki value requires an
explicit registered native property definition.

## Capacity assumptions

The capacity baseline is 500 million rows per potentially growing relation, with
an estimate at 3 billion. Budget 160–320 bytes per occurrence/installment tuple
including its heap overhead and 160–240 bytes across primary, parent/position and
reverse indexes: approximately 160–280 GB at the baseline and 960–1680 GB at 3
billion, before replicas, vacuum headroom and WAL. These are planning bounds,
not measurements. Variable label/duration/coverage text adds its actual UTF-8 and
TOAST size; the command contract bounds each value. Keep 30% free storage and
separate primary, replica and backup capacity budgets.

An expected read is one owner plus a position/ID keyset returning at most 100
rows. Episode visibility is evaluated only for that admitted page. Hidden rows
still advance the opaque position cursor, so an owner with many hidden episodes
cannot trigger an unbounded visibility scan. Sibling installment reads use the
owner/parent/position/ID index; neither whole-serial tree traversal nor OFFSET is
used. A normal insert or edit changes one structural row, its indexes, and one
owner revision/change entry. An installment move performs at most 64 parent
point reads and one child-existence lookup, under an owner revision lock. Moving
a non-leaf to a different parent is rejected rather than recursively rewriting
an unbounded subtree.

At 500 million and 3 billion rows, index descent grows logarithmically; with an
assumed 150-way internal fanout, approximately four to five index levels are
needed. This does not establish latency. Target 100-row reads below 100 ms p95
and short edits below 200 ms p95, excluding lock waits, with a workload starting
at 1000 reads/second and 100 writes/second distributed across owners. One popular
owner may have millions of children and still uses a keyset. Writes to one owner
serialize deliberately; sustained owner lock waits above 100 ms or queue growth
must apply admission/backpressure, not create unbounded workers. Source import
concurrency should be bounded and batched by independent owners.

Owner UUID is the shard key for structural and revision tables. Co-locate owner
identity, episodes/occurrences and serial children on the relevant owner shard;
cross-owner episode/release links retain explicit checked references. A future
physical partition/shard cutover must preserve those foreign-key guarantees (or
provide a separately accepted cross-shard reference protocol), rather than
simply dropping constraints. Partition routing and incremental migration must
be activated before a single-node storage or maintenance ceiling is reached.

The rollback-only `scripts/check-catalog-program-publishing.ts` harness exercises
actual native create/read/edit/order/coverage operations and emits the occurrence
EXPLAIN plan on the disposable target. Its tiny fixture is integrity evidence;
representative cardinality/skew measurements remain a release capacity gate.

## Immutable structure revisions

`catalog-structure-history.ts` and `catalog-structure-history.sql` retain native
row snapshots for program/season/version/episode/occurrence and publishing
Work/text/publication/serialization/coverage/facet/release-event/installment rows.
The history key is `(owner_id,id)` with a component/key/history index; exact source
occurrences reference both the original snapshot and native revision through
concrete foreign keys. These are independent domain histories, not an identity
parent or source-shaped replacement for native data.

`structure-history.ts` restores fixed fields, episode placements, publication
coverage and serial installments through the owning commands after exact child
history CAS. It rejects stale child edits and revalidates parent visibility,
season ownership, hierarchy and vocabulary constraints. The SQL harness now passes
14 assertions including same-ID occurrence removal/restoration and stale restore
rejection. Release-event and publication-facet restore endpoints still need their
own canonical edits; retaining their history alone does not close that gate.

With a 512-byte mean snapshot plus 160 bytes of heap/key/index overhead, one
growing history relation costs approximately 336 GB at 500M rows and 2.016 TB at
3B, before WAL, replicas, reserve and larger texts. Five revisions multiply
history count by five. Source support rows at an estimated 240 bytes add 120 GB
or 720 GB at those scales. Each edit writes one bounded row snapshot; keyset
history and latest-head reads cost O(log N + page), with at most 100 history
rows per response. The existing owner-hash partition/shard and reference-preserving
cutover applies to these growing histories; the local fixture is not a measured
production allocation or full-corpus latency qualification.
