# Sparse best ranking

## Native execution contract

The current installation uses the fresh native baseline. Logical references carry an owner and identity; there is no global Unit table or Variant collapse. Feed, Search, Reviews and recommendation surfaces use native owner/shape selectors. Positive ranking reads immutable sparse scores; zero-score candidates come from each owner's indexed public rows. Request admission, residual scan ceilings, viewer preferences and current visibility checks remain separate from score construction.

The scheduler admits at most one build at a time, at least one hour apart for a policy. It fixes a closed-hour source watermark and reads positive hourly signals from the preceding seven days with a 24-hour exponential half-life. Signals arriving or changing during construction affect a subsequent build; the watermark defines the window, not a claimed upstream transaction snapshot. Once published, score rows cannot be updated.

Both signal and score relations have 64 physical hash partitions on unit_id. Primary and unique keys contain unit_id, so PostgreSQL can enforce their existing uniqueness on this layout. The worker names one checked physical signal child per lease; it does not attempt to reproduce PostgreSQL's hash in application code. One unit's signal rows therefore belong to one worker partition.

Each admitted snapshot has exactly 64 control rows. A worker tick claims at most four partitions with SKIP LOCKED. Every claim changes a token and generation, expires after 30 seconds, and advances at most 4,096 signal rows. The native score writes and exact (bucket_start, unit_id, kind) cursor commit together in a transaction limited to 20 seconds. Failure rolls back both; a lost or expired lease cannot publish a cursor. Reclaim resumes the committed cursor rather than replaying accumulated scores. Twelve consecutive batch failures or a two-hour build deadline fail the snapshot. The previous ready snapshot remains available throughout construction.

Activation checks all 64 terminal cursors in one transaction and switches the single active snapshot. Database guards prevent partial activation, backward cursors, changed snapshot inputs and post-publication score writes. The recurring worker advances short batches every second; the configured refresh interval controls admission, not how long it waits between batches. The operational CLI drives the same durable protocol with a deadline.

## Retrieval and retention

The positive ordering index starts with (snapshot_id, unit_owner, unit_shape), followed by score, native updated time and identity. Selectors that omit shape use the owner index; globally mixed results use the global score index. Keyset cursors retain the entire ordering tuple and snapshot identity. Each physical partition has the same indexes, allowing bounded top-K merge reads. Negative visibility, content-rating and selected-authority checks apply again when serving results.

Inactive snapshots have a four-hour retention window; an active snapshot survives until replacement. Newly resolved recommendations fall back once the active snapshot is three hours old. A page pinned to an expired snapshot must restart against a current ordering. This replaces the old 72-hour copy retention, which multiplied sparse-score storage unnecessarily in this breaking installation.

Maintenance visits four expired snapshots, deleting at most 10,000 score rows from each, plus at most 10,000 event and 10,000 hourly-signal rows per tick. SKIP LOCKED permits independent maintenance workers without duplicate row ownership. A live build protects the beginning of its input window from signal expiry. Maintenance fails an expired build before releasing that protection. More than 16 expired snapshots awaiting cleanup stops new admissions; stale readiness exposes the resulting pressure rather than allowing unlimited snapshot copies.

## Workload and capacity model

These are planning inputs, not measured production throughput. Qualify both dispersed units and a hot-unit distribution with the real SQL fixture before accepting a deployment.

- Target workload: 100 ranking requests/second per API shard, page size 20, bounded candidate windows; 1,000 aggregated signal changes/second across the deployment. Hourly signal keys are unique per unit/hour/kind. Ten kinds and 168 hours bound one unit to 1,680 retained keys; popular-unit write contention must still be measured separately.
- Physical cardinality: 500,000,000 rows in either growing projection is the minimum estimate; also size for 3,000,000,000. A uniform 64-way placement is about 7.8 million or 46.9 million rows per partition. The four-hour ready-copy policy and one concurrent build must be included when translating active units into total score rows.
- Signal-row planning allowance: approximately 350 bytes including its heap tuple, logical/concrete identity, primary key, time/positive indexes, one populated native reverse index and free space. This is about 175 GB at 500M or 1.05 TB at 3B before replicas, WAL, temporary work and bloat.
- Score-row planning allowance: approximately 600 bytes including heap, concrete reference and six ordering/reverse indexes. This is about 300 GB at 500M or 1.8 TB at 3B. A worst case with every recent unit positive requires several full copies under retention; do not size storage from the one-percent-active example alone.
- Build work: 500M signal rows require about 122,071 batches; 3B require about 732,422. To finish inside two hours, aggregate sustained scan/write rates must exceed 69,445 and 416,667 signal rows/second respectively, plus headroom. At 64 busy partitions this corresponds to roughly 1,086 and 6,511 rows/second per partition. Batch benchmarks determine required CPU, IOPS, worker count and whether the two-hour target is satisfied.
- Memory follows four bounded batches per worker process, not the corpus. A batch materializes at most 4,096 signal rows and bounded native lookups. Sorting is limited to a batch or the requested index stream. Partial-index maintenance, native FK checks, score index writes, WAL and replicas are real amplification costs and must appear in measured byte/IO rates.
- Maintenance must drain faster than incoming retained data expires. At the configured ten-second tick, one process offers at most 4,000 expired score rows and 1,000 event/signal rows per second, before actual SQL latency. Add independent maintenance processes when observed expiry rates exceed this; retention backpressure prevents an unlimited queue.

Observe batch p50/p95/max duration, signal rows/second, expired/reclaimed leases, consecutive failures, unfinished partition count, active snapshot age, oldest expired snapshot, expired-row backlog, table/index bytes, WAL rate and disk headroom. Sustained batch duration near 20 seconds, active age above three hours, retention admission blockage, or cleanup below expiry rate is an operational failure signal.

If representative measurements miss the 500M target, optimize the native hydration/write batch before increasing limits. Placement is already partitionable by unit identity; a further routing epoch can split physical partitions and matching control buckets or move co-located native identities/signals/scores to additional database shards. That requires a qualified exporter, routing and query fan-out change, not a claim that adding application workers alone increases one database's I/O capacity. Do not claim the 3B throughput estimate has passed without measured evidence.

## Qualification

The durable SQL qualifier covers concurrent claims, expiry and generation fencing, a continuation across the 4,096-row boundary, rollback of scores with a failed cursor, exact replay, complete activation and immutable published scores. It also records representative EXPLAIN and elapsed batch timing. Fresh baseline replay and canonical schema equality qualify installation separately. Neither a small fixture nor static TypeScript is a production capacity benchmark.
