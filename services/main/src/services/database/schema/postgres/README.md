# Canonical PostgreSQL and physical partitions

`manifest.ts` owns canonical functions, static trigger declarations and bounded
dynamic trigger families. `check-postgres-schema.ts` compares migrated definitions,
drops every owned trigger in a rollback transaction, reconstructs canonical SQL,
and compares full definitions and enabled status. This proves that DO-block
triggers were recreated, including argument lists and deferred leaf constraints.
Inherited triggers are checked against their parents on every physical child.

The `catalog_native_source_event_batch` migration bundle installs native history,
governance, source and relay contracts. Its `.before-canonical.sql` overlay runs
after Atlas's parent-table diff and before canonical SQL. Atlas Community omits
children; this ordering ensures that source leaf constraint triggers have concrete
tables to attach to. Existing `.post.sql` overlays still run last. Generate through
`task services-main:db:generate -- catalog_native_source_event_batch`; never edit
the resulting migration manually.

The bundle's `.pre.sql` overlay drops only the four preexisting source parents
(record, snapshot, mapping claim, adoption proposal) and seven preexisting native
source-binding tables. This is a destructive fresh-target replacement, not an
in-place source-data conversion. `CASCADE` removes inbound foreign keys so the
typed diff can recreate their target keys; it does not request removal of their
owning native/support tables. New source UUIDs use deterministic natural-key
derivation. Existing native support referencing discarded evidence is not assumed
convertible, and retaining those rows is not promised. The stopped site's legacy
records remain a separate offline migration input. Generation and verification
use the explicitly disposable target; this workflow does not authorize operating
on the ordinary development database. Released SQL remains immutable.

## Source placement and capacity assumptions

The typed exporter assigns 64 hash partitions to each growing source family:
record on `id`; snapshot, mapping, binding revision, check receipt, proposal,
subscription, observation fan-out and eight native source-binding tables on
`source_record_id`; scheduled check plan on `routing_bucket`. Every primary and
unique key contains its partition key. Source record IDs have a database-checked
deterministic natural-key hash, so uniqueness is routed through `id` rather than
an incompatible global natural-key unique index. Hash collision rejection is
preferable to merging distinct natural identities.

Operational outbox, task intent, application receipt and pending relay each use
64 nonoverlapping ranges covering 1,024 routing buckets. Outbox has three inherited
row triggers, task and receipt have two each, and relay has none. Deferred source
binding consistency triggers live on all 640 source mapping/revision/native-binding
leaves, because PostgreSQL constraint triggers require plain tables. PostgreSQL
[partitioning rules](https://www.postgresql.org/docs/18/ddl-partitioning.html)
and [trigger rules](https://www.postgresql.org/docs/18/sql-createtrigger.html)
define these constraints.

For each 500M-row source family, uniform placement averages 7.8125M rows per leaf;
3B rows average 46.875M. At the existing illustrative proposal budget of 352 bytes
per row including indexes, these are 2.75 GB and 16.5 GB per leaf (176 GB and
1.056 TB total). Three 400-byte snapshots per record increase this to 23.4375M
and 140.625M rows, or 9.375 GB and 56.25 GB per leaf. These estimates exclude WAL,
replicas, retained object payloads, maintenance reserve and skew; they are not
measurements or production capacity qualification.

Record-key reads prune to one leaf; scheduler claims must include a routing bucket.
Reverse native lookups and owner enumeration can fan out to all 64 source leaves;
they require bounded pages and measured plans. A hot record remains one hot key,
so partitioning does not remove locking, provider-budget or fan-out admission
requirements. Reuse the catalog workload starting point of 100 reads/s, 20 writes/s,
32 clients and 5x bursts, and measure cold/warm p95/p99, buffers, index/WAL write
amplification, memory, network, lock waits, queue age and maintenance duration.
External payload and durable-work queues need their own retention/backpressure
budgets. The 64 physical leaves are initial placement, not an ultimate capacity
ceiling: routing epochs and source-record ownership support an explicit shard
cutover with reference validation and bounded copy/checkpoint batches. Cross-database
foreign-key replacement and recovery qualification remain required before such a
cutover; local DDL replay does not prove those properties.
