# user-unit-progress Specification

## Purpose

Defines the canonical `UserUnitProgress` row keyed by
`(userId, unitId)` that records each user's interaction with a
Unit. Owns the `progress ∈ [0, 1]` value, the
`BACKLOG / ACTIVE / PAUSED / COMPLETED / DROPPED` status enum,
soft-delete via `isDeleted`, the `completedCount` /
`totalTimeMs` counters, the opaque `lastPosition`,
`firstSeenAt` / `lastSeenAt` timestamps, and the per-status
`ProgressExtra` JSON shape exported from `@rezics/contract`.
## Requirements
### Requirement: Progress fact source schema

The system SHALL persist a single `UserUnitProgress` row per `(userId, unitId)` pair as the canonical fact source for that user's interaction with that unit. The row MUST carry: a fractional `progress` value in the closed interval `[0, 1]`, a `status` enum (`BACKLOG` | `ACTIVE` | `PAUSED` | `COMPLETED` | `DROPPED`), an `isDeleted` boolean used for soft deletion, a `completedCount` non-negative integer (full-book re-read counter; see "completedCount counts full-book re-reads"), a cumulative `totalTimeMs` non-negative integer, a nullable `lastReadNodeId` UUID foreign key to `ContentStructureNode.id` with `ON DELETE SET NULL` behavior, a nullable `lastReadAnchor` JSON value carrying an in-chapter resume snippet (see "lastReadAnchor JSON shape"), `firstSeenAt` and `lastSeenAt` timestamps, and an `extra` JSON payload constrained to a per-status domain map (the `ProgressExtra` shape). The pair `(userId, unitId)` MUST be the primary key.

The opaque `lastPosition` string previously specified by this requirement SHALL be removed entirely. The combination of `lastReadNodeId` and `lastReadAnchor` replaces it. Per-node manual completion marks are stored in `UserContentNodeProgress` (see `user-content-node-progress` capability), not in `UserUnitProgress`.

The `extra` payload SHALL conform to the following narrow schema (Typebox in `@rezics/contract`):

```ts
{
  paused?:  { reasonPostUnitIds: string[] },
  dropped?: { reasonPostUnitIds: string[] },
}
```

with `additionalProperties: false`. Additional per-status domains MAY be added in the future, but writes SHALL be rejected for unknown top-level keys. Reads SHALL be lenient: rows whose stored `extra` does not match the current schema (e.g., legacy `null`, `{}`, or unknown keys) SHALL be returned to clients with the unrecognized portions of `extra` stripped from the DTO.

#### Scenario: One row per user-unit pair

- **WHEN** a user has interacted with a given unit in any way recorded by the API
- **THEN** the system stores exactly one row keyed by `(userId, unitId)` and rejects any attempt to insert a second row for the same pair

#### Scenario: Out-of-range progress is rejected

- **WHEN** a write request specifies `progress` outside the closed interval `[0, 1]`
- **THEN** the system rejects the request with a validation error and does not modify the row

#### Scenario: Negative time delta is rejected

- **WHEN** a write request specifies a negative `addTimeMs`
- **THEN** the system rejects the request with a validation error and does not modify the row

#### Scenario: Extra with unknown top-level key is rejected on write

- **WHEN** a write request specifies `extra = { foo: { bar: 1 } }` where `foo` is not a recognized per-status domain
- **THEN** the system rejects the request with a validation error and does not modify the row

#### Scenario: Extra with valid per-status domain is accepted

- **WHEN** a write request specifies `extra = { paused: { reasonPostUnitIds: ["<uuid>"] } }`
- **THEN** the system stores the value as-is and returns it in subsequent fetches

#### Scenario: Legacy or unknown stored extra is sanitized on read

- **WHEN** a stored row contains `extra = { legacy: 1, paused: { reasonPostUnitIds: ["<uuid>"] } }`
- **THEN** the GET response SHALL surface only the recognized portion (`{ paused: { reasonPostUnitIds: [...] } }`) and SHALL NOT raise an error

#### Scenario: lastReadNodeId nulls out when the referenced node is hard-deleted

- **GIVEN** a `UserUnitProgress` row references `lastReadNodeId = "node-1"`
- **WHEN** the row at `ContentStructureNode.id = "node-1"` is hard-deleted from the database (administrative tooling or cascade from owner deletion)
- **THEN** the `UserUnitProgress` row SHALL remain
- **AND** `lastReadNodeId` SHALL be set to `null` by the database FK
- **AND** `lastReadAnchor` SHALL retain its previous value

### Requirement: Progress upsert endpoint

The system SHALL expose an authenticated `PUT /me/units/:unitId/progress` endpoint that performs a partial upsert of the caller's progress for the addressed unit. The request body MAY include any subset of `progress`, `status`, `completedCount`, `lastReadNodeId`, `lastReadAnchor`, `addTimeMs`, and `extra`. Provided fields among `progress`, `status`, `completedCount`, `lastReadNodeId`, `lastReadAnchor`, and `extra` MUST overwrite the stored value (last-write-wins), except that the system SHALL automatically increment `completedCount` by one when the stored status transitions from any non-`COMPLETED` status to `COMPLETED` and the request did not provide `completedCount`. The `addTimeMs` field, if present, MUST be added to the stored `totalTimeMs`. The system MUST set `firstSeenAt` to the current time on first creation and never modify it thereafter, and MUST set `lastSeenAt` to the current time on every successful write. The endpoint MUST require authentication and MUST scope writes to the calling user.

The request body SHALL NOT accept a `lastPosition` field; submitting one SHALL be rejected as an unknown property by the contract validator.

#### Scenario: First-time write creates the row
- **WHEN** an authenticated user calls the endpoint for a unit they have no existing progress row for
- **THEN** the system creates a row with the provided fields, sets `firstSeenAt` and `lastSeenAt` to the current server time, and defaults unspecified fields (`progress` to 0, `status` to `BACKLOG`, `completedCount` to 0, `totalTimeMs` to 0, `lastReadNodeId` to null, `lastReadAnchor` to null, `extra` to null)

#### Scenario: Progress reaching 1.0 coerces status to COMPLETED
- **WHEN** an authenticated user calls the endpoint with `progress >= 1.0` and does not explicitly set `status` to a different value
- **THEN** the system stores the row with `status = COMPLETED`, increments `completedCount` by one if the previous status was not `COMPLETED`, and does not modify any shelf row as a side effect

#### Scenario: Explicit completed count overrides automatic increment
- **WHEN** an authenticated user calls the endpoint with `status = COMPLETED` and `completedCount = 7`
- **THEN** the system stores `completedCount = 7` instead of applying an additional automatic increment

#### Scenario: Partial update preserves untouched fields
- **WHEN** an authenticated user calls the endpoint with only `progress` and `addTimeMs` for a unit they already have a progress row for
- **THEN** the system overwrites `progress`, increments `totalTimeMs` by `addTimeMs`, leaves `status`, `completedCount`, `lastReadNodeId`, `lastReadAnchor`, and `extra` unchanged, leaves `firstSeenAt` unchanged, and updates `lastSeenAt` to the current server time

#### Scenario: Submitting legacy lastPosition is rejected
- **WHEN** an authenticated user submits a body containing `lastPosition: { kind: "chapter", contentUnitId: "..." }`
- **THEN** the system SHALL reject the request with a validation error
- **AND** the row SHALL NOT be modified

#### Scenario: Submitting lastReadNodeId for a deleted node is rejected
- **WHEN** an authenticated user submits `lastReadNodeId` pointing at a `ContentStructureNode` with `isDeleted = true`
- **THEN** the system SHALL reject the request with a 409 conflict
- **AND** the row SHALL NOT be modified

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

The system SHALL bootstrap all four system shelves identified by `SYSTEM_SHELF_KIND_KEYS` (`favorites`, `backlog`, `active`, `completed`) at user registration, inside the same transaction as the `User` row. Each system shelf SHALL be created as a `Unit { type = SHELF, slug = kindKey, slugScope = ownerUserUnitId, translations: { en: { title: formatSystemShelfTitle(ownerSlug, kindKey) } } }` row paired with a `Shelf { unitId, kindKey }` row. The canonical lookup index for system shelves SHALL be the composite `(slugScope, slug)` unique on `Unit`, not any JSON pointer map. The canonical English labels and the `formatSystemShelfTitle` helper SHALL be sourced from `@rezics/contract`; no server-local or factory-local duplicates SHALL exist.

The system SHALL retain an idempotent safety helper named `ensureSystemShelf(userId, userSlug, kindKey)` for users provisioned outside the standard registration path (e.g., fixtures bypassing `userService.create`, partial seed runs, fixture-user paths in `package/utils/src/seed/users.ts`). The helper SHALL be invoked exclusively from `POST /shelf/system/ensure` and from the eager bootstrap path (`bootstrapSystemShelves`); it SHALL NOT be called from any mutation hot-path. When its creation branch fires, the helper SHALL set both `slug` and `slugScope` on the inserted `Unit` row and SHALL set the title via `formatSystemShelfTitle(userSlug, kindKey)`. The four system `kindKey`s SHALL remain reserved — user-created shelves SHALL NOT be permitted to use them.

The previous `User.extra.shelves` JSON map SHALL be removed from the `User` model surface. Existing dev / staging databases SHALL be reseeded; no per-row data backfill is shipped (the project is in active development per `CLAUDE.md`).

#### Scenario: Registration populates all four system shelves with slugs

- **WHEN** a new user with slug `alice` completes registration
- **THEN** the system SHALL create four `Unit { type = SHELF, slug = kindKey, slugScope = user.unitId }` rows (one per system `kindKey`) in the same transaction as the `User` row
- **AND** each Unit SHALL have a single `en` translation with title `formatSystemShelfTitle("alice", kindKey)` (`alice's Favorites`, `alice's Backlog`, `alice's Active`, `alice's Completed`)
- **AND** the corresponding four `Shelf { unitId, kindKey }` rows SHALL be linked

#### Scenario: Safety net heals a missing system shelf via the ensure route

- **WHEN** `POST /shelf/system/ensure { kindKey: "favorites" }` is invoked authenticated as user `alice` whose corresponding `(slugScope = alice.unitId, slug = "favorites")` Unit row is missing
- **THEN** the route SHALL invoke `ensureSystemShelf(alice.unitId, "alice", "favorites")` which creates the shelf with `slug`, `slugScope`, and title set
- **AND** the route SHALL return `{ unitId, created: true }`
- **AND** subsequent invocations SHALL resolve via the slug index without creating a second row and SHALL return `created: false`

#### Scenario: Safety net is not called from collection mutations

- **WHEN** `collection.service.ts` mutation paths (`toggleFavorite`, `getCollectionStatus`, `getCollectionStatusBatch`) need the favorites shelf id
- **THEN** they SHALL use a read-only lookup
- **AND** if the row is missing, the service SHALL throw `AppError(404, "system_shelf_missing", { kindKey })`
- **AND** the service SHALL NOT invoke `ensureSystemShelf` as a silent recovery

#### Scenario: System kindKeys are reserved for system shelves

- **WHEN** a user attempts to create a shelf with `kindKey` equal to `favorites`, `backlog`, `active`, or `completed`
- **THEN** the system SHALL reject the request with a validation error
- **AND** no shelf SHALL be created

### Requirement: Progress and shelf are orthogonal stores

The system SHALL treat `UserUnitProgress` and `Shelf` / `ShelfItem` / `ShelfItemUnit` as independent stores. A write to `UserUnitProgress` MUST NOT create, modify, or delete any shelf row as a side effect. A write to a shelf row (collect, uncollect, reorder, kindKey change) MUST NOT create, modify, or delete any `UserUnitProgress` row as a side effect. Cross-user aggregate queries over progress state (e.g. how many users have a unit in a given status) SHALL be answered by the Meilisearch projection of `UserUnitProgress` (built by a sibling change), never by aggregating shelf membership.

System-shelf membership that mirrors progress status SHALL be maintained exclusively by the frontend as a dual-write against the existing shelf API:

- The `backlog` and `active` system shelves SHALL mirror the user's current status. When a user transitions into `BACKLOG` (respectively `ACTIVE`), the frontend SHALL add the unit to that shelf; when leaving, the frontend SHALL remove it.
- The `completed` system shelf SHALL be add-only with respect to status. When a user transitions into `COMPLETED` for the first time the frontend SHALL add the unit; subsequent transitions out of `COMPLETED` SHALL NOT remove it. Re-entering `COMPLETED` (re-read) is naturally idempotent against the shelf primary key.
- The `PAUSED` and `DROPPED` statuses SHALL NOT have any system-shelf membership. Frontends SHALL NOT create or expect a `paused` or `dropped` system shelf.

The "Remove progress" action (`DELETE /me/units/:unitId/progress`) SHALL soft-delete the row by setting `isDeleted = true` rather than physically deleting it. It SHALL ALSO be paired by the frontend with shelf operations: a `remove` against any mirrored shelf currently containing the unit, and SHALL leave the `completed` shelf untouched. Any subsequent progress upsert SHALL set `isDeleted = false` and restore the row.

#### Scenario: Progress upsert does not write to shelf

- **WHEN** an authenticated user calls `PUT /me/units/:unitId/progress` with any combination of fields, including the case where the upsert coerces `status` to `COMPLETED`
- **THEN** the system writes only to the `UserUnitProgress` row and makes no insert, update, or delete on any `Shelf`, `ShelfItem`, or `ShelfItemUnit` row

#### Scenario: Shelf collect does not write to progress

- **WHEN** an authenticated user adds a unit to one of their shelves through the existing shelf collect endpoints
- **THEN** the system writes only to the shelf-related rows and makes no insert, update, or delete on any `UserUnitProgress` row

#### Scenario: Frontend dual-write tolerates partial failure

- **WHEN** a client issues two independent requests (one progress upsert, one shelf collect) representing the same user intent and one of them fails while the other succeeds
- **THEN** the succeeding request is durable, the failing request can be retried independently, and no backend reconciliation is required for the system to remain correct from the perspective of either store

#### Scenario: Mirrored shelves follow status

- **WHEN** the frontend executes a transition from `BACKLOG` to `ACTIVE` for a unit
- **THEN** the frontend SHALL issue a remove from the user's `backlog` shelf and an add to the user's `active` shelf in addition to the progress `PUT`
- **AND** the backend SHALL accept the shelf operations through the existing shelf endpoints with no special-casing

#### Scenario: Completed shelf is add-only on status leave

- **WHEN** the frontend executes a transition from `COMPLETED` back to `ACTIVE` (re-read)
- **THEN** the frontend SHALL add the unit to the `active` shelf
- **AND** the frontend SHALL NOT remove the unit from the `completed` shelf
- **AND** the underlying `ShelfItem` primary key (`shelfUnitId, itemRef`) ensures the existing `completed` membership is preserved

#### Scenario: Paused and Dropped statuses produce no shelf membership

- **WHEN** the frontend executes a transition into `PAUSED` or `DROPPED`
- **THEN** the frontend SHALL NOT add the unit to any system shelf
- **AND** if the prior status was `BACKLOG` or `ACTIVE`, the frontend SHALL remove the unit from that mirrored shelf

#### Scenario: Remove progress sweeps mirrored shelves

- **WHEN** the frontend invokes "Remove progress" (`DELETE /me/units/:unitId/progress`) for a unit currently mirrored in `active`
- **THEN** the frontend SHALL also `DELETE` the unit from the user's `active` shelf
- **AND** SHALL NOT remove the unit from the `completed` shelf if present

### Requirement: lastReadAnchor JSON shape

The `UserUnitProgress.lastReadAnchor` column SHALL store a nullable JSON value. When non-null, the value SHALL conform to:

```ts
{ text: string }
```

with `additionalProperties: false` at the contract layer. The `text` field SHALL be a string of length 1 to 200 inclusive (empty strings rejected). The convention "no anchor" SHALL be represented as SQL `NULL`, never as `{}` or `{ text: "" }`.

The schema lives in `@rezics/contract` as `lastReadAnchorSchema` and SHALL be reused by both the upsert body validator and the row DTO. The JSON shape MAY be extended in future changes to include richer positional metadata (for example `paragraphIndex`, `before`, `after`); such additions SHALL preserve the `text` field and SHALL keep the column nullable to preserve "no anchor".

#### Scenario: Null anchor stored as SQL NULL

- **WHEN** an authenticated user submits `lastReadAnchor: null`
- **THEN** the row's `lastReadAnchor` column SHALL be SQL NULL
- **AND** subsequent GET responses SHALL return `lastReadAnchor: null`

#### Scenario: Anchor with text in range is accepted

- **WHEN** an authenticated user submits `lastReadAnchor: { text: "他抬起头看着窗外飘落的雪" }`
- **THEN** the row's `lastReadAnchor` SHALL store the JSON `{ "text": "他抬起头看着窗外飘落的雪" }`

#### Scenario: Empty-text anchor is rejected

- **WHEN** an authenticated user submits `lastReadAnchor: { text: "" }`
- **THEN** the system SHALL reject the request with a validation error
- **AND** the row SHALL NOT be modified

#### Scenario: Over-length anchor is rejected

- **WHEN** an authenticated user submits `lastReadAnchor: { text }` with `text.length > 200`
- **THEN** the system SHALL reject the request with a validation error
- **AND** the row SHALL NOT be modified

#### Scenario: Unknown anchor key is rejected on write

- **WHEN** an authenticated user submits `lastReadAnchor: { text: "x", unknown: 1 }`
- **THEN** the system SHALL reject the request with a validation error
- **AND** the row SHALL NOT be modified

### Requirement: completedCount counts full-book re-reads

`UserUnitProgress.completedCount` SHALL be interpreted as the number of times the user has completed the book as a whole. The system SHALL continue to auto-increment it by one when the stored status transitions from any non-`COMPLETED` value to `COMPLETED` and the request did not provide `completedCount` explicitly. Per-chapter completion marks (in `UserContentNodeProgress`) SHALL NOT contribute to `completedCount`. Soft delete of any `ContentStructureNode` SHALL NOT decrement `completedCount`.

#### Scenario: Re-completion increments the counter

- **GIVEN** a `UserUnitProgress` row with `status = COMPLETED` and `completedCount = 2`
- **WHEN** the user transitions to `status = ACTIVE` and later back to `COMPLETED`
- **THEN** `completedCount` SHALL be `3` after the final transition

#### Scenario: Soft-deleting nodes does not change completedCount

- **GIVEN** a user has `completedCount = 1` and `UserContentNodeProgress` rows for several of the book's nodes
- **WHEN** an editor soft-deletes some of those nodes
- **THEN** the `UserUnitProgress.completedCount` value SHALL remain `1`

### Requirement: Per-node completion toggle endpoint

The system SHALL expose an authenticated `POST /me/units/:unitId/node-completion` endpoint that toggles a `UserContentNodeProgress` row for the caller and a node belonging to the addressed book unit. The request body SHALL contain `{ nodeId: string, isCompleted: boolean }`.

- When `isCompleted = true`: the system SHALL upsert a `UserContentNodeProgress` row with `(userId = caller, nodeId)` and `completedAt = current server time`. Repeated calls SHALL NOT change `completedAt` once set (idempotent insert).
- When `isCompleted = false`: the system SHALL delete the `UserContentNodeProgress` row for `(userId = caller, nodeId)` if it exists. Calling on a missing row SHALL be a no-op.

The system SHALL reject the request with a 409 conflict if the target node is `isDeleted = true`, and with a 422 validation error if the target node's `ownerUnitId` does not equal the path `:unitId`.

The system SHALL NOT write to `UserUnitProgress` as a side effect of this endpoint. Specifically, this endpoint SHALL NOT update `lastReadNodeId`, `lastReadAnchor`, `progress`, `completedCount`, `totalTimeMs`, `lastSeenAt`, or any other `UserUnitProgress` column.

#### Scenario: Mark a node completed creates the row

- **WHEN** an authenticated user posts `{ nodeId: "node-1", isCompleted: true }` for `:unitId = "book-1"` where node `"node-1"` belongs to `"book-1"` and is not deleted
- **THEN** the system SHALL upsert a `UserContentNodeProgress` row with `userId = caller`, `nodeId = "node-1"`, `completedAt = now`

#### Scenario: Repeated mark-completed is idempotent

- **GIVEN** a `UserContentNodeProgress` row already exists with `completedAt = T0`
- **WHEN** the user calls the endpoint with `{ nodeId, isCompleted: true }` at time `T1 > T0`
- **THEN** the existing row SHALL remain with `completedAt = T0` unchanged

#### Scenario: Unmark removes the row

- **GIVEN** a `UserContentNodeProgress` row exists for `(userId, nodeId)`
- **WHEN** the user calls the endpoint with `{ nodeId, isCompleted: false }`
- **THEN** the row SHALL be deleted
- **AND** a subsequent toggle to `isCompleted: true` SHALL create a fresh row with the new timestamp

#### Scenario: Toggling a soft-deleted node is rejected

- **WHEN** the user calls the endpoint for a `nodeId` whose row has `isDeleted = true`
- **THEN** the system SHALL reject with 409 conflict
- **AND** no row SHALL be created or deleted

#### Scenario: Node belonging to a different book is rejected

- **WHEN** the user calls the endpoint for `:unitId = "book-1"` with a `nodeId` whose `ownerUnitId = "book-2"`
- **THEN** the system SHALL reject with 422 validation error

#### Scenario: Endpoint does not write UserUnitProgress

- **GIVEN** the caller has no `UserUnitProgress` row for `:unitId`
- **WHEN** the caller invokes the node-completion endpoint
- **THEN** no `UserUnitProgress` row SHALL be created
- **AND** existing `UserUnitProgress` columns SHALL remain untouched

