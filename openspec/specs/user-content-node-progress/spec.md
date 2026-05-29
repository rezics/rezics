# user-content-node-progress Specification

## Purpose
TBD - created by archiving change add-progress-node-fk-and-soft-delete. Update Purpose after archive.
## Requirements
### Requirement: Per-node manual completion fact source

The system SHALL persist a `UserContentNodeProgress` table with composite primary key `(userId, nodeId)` recording explicit user-driven completion marks for individual `ContentStructureNode` rows. Each row SHALL carry:

- `userId` (UUID, FK to `User.unitId`, `ON DELETE CASCADE`)
- `nodeId` (UUID, FK to `ContentStructureNode.id`, `ON DELETE CASCADE`)
- `completedAt` (timestamp, NOT NULL, default `now()`)

The presence of a row SHALL be interpreted as "the user has marked this node completed." The system SHALL NOT carry a separate `isCompleted` flag; row absence means not completed. The system SHALL index `(nodeId)` for cross-user statistics (e.g., "how many users marked this chapter completed").

Rows in this table SHALL NOT be written by passive reading activity (opening a chapter URL, scrolling, lastSeenAt-style heartbeats). Writes SHALL originate exclusively from explicit user action via the per-node completion toggle endpoint defined in the `user-unit-progress` capability.

#### Scenario: Row presence implies completion

- **GIVEN** a `UserContentNodeProgress` row exists for `(userId = "u1", nodeId = "n1")`
- **WHEN** any system component queries the user's completion state for node `"n1"`
- **THEN** the answer SHALL be "completed"

#### Scenario: Row absence implies not completed

- **GIVEN** no row exists for `(userId = "u1", nodeId = "n2")`
- **WHEN** any system component queries the user's completion state for node `"n2"`
- **THEN** the answer SHALL be "not completed"

#### Scenario: User hard-delete cascades

- **WHEN** a `User` row is hard-deleted
- **THEN** every `UserContentNodeProgress` row with that `userId` SHALL be removed via FK cascade

#### Scenario: Node hard-delete cascades

- **WHEN** a `ContentStructureNode` row is hard-deleted (administrative tooling or owner cascade)
- **THEN** every `UserContentNodeProgress` row with that `nodeId` SHALL be removed via FK cascade

### Requirement: Auto-tracking is not allowed

The system SHALL NOT create or update `UserContentNodeProgress` rows in response to passive reader activity. The following actions SHALL NOT produce a row:

- Opening `/book/:bookId/node/:nodeId` or any other route that displays a node's chapter content.
- Updating `UserUnitProgress.lastReadNodeId` or `lastReadAnchor`.
- Scrolling or time-spent heartbeats.
- Chapter content downloads or prefetches.

Writes SHALL be limited to the explicit toggle endpoint specified in the `user-unit-progress` capability. This rule SHALL apply uniformly to linear and non-linear books; rezics intentionally supports reference and anthology-style reading patterns where passive tracking would produce misleading completion data.

#### Scenario: Opening the node URL does not create a row

- **GIVEN** no `UserContentNodeProgress` row exists for `(caller, "node-1")`
- **WHEN** the caller navigates to `/book/:bookId/node/node-1` and the page renders the chapter
- **THEN** no `UserContentNodeProgress` row SHALL be created

#### Scenario: Saving last read position does not create a row

- **WHEN** the caller's reader updates `UserUnitProgress.lastReadNodeId = "node-1"` and `lastReadAnchor`
- **THEN** no `UserContentNodeProgress` row SHALL be created
- **AND** any existing `UserContentNodeProgress` row for `(caller, "node-1")` SHALL be unchanged

### Requirement: Soft-deleted nodes preserve completion marks

The system SHALL NOT cascade-delete `UserContentNodeProgress` rows in response to a soft delete of the referenced `ContentStructureNode`. Rows SHALL remain queryable while `node.isDeleted = true` so that restoration of the node automatically restores the completion mark.

This is a deliberate consequence of soft delete being the only user-facing delete path: the FK cascade defined in the schema fires only on hard delete, which user-facing flows do not trigger.

#### Scenario: Soft delete preserves the completion row

- **GIVEN** a `UserContentNodeProgress` row exists for `(userId = "u1", nodeId = "n1")`
- **WHEN** the TOC editor soft-deletes node `"n1"`
- **THEN** the `UserContentNodeProgress` row SHALL remain
- **AND** the row SHALL still have its original `completedAt`

#### Scenario: Restore makes the completion mark effective again

- **GIVEN** a soft-deleted node `"n1"` and a `UserContentNodeProgress` row for `(userId, "n1")`
- **WHEN** the node is restored
- **THEN** queries that surface completion (e.g., per-chapter checkmarks in the TOC) SHALL immediately reflect the row's existence

### Requirement: Indexes support per-chapter statistics

The system SHALL maintain a `(nodeId)` index on `UserContentNodeProgress` sufficient to answer "how many users have marked this chapter completed" without a full-table scan, and SHALL use the composite primary key `(userId, nodeId)` to answer per-user lookups.

#### Scenario: Per-chapter completion count is index-served

- **WHEN** the system answers a query of the form "count distinct userId where nodeId = :id" for a single node id
- **THEN** the query plan SHALL use the `(nodeId)` index
- **AND** the plan SHALL NOT scan rows for unrelated nodes

#### Scenario: Per-user completion lookup is index-served

- **WHEN** the system answers a query of the form "exists where userId = :u and nodeId = :n"
- **THEN** the query plan SHALL use the primary-key index `(userId, nodeId)`

