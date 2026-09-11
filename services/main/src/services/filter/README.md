# Backend Filter compilation

The compilers consume validated `@rezics/filter` predicates. Candidate sets are
internal query optimizations; callers still apply the complete predicate and
current resource authorization. A candidate ID is not permission to disclose
the object. Query owners supply bounded result/scan budgets and cursor context.

## Account-private Tag references

Private Tag authority accepts only the server's viewer context. The Filter
contract does not accept an arbitrary account or Entity ID for that authority.
Resolve the authenticated account's self Entity, not a selected organization;
the private `auth_entity` binding supplies the account key. Removing that binding
on closure prevents subsequent private traversal before background deletion.

`account_unit_tag` stores `(auth_user_id, target_reference_id, tag_id)` as its key.
Its target is one restrictive canonical reference FK. The Tag FK, direct-application
policy and content-label exclusion remain separate. A bounded reference-PK trigger
rejects self-tagging on insert and retargeting. Account erasure removes the private
relationship while shared reference values survive.

Both point predicates and candidate projections join `reference_value`. They
derive the native ID with the same `coalesce` expression as
`reference_value_native_id_idx`; native-ID conditions pushed through a candidate
projection can therefore use an index. Keep the concrete target partial indexes
for FK checks and allocation. The additional expression index grants no identity,
ownership or disclosure authority.

## Workload model

Plan for 500M and 3B private Tag rows. At an estimated 120 heap plus 240 index bytes
per row, the relation uses 180 GB and 1.08 TB before free-space, WAL, replicas and
backups. The 10,000-row fixture measured 104 tuple bytes and about 312 heap/index
bytes per row in its fresh sample; the planning estimate retains additional room. The primary key and three secondary indexes receive each row; no preview
payload is copied. Model three Tags per account/annotated target, multiplying by
each account's target count. Count distinct target references separately across
all accounts and consumers, rather than charging a new reference for every Tag.

Use 500 writes/s, 5,000 point checks/s and 100 candidate-page requests/s (up to 100
results each) as qualification scenarios, with a point-check p95 target of 100 ms.
These are targets, not measured production capacity. A point check uses the self
binding, native-reference expression index and account/target/Tag key. A write
adds one private row and four index entries, plus an allocation only for a new
shared reference. Distinct accounts do not share a mutation lock; Tag policy reads
share-lock the Tag while category-only transitions take a conflicting lock.

The 10,000-row hot-account fixture checks point lookup and native-ID predicate
pushdown using unforced EXPLAIN/BUFFERS, including a savepoint-rolled-back
comparison without the projection index. It does not qualify broad feed ranking,
whole-account exports or sustained corpus-scale load. Track query buffer reads,
p95 latency, account/Tag lock waits, private-row growth, reference-index growth
and erasure backlog. Account-hash partitioning is the growth path because the
unique key includes the account; target/Tag reverse operations need a bounded
partition fan-out and an explicit coordinated cutover. Reference-index registry
changes require rebuild space and time in the shared capacity budget.
