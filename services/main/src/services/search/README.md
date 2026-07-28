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

## Filter semantics

- Search Feature expressions are specialized for each target category before engine compilation.
  Category predicates become constants, impossible Boolean branches are removed, and only fields
  reachable for that category are checked against `field-registry.ts`. Domain Search filter
  mappings must remain a supported subset of that registry; the capability contract test enforces
  this boundary.
- `kind` is the searchable content subtype, not the Unit storage type. It maps to the Unit kind
  for catalog Units, the Entity kind for Entities, the Post kind for Posts, and the reviewed
  subject's Unit kind for Reviews. Categories without a meaningful subtype do not expose this
  filter or facet.
- Realm and Tag filters are independent sibling predicates. A query containing one Realm and two
  included Tags means `realm = R AND tag = T1 AND tag = T2`; selecting a Realm never changes the
  meaning or scope of either Tag predicate.
- `realm-tag-vote` is a separate atomic relationship filter identified by `(realmId, tagId)` for
  each candidate Unit. The exact context identity may be pushed to Meilisearch, while score and
  vote-count bounds are always rechecked against the authoritative PostgreSQL aggregate.

Lifecycle commands:

```sh
task services-main:search:index -- check --projection current --index rezics_units_v7_20260728
task services-main:search:index -- prepare --projection current --index rezics_units_v7_20260728_143000
task services-main:search:index -- reconcile --projection current --index rezics_units_v7_20260728_143000
task services-main:search:index -- promote --projection current --index rezics_units_v7_20260728_143000
task services-main:search:index -- retire --projection current --index rezics_units_v7_20260728_143000
task services-main:search:config:check
```

Routine development startup only runs `check`; it never prepares, rebuilds, or promotes an index.
`prepare` declares a new generation and applies settings without copying documents. `reconcile`
waits for Sequin's incremental CDC stream and any explicit backfill, verifies the result, and marks
the generation `verified`. It reports progress every five seconds, fails a stable integrity
mismatch after a short grace period, and has a bounded timeout (30 minutes by default, configurable
with `--timeout-seconds`). A session advisory lock serializes lifecycle commands, while database
state changes use short transactions so waiting on Sequin never holds a long transaction open.

`prepare` and `reconcile` are idempotent for a healthy unchanged generation. They reject a changed
projection version or settings fingerprint, a failed/retired generation, and an index that exists
without matching PostgreSQL generation metadata. Promotion keeps the previous active generation in
`verified` state for rollback; only a non-active verified generation can be retired. Reconciliation
captures a PostgreSQL WAL watermark, waits until Sequin's logical slot passes it and its backfill is
inactive, then checks document count, runtime contracts, and sampled ledger revisions.

For local recovery after a database-only reset or a stale persistent index, run:

```sh
task --yes local:search:rebuild
```

This loopback-only command cancels target and malformed orphan backfills, deletes and recreates the
configured index, explicitly starts a Sequin source-table backfill, reconciles it, and promotes it.
It requires both the Task confirmation and the script's `--yes` guard and refuses non-loopback
PostgreSQL, Meilisearch, or Sequin endpoints. Use `task --yes local:reset` when resetting the local
application database so Sequin is stopped during the reset and search is rebuilt in the same
workflow. Do not run the database-only reset task directly.

Production remains incremental for an unchanged active generation: Sequin consumes committed WAL
changes and no full scan runs during application startup. A document contract or settings change
requires blue/green rollout with a fresh timestamped UID and matching sink: prepare the new index,
deploy the new sink while leaving the active sink running, explicitly backfill the new sink,
reconcile, then promote. Retain the previous verified generation and sink for the rollback window;
retire and remove them only after that window. The destructive `rebuild-local` action is never a
production rollout path.

Before removing a retired index, remove/disable its concrete sink through a reviewed
`sequin.yaml` deployment. Sequin's `initial_backfill` applies when a sink is first created; restarting
an existing persistent sink does not replay it. Meilisearch dumps are the portable upgrade/restore format; same-version
snapshots are for fast restart recovery. A lost volume or logical slot is never attached to an
active pointer: declare a fresh UID/sink, run a full ledger backfill, reconcile, and explicitly
promote it. PostgreSQL remains the complete rebuild source.

History generation lifecycle is independent. Existing PostgreSQL history feeds, comparisons,
restore, and undo never call Meilisearch.

## Product-facing search and shared queries

The search page exposes one everyday search surface: keywords, a small set of promoted filters,
and a link-style advanced-filter action. Advanced conditions are edited as an explicit boolean
expression and are rendered back on the main page as a read-only summary. Advanced editing is
strictly a frontend affordance: quick filters and the advanced builder submit the same
`SearchControlExpression`, and the server has no search mode. Search execution retains separate
result groups so category identity, category rank, and category-specific totals are not lost. The
Feed-item presentation distributes its page budget across the configured categories, interleaves
the authorized rank from each group into one stable mixed stream, and then hydrates canonical Feed
items.

Feed-item hydration is only a presentation choice. Callers of the shared Feed presentation must
send the execution surface explicitly: the Search page uses the Search sort profile even when it
renders canonical Feed cards, while Feed blocks use the Feed profile. Component appearance and
response shape never select between `relevance` and recommendation ordering. The Feed-item
response uses a shared page budget regardless of sort profile, while grouped execution budgets the
configured page size per category.

Shared queries are immutable, cursor-free `SharedSearchQueryDocument` values stored in
`shared_search_query`. PostgreSQL 18 generates the public bearer identifier with native
`uuidv7()`. Creation requires an authenticated profile; retrieval is public to anyone who has the
unpredictable link. A shared document stores display hints separately from executable state, and
the service recompiles the executable state on both write and read. Running a shared query always
uses the current viewer and current PostgreSQL authorization state. There are intentionally no
list or update endpoints, and pagination cursors are never persisted in a share.

API readiness includes the search dependency. It requires a configured Meilisearch endpoint, a
healthy Meilisearch process, and a current active projection generation; otherwise readiness
reports the optional search dependency as degraded rather than allowing a broken search surface to
look healthy or withholding unrelated application traffic.
