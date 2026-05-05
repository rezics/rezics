## Requirements

### Requirement: Progress fact source schema

The system SHALL persist a single `UserUnitProgress` row per `(userId, unitId)` pair as the canonical fact source for that user's interaction with that unit. The row MUST carry: a fractional `progress` value in the closed interval `[0, 1]`, a `status` enum (`BACKLOG` | `ACTIVE` | `PAUSED` | `COMPLETED` | `DROPPED`), a `completedCount` non-negative integer, a cumulative `totalTimeMs` non-negative integer, an opaque `lastPosition` string (nullable), `firstSeenAt` and `lastSeenAt` timestamps, and an optional free-form `extra` JSON payload. The pair `(userId, unitId)` MUST be the primary key.

#### Scenario: One row per user-unit pair
- **WHEN** a user has interacted with a given unit in any way recorded by the API
- **THEN** the system stores exactly one row keyed by `(userId, unitId)` and rejects any attempt to insert a second row for the same pair

#### Scenario: Out-of-range progress is rejected
- **WHEN** a write request specifies `progress` outside the closed interval `[0, 1]`
- **THEN** the system rejects the request with a validation error and does not modify the row

#### Scenario: Negative time delta is rejected
- **WHEN** a write request specifies a negative `addTimeMs`
- **THEN** the system rejects the request with a validation error and does not modify the row

### Requirement: Progress upsert endpoint

The system SHALL expose an authenticated `PUT /me/units/:unitId/progress` endpoint that performs a partial upsert of the caller's progress for the addressed unit. The request body MAY include any subset of `progress`, `status`, `completedCount`, `lastPosition`, `addTimeMs`, and `extra`. Provided fields among `progress`, `status`, `completedCount`, `lastPosition`, and `extra` MUST overwrite the stored value (last-write-wins), except that the system SHALL automatically increment `completedCount` by one when the stored status transitions from any non-`COMPLETED` status to `COMPLETED` and the request did not provide `completedCount`. The `addTimeMs` field, if present, MUST be added to the stored `totalTimeMs`. The system MUST set `firstSeenAt` to the current time on first creation and never modify it thereafter, and MUST set `lastSeenAt` to the current time on every successful write. The endpoint MUST require authentication and MUST scope writes to the calling user.

#### Scenario: First-time write creates the row
- **WHEN** an authenticated user calls the endpoint for a unit they have no existing progress row for
- **THEN** the system creates a row with the provided fields, sets `firstSeenAt` and `lastSeenAt` to the current server time, and defaults unspecified fields (`progress` to 0, `status` to `BACKLOG`, `completedCount` to 0, `totalTimeMs` to 0, `lastPosition` to null, `extra` to null)

#### Scenario: Progress reaching 1.0 coerces status to COMPLETED
- **WHEN** an authenticated user calls the endpoint with `progress >= 1.0` and does not explicitly set `status` to a different value
- **THEN** the system stores the row with `status = COMPLETED`, increments `completedCount` by one if the previous status was not `COMPLETED`, and does not modify any shelf row as a side effect

#### Scenario: Explicit completed count overrides automatic increment
- **WHEN** an authenticated user calls the endpoint with `status = COMPLETED` and `completedCount = 7`
- **THEN** the system stores `completedCount = 7` instead of applying an additional automatic increment

#### Scenario: Partial update preserves untouched fields
- **WHEN** an authenticated user calls the endpoint with only `progress` and `addTimeMs` for a unit they already have a progress row for
- **THEN** the system overwrites `progress`, increments `totalTimeMs` by `addTimeMs`, leaves `status`, `completedCount`, `lastPosition`, and `extra` unchanged, leaves `firstSeenAt` unchanged, and updates `lastSeenAt` to the current server time

#### Scenario: Cross-user write is rejected
- **WHEN** an authenticated user calls the endpoint
- **THEN** the system upserts only their own row and provides no mechanism through this endpoint to write progress for another user

#### Scenario: Unauthenticated request is rejected
- **WHEN** a request without valid authentication is made to the endpoint
- **THEN** the system rejects the request with an authentication error and does not create or modify any row

### Requirement: Progress retrieval endpoints

The system SHALL expose `GET /me/units/:unitId/progress` returning the caller's progress row for the addressed unit, and `GET /me/progress` returning the caller's progress rows ordered by `lastSeenAt` descending with cursor-based pagination. The list endpoint MUST cap page size server-side, MUST accept an opaque cursor for continuation, and MUST return rows belonging only to the calling user.

#### Scenario: Single-row fetch returns current state
- **WHEN** an authenticated user requests their progress for a unit they have a row for
- **THEN** the system returns the row with all fields, including `firstSeenAt`, `lastSeenAt`, and `totalTimeMs`

#### Scenario: Single-row fetch with no row returns absence, not error
- **WHEN** an authenticated user requests their progress for a unit they have never interacted with
- **THEN** the system returns a response indicating no progress row exists (a 404 or a `null`-typed body, per the contract) without surfacing it as a server error

#### Scenario: List ordered by recency
- **WHEN** an authenticated user lists their progress rows
- **THEN** the system returns rows ordered by `lastSeenAt` descending, paginated with a cursor, and the page size does not exceed the server cap

#### Scenario: List excludes other users
- **WHEN** an authenticated user lists their progress rows
- **THEN** the system returns only rows where `userId` equals the calling user, regardless of any client-supplied filter

### Requirement: Progress deletion

The system SHALL expose an authenticated `DELETE /me/units/:unitId/progress` endpoint that removes the caller's progress row for the addressed unit. Deletion MUST be idempotent — repeated calls for a unit with no row MUST succeed without error.

#### Scenario: Existing row is removed
- **WHEN** an authenticated user calls delete on a unit they have a progress row for
- **THEN** the system removes the row and a subsequent fetch for the same unit returns the no-row response

#### Scenario: Delete on missing row is a no-op
- **WHEN** an authenticated user calls delete on a unit they have no progress row for
- **THEN** the system responds successfully without raising an error

### Requirement: Concurrency-safe time accumulation

The system SHALL implement `totalTimeMs` updates as an atomic database increment so that concurrent upserts for the same `(userId, unitId)` from multiple clients do not lose time. Non-additive fields (`progress`, `status`, `lastPosition`, `extra`) under the same concurrency MAY follow last-write-wins semantics.

#### Scenario: Concurrent time deltas accumulate
- **WHEN** two writes for the same `(userId, unitId)` each carrying a positive `addTimeMs` arrive concurrently
- **THEN** the final stored `totalTimeMs` equals the prior stored value plus both deltas, regardless of arrival order

#### Scenario: Concurrent overwrites of progress resolve by last write
- **WHEN** two writes for the same `(userId, unitId)` each carrying a different `progress` value arrive concurrently
- **THEN** the final stored `progress` equals one of the two values (the last write committed) and the other write is discarded for that field

### Requirement: Index coverage for primary read paths

The system SHALL maintain a database index on `(userId, lastSeenAt DESC)` sufficient to serve `GET /me/progress` in time logarithmic in the user's row count, and an index on `(unitId, status)` sufficient to support per-unit, per-status retrieval without a full table scan.

#### Scenario: Continue-reading query is index-served
- **WHEN** the system serves `GET /me/progress` for a user with many rows
- **THEN** the query plan uses the `(userId, lastSeenAt DESC)` index and does not scan rows belonging to other users

### Requirement: User-level system shelf pointers

The system SHALL extend the `User` model with an `extra Json?` column. Within `extra`, the system SHALL store a `shelves` map whose keys are system-shelf `kindKey`s and whose values are the corresponding `Shelf.unitId` for that user. The four known system kindKeys are `favorites`, `backlog`, `active`, and `completed`. The system SHALL bootstrap all four shelves at user registration, populating `extra.shelves` in the same transaction as `User` creation. For pre-existing users with `extra = NULL` or a missing key in `extra.shelves`, the system SHALL lazy-create the missing shelf on first read and patch the resulting `unitId` into `extra.shelves`.

#### Scenario: Registration populates all four system shelves
- **WHEN** a new user completes registration
- **THEN** the system creates four shelves (one per system `kindKey`) in the same transaction as the `User` row, and writes their `unitId`s into `User.extra.shelves` keyed by `kindKey`

#### Scenario: Lazy-create populates missing pointer for pre-existing users
- **WHEN** a request needs a system shelf for a user whose `User.extra.shelves` is missing the corresponding key
- **THEN** the system creates the shelf with the corresponding `kindKey`, writes the resulting `unitId` back into `User.extra.shelves`, and proceeds with the original request using the new `unitId`

#### Scenario: System kindKeys are reserved for system shelves
- **WHEN** a user attempts to create a shelf with `kindKey` equal to `favorites`, `backlog`, `active`, or `completed`
- **THEN** the system rejects the request with a validation error and does not create a shelf

### Requirement: Progress and shelf are orthogonal stores

The system SHALL treat `UserUnitProgress` and `Shelf` / `ShelfItem` / `ShelfUnit` as independent stores. A write to `UserUnitProgress` MUST NOT create, modify, or delete any shelf row as a side effect. A write to a shelf row (collect, uncollect, reorder, kindKey change) MUST NOT create, modify, or delete any `UserUnitProgress` row as a side effect. Cross-user aggregate queries over progress state (e.g. how many users have a unit in a given status) SHALL be answered by the Meilisearch projection of `UserUnitProgress` (built by a sibling change), never by aggregating shelf membership.

#### Scenario: Progress upsert does not write to shelf
- **WHEN** an authenticated user calls `PUT /me/units/:unitId/progress` with any combination of fields, including the case where the upsert coerces `status` to `COMPLETED`
- **THEN** the system writes only to the `UserUnitProgress` row and makes no insert, update, or delete on any `Shelf`, `ShelfItem`, or `ShelfUnit` row

#### Scenario: Shelf collect does not write to progress
- **WHEN** an authenticated user adds a unit to one of their shelves through the existing shelf collect endpoints
- **THEN** the system writes only to the shelf-related rows and makes no insert, update, or delete on any `UserUnitProgress` row

#### Scenario: Frontend dual-write tolerates partial failure
- **WHEN** a client issues two independent requests (one progress upsert, one shelf collect) representing the same user intent and one of them fails while the other succeeds
- **THEN** the succeeding request is durable, the failing request can be retried independently, and no backend reconciliation is required for the system to remain correct from the perspective of either store
