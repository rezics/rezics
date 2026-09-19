# Logical references and concrete owner keys

Implementation reference. This owner documents current code, identifiers and local
limits. The [selected target](../../../../../docs/architecture/database/resource-storage.md) and [implementation crosswalk](../../../../../docs/reference/current-implementation.md)
define the reconciliation boundary; existing fixtures do not qualify revised semantics.

`unitReferenceColumns` expands a closed registry into nullable foreign-key
alternatives. A required reference has exactly one non-null alternative. Its
input UUID must equal that key; its owner is a generated projection. The concrete
domain key is the relational authority. `catalog_unit_locator` is a rebuildable
UUID routing index with no inbound foreign keys. Explicit owner references can
be checked without that cache; ID-only input uses one locator lookup and the
selected concrete FK. Unknown or missing routes never trigger an owner scan.

Favorites and their private history now use this contract. The public response
carries `target: { owner, id }`. Capturing a new preview requires current read
access under the actual account and its content-rating preferences. Selected
organization authority does not turn Favorites into organization data. Personal
notes and captured previews remain account-private and deletable on erasure.
Saved history uses the same concrete target and cannot restore another target.

This is a stopped-site breaking cutover. The migration refuses nonempty legacy
Favorites or retained platform roots before installing their routing triggers.
It neither deletes those rows nor converts them. The offline converter must
populate the fresh target through its reviewed contract. Native domain rows and
source evidence can remain in the isolated test target. The helper does not by
itself retire every old `unit` consumer; each retained owner must also move its
lifecycle, writers, authorization and queries before the old parent is removed.

## Workload and capacity model

Both current Favorites and private revision history are potentially corpus-scale:
plan each relation at 500M rows and estimate 3B. Account-local pages seek the
existing `(auth_user_id, position)` or history key, read at most 101 or 33
candidates respectively, and never count the corpus. A mutation locks one
account state row, changes one Favorite and appends one history record. Expected
traffic for initial planning is 500 page reads/s and 100 mutations/s, with
account-local p95 below 150 ms and p99 below 500 ms as deployment targets requiring
measurement. One abusive or automated account serializes behind its own state
row; admission and pool limits must bound that queue. Erasure remains keyset
batched and resumable.

For twenty nullable alternatives, only one UUID is stored per row. Budget about
32 added heap bytes for the concrete key, owner text, null bitmap and alignment:
16 GB at 500M or 96 GB at 3B before tuple bloat, replication and WAL. Each
alternative has a partial reverse index, so each row enters exactly one such
index rather than twenty. A 32–48 byte index-entry budget adds roughly 16–24 GB
at 500M or 96–144 GB at 3B per relation; actual page fill, deduplication and key
skew determine measured size. Current plus historical relations incur these
costs independently. Existing account/order/revision indexes remain additional
storage and write amplification.

Typical 30-item pages with 600-byte previews produce about 9 MB/s at 500 reads/s.
Worst-case 8 KiB previews plus 64 KiB notes can exceed 2 MiB per default page;
the contract bounds items and field bytes but deployment must separately cap
byte-rate and concurrent serialization memory. No production throughput is
inferred from small local fixtures. Monitor lock wait, pool queue age, WAL bytes,
replica lag, cold-index p99, response bytes and per-account write skew. Hash
partitioning by account preserves request locality and account-local uniqueness;
at multi-node placement, coordinate native owner deletion and concrete-reference
validation through an explicit cutover, rather than silently replacing FKs with
unverified IDs. Source/owner placement and archival policy require deployment
qualification before the 3B estimate becomes an operational capacity claim.

PostgreSQL does not automatically index referencing columns. The partial reverse
indexes make owner deletion checks selective rather than corpus scans; see the
[PostgreSQL foreign-key guidance](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK).
