# Notification delivery and read state

Status: Accepted

Owner: Notifications

## Decision

A notification is a typed event with a recipient, actor, optional subject, and
kind-specific context. The write service accepts a closed discriminated union;
callers cannot persist an arbitrary event name or untyped reference bag. The
public API does not expose the stored JSON payload. It presents a correlated
`kind`, `context`, and `destination` union so generated clients must handle the
destination that is valid for that event.

Destination hydration validates recipient access in bounded batches:

- replies resolve to their Post;
- new followers resolve to the actor Profile;
- direct messages resolve only when the recipient participates in the
  conversation, with an exact Message anchor for new notification rows;
- report resolutions resolve only to a report owned by the recipient;
- Realm events resolve to the subject Realm;
- access invitations resolve only to the matching invitation and recipient;
  and
- ownership events resolve to the subject Unit.

Every visible row has a destination. If its referenced resource was removed,
its historical payload is invalid, or its current access check fails, the API
uses a recipient-scoped notification-details page rather than manufacturing an
unsafe or broken public URL. Existing direct-message rows without a Message ID
resolve to their conversation during the 1.4.0 cutover.

The notification row is a native link. Navigating an unread row starts an
idempotent read mutation without delaying navigation. The Web cache first
cancels overlapping notification/count queries, snapshots every matching
cache entry, marks the row read optimistically, and rolls back on failure before
refetching. The separate mark-read control remains available for people who
want to clear a notification without leaving the list. Mark-all uses the same
optimistic and rollback contract.

Unread count metadata remains an estimate contract because the aggregate is an
operational projection. The product displays the value as an ordinary badge
(`0` through `99+`); estimation metadata is not user-facing copy.

## Read-through watermark

`notification_recipient_stat` owns a nullable read-through tuple
`(read_through_created_at, read_through_id, read_through_at)`. The first two
fields use the same total order as notification keyset pagination. A row is
effectively read when it has a physical `read_at` or its tuple is at or below
the recipient watermark.

Marking all notifications read performs one newest-row index probe and one
recipient-state update. It does not rewrite notification history. Notification
delivery and mark-all take the same transaction-scoped advisory lock keyed by
recipient. If an insert began with an old transaction timestamp but commits
after mark-all, its `created_at` is moved just past the watermark while the lock
is held, so the newly committed notification remains unread. The advisory lock
is acquired before inserting the notification row; this avoids inverting the
notification-row/state-row order used by deletes and aggregate triggers.

Single-row read takes the target notification row lock before the recipient
state lock. It preserves the first physical read timestamp, treats a row below
the watermark as already read, and writes at most one notification row. The
aggregate trigger counts only physical unread rows above the watermark. The
operator reconciliation query applies the same predicate.

The three watermark fields have an all-null or all-present check and a temporal
check. They are introduced as nullable columns without a historical backfill.
The checks are installed `NOT VALID`: new writes are protected immediately,
while historical validation remains a separately scheduled operation.

## Workload assumptions

The capacity baseline is 500,000,000 notification rows and the forward estimate
is 3,000,000,000 rows. These are planning assumptions, not production
measurements:

- 90% of rows are visible in-app and payload JSON averages 160 bytes;
- list pages default to 30 and have a hard maximum of 100;
- a normal profile has tens to thousands of retained rows, while a long-tail
  recipient may have millions;
- cluster-wide peaks are 50,000 notification writes/s and 100,000 notification
  reads/s at the baseline, rising to 300,000 writes/s and 600,000 reads/s at the
  forward estimate after sharding;
- each database shard targets fewer than 10,000 notification writes/s;
- warm service-side p95 targets are 100 ms for a 30-row list, 75 ms for a
  single read, and 75 ms for mark-all, excluding internet latency; and
- recipient skew is adversarial: notification writes for one recipient may be
  much hotter than the median.

Deployment load tests must replace these assumptions with measured payload
widths, retention, write/read ratios, recipient skew, cache hit rates, and lock
wait distributions.

## Request, write, and memory costs

Lists use the partial
`(recipient_profile_id, created_at DESC, id DESC) WHERE in_app_visible` index.
Unread-only lists additionally use the equivalent partial index requiring
`read_at IS NULL`. Pagination is a tuple range over `(created_at, id)` and never
uses a deep offset. Each query reads at most 101 candidates and returns at most
100.

Hydration deduplicates at most 200 actor/subject Unit IDs and at most 100 each of
conversation, report, and invitation IDs. Those lookups run as a fixed set of
batched index queries rather than one query per notification. Request memory
and response construction are therefore bounded by the page maximum, not total
recipient or corpus history.

A normal delivery writes one notification, its indexes, one recipient aggregate
delta, and optionally one email outbox item. Mark-one updates at most one
notification plus one aggregate delta. Mark-all is `O(log recipient history)`
for the newest index entry and `O(1)` writes. No request scans or loads a whole
recipient inbox.

Notification deliveries for the same recipient intentionally serialize on one
advisory/state key; unrelated recipients remain concurrent. API quotas,
database-pool limits, and the durable email outbox provide backpressure. No
request creates an unbounded in-process queue. Multi-recipient maintenance
writers must acquire recipient keys in sorted order or split work into bounded,
retryable batches.

## Storage, growth, and partitioning

For planning, a notification heap tuple plus the recipient-time, unread,
deduplication, actor, subject, and primary lookup indexes is approximately
480 bytes per row at the assumed payload width:

| Relation shape | Planning bytes/row | 500 million | 3 billion |
| --- | ---: | ---: | ---: |
| notification plus indexes | 480 B | 240 GB | 1.44 TB |
| recipient read/count state | 160 B | profile-count dependent | profile-count dependent |

These figures exclude table/index free space, WAL, replicas, backups, retained
dead tuples, and temporary space for index maintenance. Provision at least 30%
free space in addition to those separate requirements, and remeasure the
variable JSON/payload distribution before procurement. A delivery commonly
updates six indexes or partial indexes plus one aggregate heap row, so WAL and
random-write capacity matter more than logical payload bytes alone.

At 500 million rows, every online path remains an index range or point lookup,
but a single primary must still be qualified with representative recipient
skew, cache pressure, vacuum, and replica lag. At 3 billion rows, hash-shard by
`recipient_profile_id`, colocating `notification_recipient_stat` and the
recipient's notification history. UUIDv7 IDs and tuple cursors remain valid
within the owning shard; no inbox request fans out across all shards. Terminal
history may move to recipient/time archival partitions after the retention
contract is defined.

Begin the partition/shard cutover no later than 150 million notification rows
per primary shard, 2 TiB primary data volume, 70% sustained I/O, or list p95
above 100 ms for three consecutive windows. A same-recipient hot key requires a
delivery coalescing or digest policy when it sustains 250 writes/s, recipient
lock-wait p95 exceeds 20 ms, or database-pool utilization exceeds 80% for five
minutes. Raising page limits or adding an unbounded queue is not a cutover.

The full aggregate reconciliation is an offline maintenance operation. At the
baseline it must run with an I/O budget against partitions; at 3 billion rows it
must reconcile one shard/partition at a time. Online requests never depend on
that scan.

## 1.4.0 API and migration cutover

The API response changes from a raw payload bag to the correlated
`context`/`destination` contract, and read mutations return an idempotency result
with the effective read timestamp. Deploy the API, generated clients, and Web
application together.

1. Stop pre-1.4.0 API and worker writers and take the deployment rollback
   backup.
2. Apply `20260811000000_notification_read_through_state.sql`. It adds only
   nullable state columns, installs staged checks, and replaces the recipient
   aggregate trigger; it does not rewrite the notification corpus.
3. Deploy the 1.4.0 API, regenerated clients, Web application, and workers as
   one coordinated release. Do not run mixed response contracts.
4. Verify recipient scoping for conversation/report/invitation destinations,
   mark-one idempotency, the insert-versus-mark-all race, aggregate parity,
   recipient lock waits, and replica lag.
5. Validate the two staged recipient-state checks with the integrity-constraint
   command after confirming maintenance I/O headroom, then resume writers.

Rollback means restoring the pre-cutover backup and complete pre-1.4.0 binary
set. The nullable columns require no data backfill, but there is no public API
compatibility alias for the removed payload response.

## Research basis

- PostgreSQL documents that `SELECT ... FOR UPDATE` locks selected rows until
  the transaction ends and that conflicting row writers wait:
  [explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html).
- PostgreSQL B-tree indexes can satisfy matching `ORDER BY` scans and partial
  indexes restrict maintained/searchable entries to their predicate:
  [indexes and ordering](https://www.postgresql.org/docs/current/indexes-ordering.html)
  and [partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html).
- TanStack Query's optimistic-update contract recommends cancelling overlapping
  queries, snapshotting cache state in `onMutate`, rolling back in `onError`,
  and invalidating after settlement:
  [optimistic updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates).
