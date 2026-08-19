# Unit identity merge governance

## Scope and invariants

Unit merge is a one-way identity operation: `source Unit -> canonical target Unit`. It is
available for Book, Entity, Media, and Software Units. Product-facing “Game” records use
the Software Unit kind and therefore follow the Software path. A source and target must
have the same kind. A Unit may be a standalone Unit, Main, or Variant; Variant status is
never evidence that the Unit is valid or should be retained.

Acceptance establishes these permanent invariants in one database transaction:

- an immutable redirect records the source and target identities;
- the source is soft-deleted and Post targeting is locked;
- a durable, leased convergence operation is created;
- every Unit participating in the affected Variant graph is locked against graph edits;
- the accepted request, policy snapshot, manifest fingerprint, and audit event are stored.

The source Unit row and its governance/history records remain as a tombstone. A merged
source cannot be restored or reused. Reads resolve redirect chains to a canonical Unit;
ID-addressed read paths and high-risk subject writers resolve the canonical identity
before writing. Database triggers cover every migrated live-reference relation and reject
a stale write to a merged source as the final safety boundary; rejected writers can resolve
the redirect and retry against the canonical target.

Redirects are deliberately not rewritten or deleted. Each redirect stores the maximum
upstream depth that reaches it; the target/depth index lets acceptance validate the full
new chain without recursively scanning every historical ancestor. Resolution and stored
depth are bounded to 32 hops, and acceptance rejects a non-canonical target, cycle, or
overflow. If real workloads approach 24 hops, operators must schedule a versioned
redirect-compaction design before accepting more links in that chain.

## Authority and review policy

The centralized policy is versioned in backend code and copied into every request:

| Capability | Effect |
| --- | --- |
| `unit.merge.propose` | Preflight and submit a reviewed merge |
| `unit.merge.review` | Approve or reject a reviewed merge |
| `unit.merge` | Directly accept a merge and manually retry a failed operation |

Policy version 1 requires four distinct approvals, forbids proposer self-review, enables
a one-vote terminal rejection, and expires pending requests after seven days. A reviewer
with the direct capability still casts only one ordinary vote unless they intentionally
use the separately labelled direct-merge command. A rejected request is immutable; a
privileged override creates another `privileged_direct` request linked to the rejected
request rather than altering its decision record.

Review votes are immutable and bound to the request fingerprint. The fingerprint covers
the policy version, source and target IDs, kinds, Unit aggregate `updated_at` values,
Variant graph revisions, and the graph plan. The fourth approval revalidates the
fingerprint and accepts the merge in the same transaction. Any aggregate edit or relevant
Variant graph change supersedes the request; independently versioned historical evidence
does not silently change the chosen identity direction.

## Retry and convergence model

The accepted operation is the retry identity. A retry never creates a replacement event,
changes the target, or recomputes a new plan. It resumes the same ordered phase ledger.
Each phase is idempotent. Every source selector is capped at 500 rows; dependent votes,
Post-score links, and external-link provenance references are drained in their own 500-row
sub-batches, so a high-fanout parent cannot turn one transaction into unbounded work. A
phase contains only a fixed number of such sub-batches and selects contested work with
`FOR UPDATE SKIP LOCKED`. A 60-second
lease token fences stale workers. Automatic failures use bounded exponential backoff and
stop after 12 failure attempts; `unit.merge` can then reset that same operation for a
manual retry.

The worker processes at most four operations per claim and at most 32 transactions per
operation dispatch. It yields unfinished work back to the queue, keeping request-path and
worker-loop latency bounded. Successful batches reset the consecutive failure count.

The final phase locks the source Unit row and rescans every movable live-reference phase.
That lock waits for transactions that obtained a pre-acceptance foreign-key lock. The
rescan then observes their committed rows and repeats until no live reference remains.
Only after this convergence check does the worker release the source/target graph locks
and mark the request complete.

## Reference policy

The worker handles live references by semantic class, not by blindly rewriting every
foreign key:

- **Canonical ownership/reference:** slug targets and scopes, aliases, external links,
  Software-owned requirements and their platform-Entity references, reactions, shares,
  follows, scores, collection items, tag relations, Realm mounts/pins/tags, Post subjects,
  pending association
  proposals, credit and subject associations, release/series links, poll options, content
  nodes, structure applications, progress, notification subjects, and current
  personalization references move to the target.
- **Duplicate-sensitive:** votes, follows, scores, tags, collection items, Realm mounts,
  structure applications, progress summaries, and similar unique relations converge with
  an explicit deterministic winner or aggregate rule before the source row is removed.
- **Rebuildable projection:** Studio work relations, best-score rows, and search documents
  are removed and rebuilt from authoritative state.
- **Historical or authority evidence:** audit events, Unit revisions and their revision-specific
  credit attribution, resolved proposals, ownership/access history, moderation evidence,
  recommendation events, and source-owned content remain attached to the source tombstone.
  A revision credit keeps the originally credited Entity ID; new credits to an already merged
  Entity are rejected and ordinary Entity reads resolve that historical ID through its redirect.
  Moving these records would falsify history.
- **Canonical content:** target-owned localization, License offerings, dock, and structure
  content wins. Source content remains preserved on the tombstone and is not presented as
  current target content.

When moving a slug scope, an address that would become self-scoped or collide with an
address already owned by the target scope is removed; the target namespace wins and the
child Unit remains available by immutable ID. When two Software requirements collapse to
the same `(software, platform Entity, tier)` identity, the target-Entity requirement wins.
Active aliases and external links obey the existing 128-row per-Unit limit. Target rows
win duplicates; remaining source rows fill deterministic available slots, and overflow is
preserved on the target as withdrawn history instead of making the merge fail or silently
discarding evidence. Before deleting a duplicate external link, the worker independently
batches and rewires every Software requirement provenance reference to the surviving link.

Adding a new Unit foreign key requires classifying it in this list, adding a phase or an
explicit historical exemption, adding a source-leading index when the relation can reach
corpus scale, and extending the stale-write guard before release.

## Capacity assumptions

The capacity baseline is 500,000,000 rows in any corpus-scale reference relation, with a
3,000,000,000-row estimate. Merge requests, reviews, redirects, operations, and graph
locks are control-plane tables. They are expected to remain below 10 million rows for the
first supported deployment, but their indexes and keyset pagination do not depend on that
bound.

Workload assumptions:

- 99.9% of Units have fewer than 10,000 references; a celebrity/hot Unit may have
  10,000,000 references in one relation.
- normal relation traffic can reach 50,000 writes/s across the service; merge traffic is
  capped by the worker claim size and database backpressure rather than queued in memory;
- Console list reads target sub-250 ms p95, merge acceptance targets sub-1 s p95, and
  convergence has no synchronous completion target;
- source IDs may be highly skewed, so only one accepted operation can own a source or any
  affected Variant graph Unit at a time.

Every phase predicate begins with the source Unit key. Batch order follows an existing
source-leading index where one provides a useful order; otherwise the worker uses the
source-key range without imposing a whole-hot-key sort. The merge adds concurrent indexes
for progress entries, Realm tag votes and relationships, Studio work/visit projections,
recommendation best-score rows, and historical content-structure nodes where existing
product indexes have a different leading key. Per-row search rebuild triggers are
suppressed only inside the identified merge transaction; the source projection is removed
and the target document is explicitly rebuilt once during finalization. A UUID source-leading
B-tree entry is approximately 32–48 bytes after tuple and alignment overhead: one such
index is roughly 16–24 GB at 500 million rows and 96–144 GB at 3 billion rows before
replication and free space. These indexes therefore add material storage and write
amplification, but prevent a phase or final convergence check from scanning an entire
relation. Exact size must be measured with `pg_relation_size` on production-like data.

A 10-million-row hot relation requires at least 20,000 500-row transactions. Rows and
their required unique-index changes determine WAL; assuming 0.5–2 KB of heap/index/WAL
traffic per moved relation, that phase produces approximately 5–20 GB of database I/O.
At a conservative 10 batches/s it takes about 33 minutes; backpressure can reduce this
without affecting correctness. At the 3-billion-row corpus baseline, work remains
proportional to references of the selected source, not corpus size.

No worker loads a source’s references into memory. Per-operation application memory is
bounded by a batch result and manifest, typically below 1 MB. Network responses contain
only control-plane request records. Console lists use UUIDv7 keyset pagination and never
deep offsets.

## Migration, verification, and operations

The control-plane schema and triggers are installed transactionally. New corpus indexes
are in a separate `atlas:txmode none` migration and use `CREATE INDEX CONCURRENTLY` to
avoid blocking writes. Before enabling merge permissions in a large installation:

1. verify every concurrent index is valid in `pg_index`; drop an invalid index with
   `DROP INDEX CONCURRENTLY` and rerun the non-transactional migration;
2. run `EXPLAIN (ANALYZE, BUFFERS)` for every phase family using representative skew,
   including a hot source, and confirm an index/range or bitmap plan with no corpus scan;
3. measure batch latency, WAL bytes, replica lag, lock waits, dead tuples, and autovacuum;
4. start with one worker claim, then raise toward the policy limit only while replica lag
   and p95 batch latency remain inside the installation’s budgets;
5. alert on expired leases, automatic-attempt count, failed operations, graph locks older
   than the operation lease horizon, redirect depth, and phase throughput.

At 3 billion rows, indexes and tables should be partitioned or sharded by a stable hash of
Unit ID when a single-node index no longer fits the storage or maintenance window. Merge
operations already carry source/target IDs and durable phase state, so a future cutover can
route a phase to the owning shard. Cross-shard merges require a versioned coordinator and
outbox protocol; they must not be enabled by silently weakening the atomic acceptance
contract.

Rollback before acceptance is ordinary request rejection or expiry. There is no product
rollback after acceptance. Operational recovery restores the database to a point before
the acceptance transaction, or completes the same idempotent operation; manually deleting
redirects or reactivating a source is unsupported.
