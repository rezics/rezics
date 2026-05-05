## 1. Search Package — Index Definition

- [x] 1.1 Add a single named constant `PROGRESS_BUCKET_COUNT = 10` (and a derived `bucketize(progress: number): number` helper) in `package/search/src/` and export from the package entry point.
- [x] 1.2 Define the `user_unit_progress` index name and document type (`{ id, userId, unitId, status, progressBucket, lastSeenAt }`) in `package/search/src/`.
- [x] 1.3 Wire the index into the existing index-init code path (filterable attributes: `unitId`, `userId`, `status`, `progressBucket`; sortable: `lastSeenAt`; primary key: `id`).
- [x] 1.4 Confirm the boot-time settings application is idempotent against an existing index that already has the expected settings.

## 2. Search Package — Sync Helpers

- [x] 2.1 Add `syncProgress(row: UserUnitProgressRow)` to `package/search/src/sync.ts` that maps the row to the document shape (including `bucketize(row.progress)` and unix-second `lastSeenAt`) and calls `addDocuments` on the new index.
- [x] 2.2 Add `removeProgress(userId, unitId)` to the same file that calls `deleteDocument` by composite id.
- [x] 2.3 Implement bounded retry around the Meilisearch call (e.g., 3 attempts with backoff); log a structured error including `(userId, unitId)` on exhaustion and continue without throwing.
- [x] 2.4 Add unit tests for `bucketize` covering boundaries (`0.0`, `0.0999...`, `0.1`, `0.5`, `0.9`, `0.9999...`, `1.0`) and a few mid-range values.

## 3. Server — Stats Endpoint

- [x] 3.1 Add a Typebox schema for the stats response (`{ viewerCount, statusCounts, bucketCounts }`, with `bucketCounts` constrained to `Array(10)`) in `package/contract/`.
- [x] 3.2 Add `progressStats(unitId)` to `package/server/src/progress/progress.service.ts`: issues one Meilisearch search filtered by `unitId` requesting `facetDistribution` for `status` and `progressBucket` and `estimatedTotalHits`; normalizes missing facet values to `0`; produces a fixed-length-10 `bucketCounts` array.
- [x] 3.3 Add `GET /units/:unitId/progress-stats` to `package/server/src/progress/progress.api.ts` (or a co-located file), wired to the service method and the contract schema. Apply the project's existing public-read policy.
- [x] 3.4 Add a TanStack Query hook `useUnitProgressStats(unitId)` in `package/api/`.

## 4. Server — Sync Hook from Progress Service

- [x] 4.1 In `package/server/src/progress/progress.service.ts` (from sibling change `add-user-unit-progress`), call `syncProgress(row)` after a successful `upsert` commit and `removeProgress(userId, unitId)` after a successful `delete` commit.
- [x] 4.2 Ensure the sync call runs only after Postgres commit and never inside the transaction.
- [x] 4.3 Confirm a Meilisearch failure does not surface to the API caller (the helper swallows after retry; service still returns success).

## 5. Backfill Script

- [x] 5.1 Add a one-shot script under `package/search/bin/` (or the equivalent location used by other one-shot scripts) that batches over `UserUnitProgress` (e.g., 1000 rows per batch) and calls `syncProgress` on each.
- [x] 5.2 Make the script idempotent (re-running yields identical state) and resumable from interruption (no required global lock).
- [x] 5.3 Document the script's invocation and intended use (initial backfill / drift repair) inline in the script header.

## 6. Validation

- [x] 6.1 Add an integration test (or a smoke script if integration test infra is unavailable here) that: writes a few `UserUnitProgress` rows through the server upsert API; queries `GET /units/:unitId/progress-stats`; asserts the returned counts and bucket distribution match the inputs.
- [ ] 6.2 Run `bun test` inside `package/search/`, `package/server/`, `package/contract/`, and `package/api/`; confirm passing.
- [ ] 6.3 Run `bunx tsc --noEmit` per affected package; confirm clean.
- [x] 6.4 Run `bun run check:convention` and confirm passing.
- [x] 6.5 Run `openspec validate add-progress-search-index` and confirm the change is well-formed.
