## MODIFIED Requirements

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

## ADDED Requirements

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
