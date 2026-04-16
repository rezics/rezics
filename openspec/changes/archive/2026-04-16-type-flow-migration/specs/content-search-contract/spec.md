## MODIFIED Requirements

### Requirement: Search result total count
Meilisearch search service functions SHALL use `estimatedTotalHits` (from `InfinitePagination`) instead of `totalHits` (from `FinitePagination`) when the search call uses `offset`/`limit` parameters.

The fallback chain `resp.totalHits ?? resp.estimatedTotalHits ?? resp.hits.length` SHALL be replaced with `resp.estimatedTotalHits ?? resp.hits.length`.

Affected files:
- `package/server/src/meili/content/content.service.ts`
- `package/server/src/meili/post/post.service.ts`
- `package/server/src/meili/realm/realm.service.ts`
- `package/server/src/meili/user/user.api.ts`

#### Scenario: Content search returns total from estimatedTotalHits
- **WHEN** a content search is performed with `offset: 0, limit: 20`
- **THEN** the returned `total` field is sourced from `resp.estimatedTotalHits`
- **AND** `tsc --noEmit` produces zero errors about `totalHits` not existing on the response type

#### Scenario: Fallback to hits length when estimatedTotalHits is missing
- **WHEN** the Meilisearch response does not include `estimatedTotalHits`
- **THEN** the returned `total` falls back to `resp.hits.length`
