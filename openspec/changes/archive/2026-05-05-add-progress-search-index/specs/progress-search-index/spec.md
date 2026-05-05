## ADDED Requirements

### Requirement: Progress search index existence and document shape

The system SHALL maintain a Meilisearch index named `user_unit_progress` whose documents project rows of the Postgres `UserUnitProgress` table. Each document MUST carry the fields `id`, `userId`, `unitId`, `status`, `progressBucket`, and `lastSeenAt`. The document `id` MUST be the deterministic composite `${userId}:${unitId}` and MUST be the index's primary key, ensuring at most one document per `(userId, unitId)` pair. `lastSeenAt` MUST be stored as a value sortable by Meilisearch (a unix timestamp in seconds).

#### Scenario: One document per user-unit pair
- **WHEN** the search index reflects the current state of the database
- **THEN** for any `(userId, unitId)` present in the Postgres source there is exactly one document with `id = ${userId}:${unitId}` in the index, and no document exists for any pair absent from the source

#### Scenario: Document write is an upsert by id
- **WHEN** the system pushes a document with an `id` that already exists in the index
- **THEN** the prior document is overwritten in full and no duplicate document is created

### Requirement: Progress bucketization

The system SHALL compute the `progressBucket` field as `min(9, floor(progress * 10))` over the source row's `progress` value, producing an integer in the closed interval `[0, 9]`. The bucket count MUST be exactly ten and MUST be defined as a single named constant in the search package; changing the bucket count is a breaking change that requires a full reindex and a corresponding OpenSpec change.

#### Scenario: Boundary value zero
- **WHEN** the source row has `progress = 0.0`
- **THEN** the indexed document has `progressBucket = 0`

#### Scenario: Boundary value one
- **WHEN** the source row has `progress = 1.0`
- **THEN** the indexed document has `progressBucket = 9`

#### Scenario: Mid-range bucketing
- **WHEN** the source row has `progress = 0.27`
- **THEN** the indexed document has `progressBucket = 2`

#### Scenario: Bucket count is a single named constant
- **WHEN** an engineer searches the codebase for the literal `10` used as a bucket count
- **THEN** there is one named constant in the search package that all bucketization code reads from, and no scattered duplicates of that literal

### Requirement: Index settings

The system SHALL configure the index with `unitId`, `userId`, `status`, and `progressBucket` as filterable attributes, and `lastSeenAt` as a sortable attribute. The index MUST NOT be configured with searchable attributes (this index is not queried by free text). Settings MUST be applied at server boot using the same index-initialization mechanism the project uses for other Meilisearch indexes.

#### Scenario: Filterable attributes are applied at boot
- **WHEN** the server boots against a fresh Meilisearch instance
- **THEN** the `user_unit_progress` index reports `unitId`, `userId`, `status`, and `progressBucket` among its filterable attributes before any user-facing request is served

### Requirement: Synchronous sync from progress service

The system SHALL update the Meilisearch `user_unit_progress` index from the server's `UserUnitProgress` upsert and delete code paths in-process. After the Postgres write commits, the service MUST invoke the search package's `syncProgress` (for upsert) or `removeProgress` (for delete) helper for the affected row. The helpers MUST NOT cause the user-facing request to fail when Meilisearch is unavailable; failures MUST be logged with the affected `(userId, unitId)` and bounded retry MUST be applied.

#### Scenario: Successful upsert reaches the index
- **WHEN** a user successfully upserts their progress for a unit
- **THEN** the Meilisearch document with `id = ${userId}:${unitId}` reflects the new `status`, `progressBucket`, and `lastSeenAt` values within a bounded retry window

#### Scenario: Delete removes the document
- **WHEN** a user successfully deletes their progress for a unit
- **THEN** the Meilisearch document with `id = ${userId}:${unitId}` no longer exists in the index within a bounded retry window

#### Scenario: Meilisearch failure does not break the user request
- **WHEN** Meilisearch is temporarily unavailable during a progress upsert
- **THEN** the user-facing upsert response succeeds (the Postgres write is durable), the failure is logged, and bounded retry is attempted; the request is not failed because of the projection failure

### Requirement: Per-unit stats endpoint

The system SHALL expose `GET /units/:unitId/progress-stats` returning aggregate progress statistics for the addressed unit, computed by querying the `user_unit_progress` index filtered by `unitId`. The response body MUST be of shape `{ viewerCount: number, statusCounts: Record<Status, number>, bucketCounts: number[] }`, where `bucketCounts` MUST be an array of length 10 indexed by `progressBucket`. Missing facet values for a status or bucket MUST be reported as `0`. The endpoint MUST NOT issue Postgres `COUNT(*)` queries for these statistics; the Meilisearch index is the single source of these aggregate numbers.

#### Scenario: Unit with no progress rows
- **WHEN** a client requests stats for a unit no user has progressed against
- **THEN** the response is `{ viewerCount: 0, statusCounts: { VIEWED: 0, READING: 0, COMPLETED: 0, DROPPED: 0 }, bucketCounts: [0,0,0,0,0,0,0,0,0,0] }`

#### Scenario: Unit with mixed progress rows
- **WHEN** a unit has, in source: 3 users with `status = READING` at progress values `{0.05, 0.27, 0.84}` and 1 user with `status = COMPLETED` at `1.0`
- **THEN** the response reports `viewerCount: 4`, `statusCounts.READING: 3`, `statusCounts.COMPLETED: 1`, `bucketCounts[0]: 1`, `bucketCounts[2]: 1`, `bucketCounts[8]: 1`, `bucketCounts[9]: 1`, and zeros elsewhere (subject to the approximate-counts allowance below)

#### Scenario: Stats are allowed to be approximate
- **WHEN** the stats response is computed during a period of high write activity for the unit
- **THEN** the returned numbers are allowed to differ from the canonical Postgres counts by recently-written rows that have not yet propagated; the API contract documents this as approximate

#### Scenario: Endpoint does not require authentication beyond existing public-read policy
- **WHEN** the endpoint is consumed
- **THEN** it follows the project's existing public-read policy for unit-related read endpoints; it does not leak the identity of any individual viewer (it returns aggregates only)

### Requirement: Backfill and reconciliation

The system SHALL provide a one-shot backfill script that iterates the Postgres `UserUnitProgress` table in batches and upserts each row's projected document into the Meilisearch index. The script MUST be safe to re-run (idempotent), MUST not require downtime, and MUST be the operator's tool for repairing drift between Postgres and the index.

#### Scenario: Idempotent re-run
- **WHEN** the backfill script is run twice in succession against a database containing N progress rows
- **THEN** after both runs the index contains exactly N documents, one per source row, with values matching the source

#### Scenario: Drift repair
- **WHEN** the index has drifted from the source (some documents missing or stale due to prior sync failures) and the backfill script is run
- **THEN** after the script completes, every source row has a corresponding document with values matching the source

### Requirement: List API contract preservation

The system SHALL NOT bundle progress statistics into the unit list API response. Unit list responses continue to return only `{ hits, total }` (or the existing equivalent shape) and progress stats are exposed exclusively through the per-unit stats endpoint.

#### Scenario: Unit list response shape is unchanged
- **WHEN** a client requests a unit list with any filter combination
- **THEN** the response shape is identical to the response shape before this change; no `progressStats`, `viewerCount`, `bucketCounts`, or similar field appears
