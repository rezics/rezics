# Notification delivery and read state

Status: Accepted

Owner: Notifications

## Decision

A notification is a typed event with a recipient, actor, optional subject, and
kind-specific context. Its delivery recipient is an explicit private inbox or
admitted shared-inbox scope, not an inferred unique account behind a public Agent.
Inbox membership and current read authority are separate from public attribution;
representation alone does not copy private account notifications to other controllers. The write service accepts a closed discriminated union;
callers cannot persist an arbitrary event name or untyped reference bag. The
public API does not expose the stored JSON payload. It presents a correlated
`kind`, `context`, and `destination` union so generated clients must handle the
destination that is valid for that event.

Destination hydration validates recipient access in bounded batches:

- replies resolve to their Post;
- new followers resolve to the actor Agent;
- direct messages resolve only when the recipient participates in the
  conversation, with an exact Message anchor for new notification rows;
- report resolutions resolve only to a report owned by the recipient;
- Realm events resolve to the subject Realm;
- access invitations resolve only to the matching invitation and recipient;
  and
- ownership events resolve to the subject Resource.

Every visible row has a destination. If its referenced resource was removed,
its historical payload is invalid, or its current access check fails, the API
uses a recipient-scoped notification-details page rather than manufacturing an
unsafe or broken public URL. The earlier missing-Message fallback is recorded in
the [1.4.0 procedure](../releases/1.4.0.md#notification-cutover).

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
- an ordinary inbox has tens to thousands of retained rows, while a long-tail
  recipient may have millions;
- delivery/read rates are independent workload inputs, not sixfold consequences
  of the 500M-to-3B row ratio; the selected database needs measured admission
  budgets for ordinary recipients and hot inboxes;
- a hypothetical 50,000 deliveries/s retained for 30 days produces 129.6B rows.
  That fleet-scale envelope is not a capacity commitment for this deployment;
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

Hydration deduplicates at most 200 actor/subject Resource IDs and at most 100 each of
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
| recipient read/count state | 160 B | inbox-count dependent | inbox-count dependent |

These figures exclude table/index free space, WAL, replicas, backups, retained
dead tuples, and temporary space for index maintenance. Provision at least 30%
free space in addition to those separate requirements, and remeasure the
variable JSON/payload distribution before procurement. A delivery commonly
updates six indexes or partial indexes plus one aggregate heap row, so WAL and
random-write capacity matter more than logical payload bytes alone.

At both scales, online paths use selective recipient/time keys, with same-database
partitions chosen for recipient locality and retention. The read/count state and
history remain transactionally consistent; partition design must preserve the
uniqueness and FK guarantees. Terminal history can move to archival partitions
only under the inbox retention/disclosure contract. The current physical
`recipient_profile_id` adapter is an implementation detail to reconcile with typed
recipients before changing delivery behavior.

Qualify representative skew, cache pressure, vacuum, WAL and replica lag. Treat
70% sustained I/O, p95 list latency above 100 ms for three windows, and recipient
lock-wait p95 above 20 ms as provisional investigation/admission signals, not a
universal row-count threshold for another database. Coalescing/digest policy must
preserve the event meanings and explicit recipient preference. Raising page limits
or queue depth does not add database capacity.

Full aggregate reconciliation is maintenance work with a durable cursor and I/O
budget. It processes selected partitions/ranges independently and never gates an
ordinary read on scanning an inbox history. Cross-database placement is a separate
future decision; 3B rows alone neither requires it nor certifies this database.

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
