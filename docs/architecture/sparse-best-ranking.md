# Sparse best ranking

## Decision

`best` is one materialized sort key. It is not an online recommendation model.
`new` is the authoritative Unit creation timestamp. Feed, Search, Reviews, and
lightweight recommendation surfaces share these two orderings.

The hourly worker reads only positive rows in the last seven days of
`recommendation_unit_signal_hourly`, applies a 24-hour exponential half-life,
resolves variants to their main Unit, and writes one positive score per active
Unit into an immutable `recommendation_snapshot`. A Unit with no positive score
has an implicit score of zero and is not stored in `unit_best_score`.

The resulting refresh complexity is proportional to recent positive activity,
not to the number of Units in the catalogue. The runtime no longer builds a
full Unit statistics snapshot, a per-profile signal/interest projection, or a
Unit edge graph. The legacy per-profile signal function remains as a no-op until
its callers are removed in a later function-definition migration, so event
writes no longer scale with `(profile, Unit, hour, signal kind)` cardinality.

## Ordered retrieval

The positive phase seeks this tuple:

```text
(snapshot_id, unit_kind, score DESC, unit_updated_at DESC, unit_id DESC)
```

The zero phase seeks this tuple from the partial public-Unit index:

```text
(unit_kind, updated_at DESC, id DESC)
```

When a request spans several Unit kinds, each kind performs an index-backed
Top-K seek and PostgreSQL merges those small streams. A request for 20 Books
therefore does not first scan globally popular Profiles, Posts, or other Unit
kinds. Keyset cursors carry the complete sort tuple and pin `best` pagination to
one immutable snapshot.

`new` uses the same per-kind merge over `(unit_kind, created_at, id)`. B-tree
indexes can be scanned in either direction, so one composite index serves both
ascending and descending timestamp requests where null ordering is not part of
the contract.

Text remains a Filter predicate backed by PGroonga. `unit_search_document`
stores `unit_kind`, and the PGroonga candidate function applies that boundary
inside its index scan before `ORDER BY ... LIMIT`. Its high-posting fallback
uses the same equality-leading public Unit index. Other selective Filter
relations continue to use the reverse candidate indexes owned by
`libraries/filter` and are intersected with the ordered source.

For a catalogue of 500 million Units, the intended first-page cost is
`O(m log N_kind + m k)`, where `m` is the small number of requested Unit kinds
and `k` is the bounded candidate window. It is not `O(N)`. Arbitrary residual
predicates still obey the 4,096-row scan ceiling; they may return a lower-bound
count and fewer than the requested page size instead of scanning the corpus.
Common dense routing dimensions must therefore remain source dimensions, and
selective relations must retain reverse candidate indexes.

## Migration and cutover

Migration `20260808000000_sparse_best_ranking.sql` is a v1 persisted-contract
change. It renames the sparse score table, backfills its Unit kind, builds new
indexes concurrently, adds the PGroonga kind boundary, replaces the internal
text-candidate function signature, and drops the three superseded projection
tables plus the legacy per-profile hourly signal table.

Use this cutover sequence:

1. Pause the API and recommendation worker, or route traffic to a maintenance
   response. The table rename and internal function replacement are not
   compatible with the previous binary.
2. Apply the migration with the normal five-minute migration statement budget.
   The Unit and score B-tree indexes and the PGroonga rebuild run concurrently;
   disk capacity must cover the replacement PGroonga index.
3. Deploy the API and worker built with policy `sparse_best_v2`.
4. Run the privilege reconciler, then `search:index check`.
5. Trigger one recommendation refresh and verify that an active snapshot has
   positive `unit_best_score` rows where recent signal exists.
6. Run `EXPLAIN (ANALYZE, BUFFERS)` for representative Book `best`, Book `new`,
   and Book text filters. Confirm `unit_best_score_kind_order_idx`,
   `unit_public_kind_updated_at_desc_idx`,
   `unit_public_kind_created_at_desc_idx`, or
   `unit_search_document_pgroonga_idx` owns candidate generation and that actual
   rows remain within the configured scan budget.
7. Resume traffic. Rollback requires restoring the pre-migration database
   backup and the previous binary together; the dropped projections are derived
   data and are not reconstructed by a down migration.
