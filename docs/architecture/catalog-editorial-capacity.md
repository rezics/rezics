# Native catalog editorial content

Editorial summaries, Portable Text descriptions and images belong to the eight
native catalog owners. They are optional, language-specific and independent of
named forms. An editor cannot use this command to rename a resource or publish
as its subject Entity. Controller-authored Entity presentation retains its
separate `entity.publish` boundary.

Each owner has a current table and immutable revision table, both partitioned
into 64 hash partitions by `owner_id`. Every primary and foreign key includes
that placement key. An exact owner/language lookup prunes to one partition;
history is a descending `(owner_id, language, revision)` keyset. The database
captures the entire accepted head and rejects forged, changed or deleted history.

An identity permits at most 32 editorial language slots, including withdrawn
slots. Creating another slot takes the native owner lock before checking this
bound. Every edit checks both the native identity revision and the language
revision; restoring history appends a revision and rechecks current authority
and newly attached images. Images already attached to the same language and role
can remain when another authorized editor changes its text. Withdrawal retains
the language identity and history.

## Work and storage assumptions

The planning baseline is 500,000,000 rows **per potentially large relation**, with
a 3,000,000,000-row estimate. Owner distribution may be completely skewed to one
domain; the estimates do not divide demand evenly among the eight owners. With
64 partitions, one relation averages 7,812,500 or 46,875,000 rows per partition.
The 32-slot bound concerns one identity, not the corpus.

For a working storage scenario, assume 8,192 bytes of serialized description,
320 bytes of fixed row/summary data, 192 bytes of indexes and 256 bytes of TOAST
overhead per row: 8,960 bytes, or approximately 4.48 TB at 500 million and 26.88 TB
at 3 billion rows. History has its own cardinality: four snapshots per current
row would require approximately 17.92 TB and 107.52 TB respectively before
replicas, backups, WAL and operational headroom. These are budgeting assumptions,
not measured compression ratios. A maximum-sized corpus would require much more
storage; the maximum document size is an admission bound, not a typical width.

Assume 10,000 summary reads/s, 100 accepted edits/s and 99% reads concentrated in
1% of identities. A normal edit appends one history row, changes one current row,
increments one owner revision and appends one native change record. At the
8,960-byte scenario, current plus history alone is about 1.8 MB/s before indexes
and WAL. Hash partitioning distributes different identities; it cannot parallelize
simultaneous edits of one identity. An individual hot owner still serializes on
its revision lock.

The wire command admits at most 512,000 serialized bytes. PostgreSQL additionally
limits the stored description to 1 MiB and a snapshot to 1.1 MB. A current or
historical document request fetches one document. History pages fetch at most
100 metadata rows and never fetch their descriptions. Language discovery returns
at most 32 metadata rows. Batch card hydration admits at most 500 explicit IDs,
uses pages of 100, and chooses from at most 32 language slots per identity; it
reads summaries and avatar fields, not biographies. No recurring corpus scan or
whole-corpus cache is introduced.

## Qualification and growth

The intended lookup target is p95 below 50 ms for metadata and below 100 ms for
owner lock acquisition at the stated workload. These are targets pending a
representative load qualification. Record partition pruning, rows visited and
buffer reads with `EXPLAIN (ANALYZE, BUFFERS)` on exact, missing and hot owners,
32-language selection, and old/deep history keysets. Measure document width
distribution, WAL bytes/edit, current/history disk growth, lock waits, statement
timeouts, connection utilization and replica lag. Small functional fixtures
prove revisions and access rules; they do not certify these latency targets.

Provisioning must account for at least two data copies plus independent backup
and WAL retention, and keep 30% disk headroom. Alert before a shard reaches 70%
of its provisioned storage or sustained p95 lock wait exceeds 100 ms. The next
placement boundary is `(owner, owner_id hash bucket)`: copy bounded buckets,
verify current/history counts and checksums, fence writes for each bucket, then
switch the routing generation. Image/account references and their concrete
foreign-key guarantees require an explicit co-location or validated reference
catalog cutover before moving a bucket to another database. No remote-FK claim
is made for the present single-database installation. Historical documents may
move to an immutable archive only after exact revision reads, restoration,
retention and recovery have an equivalent validated implementation.

The current unreleased native baseline includes these tables directly. Existing
legacy installations are not upgraded by replaying it. Fresh-target installation
and separate offline import remain the authorized cutover procedure.

PostgreSQL's [partitioning documentation](https://www.postgresql.org/docs/current/ddl-partitioning.html)
describes partition pruning and the requirement that partitioned unique keys
include their partition keys. Local qualification must establish the actual
plans and maintenance cost of this schema.
