## Context

The sibling change `add-user-unit-progress` lands the canonical fact source: one `UserUnitProgress` row per `(userId, unitId)`. That alone supports per-user reads ("my progress for this unit", "my recent reading list"). It does **not** support aggregate reads ("how many users viewed this unit", "what's the progress distribution"), and at our projected scale (10M+ units, web-novel heavy) we don't want to add a per-unit counter cache table or run Postgres `COUNT(*)` per request.

The codebase already runs Meilisearch in-process from the server (no CDC, no Debezium, no Kafka — `package/search/cdc/src/handlers/{book,unit}.ts` exist as 0-byte stubs and are not in use). Existing indexes (`units`, post search, realm search) are populated synchronously from the server's domain services through `package/search/src/sync.ts`. Meilisearch reports `estimatedTotalHits` and `facetDistribution` over arbitrary filters, which is exactly the shape of stats we need.

This change adds one more index to that pattern, following the existing in-process sync model.

## Goals / Non-Goals

**Goals:**
- Provide per-unit aggregate progress stats (viewer count, per-status counts, ten-bucket progress distribution) at request latency tolerable for the unit detail page.
- Use the existing Meilisearch instance and the existing in-process sync layer; introduce no new infrastructure.
- Keep the per-row write path's added cost bounded and predictable: at most one Meilisearch `addDocuments` call per `UserUnitProgress` upsert, fire-and-forget on the success path with bounded retry.
- Make the bucket count an explicit, locked constant (10), documented as costly to change.
- Keep stats queries independent from the list API — the list API stays at `{ hits, total }` for `units`, with no facet payload bolted on.

**Non-Goals:**
- A list API that returns facets alongside hits (explicitly off the table — separate request, separate concern).
- Catalog-wide ranking by viewer count ("most-read units across the whole library"). That requires either a periodic Postgres → counters batch or a different index shape; punted.
- Realm-aware progress segmentation. Progress is realm-agnostic; rating already lives in `ScoreAggregate` per `(unit, realm)`.
- Reaction / review / shelf counter unification — those services own their own counts; this change touches none of them.
- Replacing the existing Postgres-backed `Shelf`-driven "viewed" semantics. Shelf membership and progress remain orthogonal.
- CDC. The codebase deliberately does not use it; this change extends the in-process model.

## Decisions

### Why a new Meilisearch index instead of a Postgres counter cache

**Decision:** Add a new Meilisearch index `user_unit_progress`, one document per progress row.

**Why:** The product's stats questions ("how many viewers", "distribution by status / progress bucket") are facet queries with filters. Meilisearch is exactly an aggregation engine over a filtered set — `facetDistribution` returns counts per facet value, `estimatedTotalHits` returns the total. We already operate it in production. A counter cache table in Postgres would require:
- A new table with a hot row per popular unit (write contention).
- Per-write transactional updates spanning two tables (write amplification).
- A consistency story for crash recovery / reconciliation.
- Per-stat schema changes (add a new bucketization → new column + backfill).

The Meilisearch path replaces all of that with one index whose write path is already proven.

**Alternative considered — periodic batch job rolling Postgres aggregates into a `UnitStats` table:** rejected for now. The data freshness expectation for stats is loose (the user explicitly said "doesn't have to be precise"), so periodic batch is feasible, but it duplicates data we already have to synchronize for search anyway, and pre-batches add their own ops surface. We can add a periodic batch *later* if Meilisearch facet performance becomes the bottleneck — at that point, it would likely target catalog-wide rankings, not per-unit reads.

### Why one document per row (not pre-aggregated documents)

**Decision:** Each Meilisearch document represents one `UserUnitProgress` row, not a pre-aggregated per-unit summary.

**Why:** Pre-aggregating in Meilisearch would require: read-modify-write per progress event, transactional consistency across user shards, and a separate aggregation document schema per stat we want. By indexing rows, we make Meilisearch's facet engine do the aggregation at query time — which is what it's built for. Each user owns exactly one document for a given unit, so writes are partitioned by user with no shared state to race on.

### Why bucketization at write time, not query time

**Decision:** Compute `progressBucket` (integer 0..9) at sync time and index it as a filterable attribute. Do not store the raw float in Meilisearch.

**Why:** Meilisearch facets distribute by exact attribute value. Bucketing at query time isn't really supported (no range facets in Meilisearch v1.x in the way Elasticsearch has them). Bucketing at write time produces a clean integer attribute whose `facetDistribution` is the histogram we want, with no client-side bucketing needed.

**Trade-off:** The raw float lives only in Postgres. Any future need to "rebucket" (change boundaries, change bucket count) requires recomputing for every row and reindexing. We accept this; we lock the bucket count at 10 explicitly.

### Why exactly 10 equal-width half-open buckets

**Decision:** Buckets are `[0.0, 0.1), [0.1, 0.2), ..., [0.9, 1.0]` — ten half-open intervals except the last which is closed on both ends so that `progress == 1.0` lands in bucket `9`. Computation: `progressBucket = min(9, floor(progress * 10))`.

**Why:**
- Ten buckets give a histogram readable at a glance ("0%, 10%, 20%...90%+ done") and aligns with the user-facing percentage display.
- Equal width keeps the rule trivial — no per-domain rebucketing.
- Half-open avoids the `1.0` edge case ambiguity that closed-on-both-sides intervals create.
- 10 is large enough to convey shape (you can see "most viewers bounce in the first 10%"), small enough to render as a compact bar chart.

**Why locked:** Changing bucket count is a settings + bulk reindex of every progress row. We label this constant explicitly in code and in the spec.

### Document primary key

**Decision:** `id = ${userId}:${unitId}` (composite, string).

**Why:** Meilisearch requires a string/int primary key per document. The composite of the natural keys gives a deterministic id derivable from the source row, makes `addDocuments` an idempotent upsert (same id ⇒ overwrite), and makes `deleteDocument` straightforward.

**Trade-off:** Long-tail userIds and unitIds are UUIDs, so the id is ~73 chars. Negligible.

### Filterable / sortable attributes

**Decision:**
- Filterable: `unitId`, `userId`, `status`, `progressBucket`.
- Sortable: `lastSeenAt`.
- No searchable attributes (this index isn't queried by free text).

**Why:** Filterable gives us the four axes any stats question composes from. Sortable on `lastSeenAt` is cheap insurance for any "recent viewers of this unit" surface (not part of MVP but a natural follow-on). We don't need full-text search on this index.

### Sync triggers — in-process, fire-and-forget on success

**Decision:** From `progress.service.ts` (sibling change), the `upsert` and `delete` paths invoke a new `syncProgress(row)` / `removeProgress(userId, unitId)` helper exported from `package/search/src/sync.ts`. The Postgres write commits first; the Meilisearch call runs after the commit returns. Failures of the Meilisearch call are logged but do not fail the request.

**Why:**
- Failing the user-facing request because a stats projection couldn't be updated would be a worse UX than briefly stale stats.
- The pattern matches existing in-process sync calls for other indexes (units, posts, realms).
- Bounded retry within the helper handles transient Meilisearch unavailability; if the retry budget is exhausted, the row is added to a small in-memory dead-letter that the operator can flush via a manual reconcile script (out of scope for MVP if simple retry suffices).

**Alternative considered — block the user request on Meilisearch success:** rejected. Couples user-facing latency to a non-critical projection. Stats are explicitly allowed to be approximate.

**Alternative considered — a periodic reconciliation job to repair drift:** acknowledged as a follow-on. We add a lightweight reconcile script in tasks but keep it out of the spec for this change.

### Stats endpoint shape

**Decision:** `GET /units/:unitId/progress-stats` returns:
```
{
  viewerCount: number,                    // total docs filtered by unitId
  statusCounts: Record<status, number>,   // facetDistribution by status
  bucketCounts: number[]                  // length 10, indexed 0..9
}
```

**Why:** These three numbers cover the questions the user posed ("how many people viewed", "how many of them got how far"). The endpoint runs three field requests against Meilisearch — one filter+facet query is enough to retrieve all three (`facetDistribution` covers both `status` and `progressBucket`; `estimatedTotalHits` covers the count). Implementation collapses them into a single Meilisearch round-trip.

**On freshness:** the response is allowed to be approximate; the user explicitly accepted this. Documented in the spec.

### Why not use Meilisearch's existing `units` index for these stats

**Decision:** Don't try to fold progress facets into the `units` index.

**Why:** The `units` index has one document per unit. Per-unit progress aggregates would need to be denormalized into that document, which puts us right back into the read-modify-write counter problem we're trying to avoid. A separate index whose row-grain matches the source table is the correct shape.

### Why no list-API facet bundle

**Decision:** The unit list API returns only `{ hits, total }`. Stats are a separate request.

**Why:** Two reasons. First, the list query and the stats query have different filter shapes — the list filters units, the stats query filters progress documents within a single unit. Forcing both into one response would leak the indexing model into the API. Second, the unit detail page is the only surface that needs stats today, and it can issue stats requests in parallel with the unit fetch. Keeping the list API minimal also lets us evolve stats without touching list contracts.

## Risks / Trade-offs

- **Stats are approximate.** Meilisearch returns `estimatedTotalHits`, which can drift from the true count, and our async sync model means very recent writes may not be reflected. → Mitigation: explicit in the spec; not a regression — the user has accepted this. UI surfaces stats as "approximate".
- **Bucket count is hard to change.** Going from 10 to 20 buckets means a full reindex of every progress row. → Mitigation: lock it in a single named constant in `package/search/`; require an OpenSpec change to adjust; provide a one-shot reindex script template that future changes can crib from.
- **Meilisearch downtime breaks stats but not core writes.** Sync helper logs and retries; persistent failure leaves stats stale until the next successful sync touches each affected row. → Mitigation: a small reconcile script (run-on-demand) iterates `UserUnitProgress` and re-pushes documents to the index. Not run on a schedule by default.
- **One document per row at 10M units × N viewers.** Meilisearch handles this, but index size scales with active users × touched units. → Mitigation: monitor index size; if it grows past comfort, we can prune documents below a `lastSeenAt` cutoff (the row in Postgres remains as the canonical record).
- **No catalog-wide aggregate sort** ("top N most-viewed units"). Meilisearch facets answer per-filter questions, not "give me the top units by document count globally". → Mitigation: explicitly out of scope; if needed, add a periodic Postgres aggregate as a follow-on, queried directly.
- **Race-free by partition.** Each `(userId, unitId)` document has exactly one writer (the user themselves), and `addDocuments` is idempotent upsert by id. No distribution Json or shared accumulator to race on. → No mitigation needed; this is by design.

## Migration Plan

- Sequencing: this change ships **after** `add-user-unit-progress`. Reviewing the two together is fine; merging in order is required.
- Index settings (`primaryKey`, `filterableAttributes`, `sortableAttributes`) are applied at server boot via the existing index-init code path in `package/search/`.
- Backfill: a one-shot script under `package/search/bin/` (or analogous) iterates `UserUnitProgress` in batches and upserts documents into the new index. On a fresh environment with no existing rows, the script is a no-op.
- Rollback: drop the index, remove the new endpoint, revert sync calls in `progress.service.ts`. The Postgres source data is unaffected; the rollback is contained to the search layer.

## Open Questions

- How aggressively should we retry inside the sync helper before logging and giving up? Lean: 3 attempts with backoff, then dead-letter log line. Decided in implementation.
- Do we expose a `lastUpdatedAt` field on the stats response so the UI can show "stats from N seconds ago"? Probably not for MVP; revisit if support tickets ask for it.
- Should the reconcile script be wired as a slash command / npm script, or just dropped as a `bin/` entry? Defer to whatever convention `package/search/` already uses for one-offs.
