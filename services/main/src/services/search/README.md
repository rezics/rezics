# Search service

PostgreSQL is authoritative for domain state, permissions, residual relational predicates,
facets, totals, and response hydration. Meilisearch is the only full-text engine and produces an
ordered candidate-ID superset. Every candidate is re-authorized with current PostgreSQL state;
Meilisearch counts are never exposed as authorized counts.

`contracts.ts` owns runtime-validated current/history document versions. `field-registry.ts` owns
the engine-independent public field policy. `settings/*.json` is the immutable settings contract
for each projection generation. Search settings and document changes require a new index UID and
an explicit reconcile, verify, and promote sequence.

Two foreign-key-free ledgers are the only Sequin sources:

- `search_unit_projection_source` groups by Unit ID and retains deletion tombstones.
- `search_revision_projection_source` groups by revision ID so intermediate revisions cannot be
  coalesced.

The source registry and trigger coverage live in `projection-sources.ts` and the search projection
migration. Sequin configuration, enrichment SQL, transforms, and routing live under
`services/main/search`. Enrichment always reads the latest authoritative state, emits one complete
document, and routes missing/ineligible rows to an idempotent delete.

Keep routing implementations in their `.exs` files. Index UIDs are resolved in `sequin.yaml` and
passed to routing through sink `annotations`; the same anchored value configures the destination.
This keeps executable code independent of CLI-specific environment interpolation behavior.

`service.ts` scans bounded Meilisearch candidate batches, preserves their ordinality during
PostgreSQL hydration, and refills after stale/deleted/unauthorized candidates. Cursors bind the
active generation, normalized request hash, page size, and per-category scan state. An absent or
incompatible active current generation produces `503 SearchUnavailable`; it never appears as an
empty successful search.

Lifecycle commands:

```sh
task services-main:search:index -- prepare --projection current --index rezics_units_v2_20260721
task services-main:search:index -- reconcile --projection current --index rezics_units_v2_20260721
task services-main:search:index -- promote --projection current --index rezics_units_v2_20260721
task services-main:search:index -- retire --projection current --index rezics_units_v2_20260721
task services-main:search:config:check
```

`prepare` and `reconcile` are idempotent for an unchanged generation. They reject an attempt to
apply a different projection version or settings fingerprint to an existing UID. Promotion keeps
the previous active generation in `verified` state for rollback; only a non-active verified
generation can be retired. The reconciler holds a projection advisory lock, waits until Sequin's
logical slot passes the captured WAL watermark and its backfill is inactive, then checks document
count, runtime contracts, and sampled ledger revisions before setting `verified`.

Before removing a retired index, remove/disable its concrete sink through a reviewed
`sequin.yaml` deployment. Meilisearch dumps are the portable upgrade/restore format; same-version
snapshots are for fast restart recovery. A lost volume or logical slot is never attached to an
active pointer: declare a fresh UID/sink, run a full ledger backfill, reconcile, and explicitly
promote it. PostgreSQL remains the complete rebuild source.

History generation lifecycle is independent. Existing PostgreSQL history feeds, comparisons,
restore, and undo never call Meilisearch.
