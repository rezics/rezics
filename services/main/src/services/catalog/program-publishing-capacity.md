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
