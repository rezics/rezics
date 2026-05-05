## Why

With `UserUnitProgress` landing as a Postgres fact source (sibling change `add-user-unit-progress`), we still cannot answer aggregate product questions at scale: "how many users have viewed unit X", "what's the distribution of how-far-through they got", or "which units are people currently reading the most". Computing these via Postgres `COUNT` per request scales poorly past low-millions of rows; maintaining a per-unit counter cache table adds write contention and a separate consistency problem. Meilisearch already provides `facetDistribution` and `estimatedTotalHits` over filtered queries, and we already use it for unit/post/realm search. Indexing progress rows there gives us aggregate stats as a side effect of the same query engine, with no per-unit counter table to maintain.

## What Changes

- Add a new Meilisearch index `user_unit_progress` storing one document per `UserUnitProgress` row.
- Document shape: `id` (string, `${userId}:${unitId}`, primary key), `userId`, `unitId`, `status`, `progressBucket` (integer 0..9), `lastSeenAt` (unix seconds, sortable).
- `progressBucket` is computed from `progress` as ten equal-width half-open buckets over `[0, 1]` (`floor(progress * 10)`, clamped so `progress == 1.0` falls into bucket `9`). The bucket count is **fixed at 10** for the lifetime of the index — changing it would force a full reindex with downtime.
- Filterable attributes: `unitId`, `userId`, `status`, `progressBucket`. Sortable attribute: `lastSeenAt`.
- Extend the existing in-process search sync layer (`package/search/src/sync.ts`) with progress-row sync helpers; the server invokes them inline from the `UserUnitProgress` upsert/delete paths defined in the sibling change. No CDC, no Kafka, no background worker.
- Add a new server stats endpoint `GET /units/:unitId/progress-stats` returning `{ viewerCount, statusCounts: Record<status, number>, bucketCounts: number[] /* length 10 */ }`. The endpoint composes facet/total queries against the new index — no Postgres COUNT.
- Add a corresponding TanStack Query hook in `@rezics/api`.
- This change does **not** touch the unit list API; list responses continue to return only `{ hits, total }` per the previously-decided shape. Stats are a separate request, made by the unit detail page when needed.

## Capabilities

### New Capabilities
- `progress-search-index`: the Meilisearch projection of `UserUnitProgress`, the bucketization rule, the sync triggers, the stats query surface, and the index settings (filterable / sortable attributes, primary key).

### Modified Capabilities
(none — `content-sync` and `meili-partial-sync` describe the existing unit/post/realm sync flow; the new progress index is additive and follows the same pattern without changing their requirements. If implementation finds we must alter their stated behavior, that delta will be added during apply.)

## Impact

- Affected packages:
  - `package/search` — new index settings, new sync helpers in `src/sync.ts`, new bucketization helper.
  - `package/server` — new `progress-stats` endpoint (likely co-located with the `progress/` domain from the sibling change), invocation of the new sync helpers from `progress.service.ts` upsert/delete paths.
  - `package/contract` — new Typebox schema for the stats response.
  - `package/api` — new TanStack Query hook.
- Operational: Meilisearch instance must accept a new index; settings (filterableAttributes, sortableAttributes, primaryKey) applied at boot via the existing index-init pattern.
- Backward compatibility: purely additive. No existing index, route, response shape, or client code changes. Sequencing requires `add-user-unit-progress` to land first (this change consumes its model and service).
- Backfill: on first deploy, existing `UserUnitProgress` rows (if any) are bulk-inserted into the new Meilisearch index via a one-shot script. From the sibling change's perspective the table is brand-new, so initially the backfill set is empty — the script still ships so it works for any environment that already had the table.
