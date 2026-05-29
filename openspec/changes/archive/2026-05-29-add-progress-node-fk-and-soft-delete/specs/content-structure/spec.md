## ADDED Requirements

### Requirement: ContentStructureNode supports soft delete with deletedAt timestamp

The system SHALL extend `ContentStructureNode` with an `isDeleted` boolean (default false) and a nullable `deletedAt` timestamp. The system SHALL NOT support hard delete of `ContentStructureNode` rows through generic application paths; deletion in user-facing flows SHALL flip `isDeleted` to true and set `deletedAt` to the current server time. Hard delete remains physically possible only through administrative database tooling or chapter / book cascade deletion of the owning container.

All generic content-structure read paths (tree assembly, single-node lookup, child enumeration, count queries) SHALL filter `isDeleted = false` by default. Trash listings or restore flows MAY query with `isDeleted = true`.

The combined index `(ownerUnitId, parentId, sortKey, isDeleted)` SHALL be added so that the dominant "list children in order" query remains index-served.

#### Scenario: Soft delete sets flag and timestamp without removing the row

- **WHEN** a user-facing flow deletes a `ContentStructureNode` with `id = "node-1"`
- **THEN** the row SHALL remain in the table
- **AND** the row SHALL have `isDeleted = true`
- **AND** the row SHALL have `deletedAt` set to the current server time

#### Scenario: Default tree read excludes soft-deleted rows

- **GIVEN** a `ContentStructure(ownerUnitId = "unit-1")` with three node rows where one has `isDeleted = true`
- **WHEN** a client reads the content structure for `unit-1` via the canonical GET path
- **THEN** the assembled tree SHALL contain exactly the two non-deleted nodes
- **AND** the deleted node SHALL NOT appear at any position in the tree

#### Scenario: Trash listing query opts in to soft-deleted rows

- **WHEN** a trash listing query is issued with an explicit `isDeleted = true` predicate scoped to `ownerUnitId`
- **THEN** the query SHALL return exactly the soft-deleted node rows for that owner
- **AND** the query SHALL NOT include non-deleted rows

### Requirement: Soft delete promotes non-targeted children to the book root

When one or more nodes are soft-deleted in a single operation, every **non-deleted** child whose `parentId` references any of the target nodes SHALL be re-parented to `parentId = null` (i.e., the book root of the same `ownerUnitId`) within the same transaction. A child that is itself a target of the same batch SHALL remain attached to its (also-doomed) parent and SHALL be soft-deleted alongside it.

Promoted children SHALL retain their existing `sortKey` so that LexoRank ordering carries over to the root layer. The system MAY reassign `sortKey` only if a collision with another existing root sibling produces a non-deterministic order; otherwise the original key SHALL be preserved.

The container `ContentStructure.updatedAt` SHALL be bumped exactly once for the whole operation.

#### Scenario: Deleting a parent promotes its surviving children to the root

- **GIVEN** a tree `Root → A → [B, C]` for `ownerUnitId = "unit-1"`
- **WHEN** `softDeleteNodes("unit-1", ["A"])` is called
- **THEN** `B.parentId` SHALL be `null`
- **AND** `C.parentId` SHALL be `null`
- **AND** `A.isDeleted` SHALL be `true`
- **AND** `B.isDeleted` and `C.isDeleted` SHALL remain `false`
- **AND** `ContentStructure.updatedAt` SHALL be bumped once

#### Scenario: Batch delete buries selected descendants with their selected ancestor

- **GIVEN** a tree `Root → A → [B, C]`
- **WHEN** `softDeleteNodes("unit-1", ["A", "B"])` is called
- **THEN** `A.isDeleted` and `B.isDeleted` SHALL both be `true`
- **AND** `C.parentId` SHALL be `null` (promoted; `C` was not in the batch)
- **AND** `C.isDeleted` SHALL remain `false`

#### Scenario: Single soft delete is a single logical operation

- **GIVEN** any node with `n` non-deleted children
- **WHEN** the node is soft-deleted via the service
- **THEN** the children's `parentId` reassignment and the parent's `isDeleted` flip SHALL commit atomically
- **AND** a single history outbox row SHALL be written for the operation

### Requirement: Restore returns a node to its original placement or to the book root as fallback

When a soft-deleted node is restored, the system SHALL set `isDeleted = false` and `deletedAt = null`. The system SHALL attempt to restore the node to its original `parentId` and original `sortKey`. If the original `parentId` is null **or** references an alive (`isDeleted = false`) node, the restored node SHALL use that `parentId`. If the original `parentId` references a node that is itself `isDeleted = true`, the restored node SHALL fall back to `parentId = null`. In both branches the original `sortKey` SHALL be preserved.

Children that were promoted to root at delete time SHALL NOT be re-parented under the restored node. Restoration is a per-node operation; reconstructing the original subtree shape is a manual user action.

#### Scenario: Restore with alive original parent returns the node to its place

- **GIVEN** a soft-deleted node `X` whose original `parentId = "P"` and `sortKey = "g"`, and `P` is still alive
- **WHEN** `restoreNodes("unit-1", ["X"])` is called
- **THEN** `X.isDeleted` SHALL be `false`
- **AND** `X.parentId` SHALL be `"P"`
- **AND** `X.sortKey` SHALL be `"g"`

#### Scenario: Restore with deleted original parent falls back to root

- **GIVEN** a soft-deleted node `X` whose original `parentId` references node `P` which is itself `isDeleted = true`
- **WHEN** `restoreNodes("unit-1", ["X"])` is called
- **THEN** `X.isDeleted` SHALL be `false`
- **AND** `X.parentId` SHALL be `null`
- **AND** `X.sortKey` SHALL be the value the node had at deletion time

#### Scenario: Restore does not re-parent promoted children

- **GIVEN** a soft-deleted node `A` whose former children `B` and `C` were promoted to `parentId = null` at delete time
- **WHEN** `A` is restored
- **THEN** `B.parentId` and `C.parentId` SHALL remain `null`
- **AND** the user SHALL manually re-organize them if desired

### Requirement: Generic update() rejects resurrection of soft-deleted ids

The diff-based `ContentStructureService.update()` path SHALL exclude `isDeleted = true` rows from its `current` baseline when computing the diff. The system SHALL reject any submitted node whose `id` matches an `isDeleted = true` row with a 409 conflict response and SHALL NOT mutate any row in that transaction.

Resurrection (un-deleting a node) SHALL only be possible through the explicit `restoreNodes` service path.

#### Scenario: Submitting a deleted id throws

- **GIVEN** a node `id = "node-1"` exists with `isDeleted = true`
- **WHEN** a TOC editor submits a tree that contains a node with `id = "node-1"`
- **THEN** the system SHALL reject the request with a 409 conflict
- **AND** no row SHALL be inserted, updated, or deleted in that transaction

#### Scenario: Diff baseline excludes soft-deleted rows

- **GIVEN** an owner with five `ContentStructureNode` rows where two are `isDeleted = true`
- **WHEN** the TOC editor submits a tree containing only the three alive node ids and one new node
- **THEN** the diff baseline SHALL be the three alive rows
- **AND** the submission SHALL not delete the two already-soft-deleted rows (they are not in the baseline; they are simply unaffected)
- **AND** one INSERT SHALL be issued for the new node

### Requirement: Generic content-structure service exposes batch soft delete and restore

The system SHALL expose two new service methods on the generic content-structure service:

- `softDeleteNodes(ownerUnitId, nodeIds: string[], options)` — soft-deletes every targeted node and applies the children-promote-to-root rule. The method SHALL be idempotent: targets that are already `isDeleted = true` SHALL be silently skipped without altering their `deletedAt`.
- `restoreNodes(ownerUnitId, nodeIds: string[], options)` — restores every targeted node per the placement rule above. Targets that are not currently `isDeleted = true` SHALL be silently skipped.

Both methods SHALL write a single history outbox row per call that covers the whole batch (one Unit history sequence per call), reusing the existing `writeSequencedHistoryOutbox` pattern.

#### Scenario: Batch soft delete is a single sequence

- **WHEN** `softDeleteNodes("unit-1", ["a", "b", "c"])` is called
- **THEN** all three rows SHALL be `isDeleted = true` after the transaction commits
- **AND** one history outbox row SHALL be written under one Unit history sequence

#### Scenario: Idempotent re-delete is a no-op

- **GIVEN** node `id = "x"` already has `isDeleted = true` with `deletedAt = T0`
- **WHEN** `softDeleteNodes("unit-1", ["x"])` is called at time `T1 > T0`
- **THEN** the row SHALL remain `isDeleted = true`
- **AND** `deletedAt` SHALL remain `T0` (unchanged)
- **AND** no history outbox row SHALL be written

#### Scenario: Restore of a non-deleted node is a no-op

- **GIVEN** node `id = "y"` has `isDeleted = false`
- **WHEN** `restoreNodes("unit-1", ["y"])` is called
- **THEN** the row SHALL be unchanged
- **AND** no history outbox row SHALL be written

### Requirement: Content-structure history events distinguish soft delete and restore

The system SHALL extend the existing `node.delete` history outbox operation payload with a `softDelete: true` field when the deletion went through the soft-delete path, and a `promotedChildIds: string[]` field listing every child whose `parentId` was set to null as part of the same operation.

The system SHALL introduce a new operation `node.restore` whose payload contains the restored node id, the resulting `parentId`, the resulting `sortKey`, and a `fallbackToRoot: boolean` indicating whether the system fell back to root because the original parent was itself deleted.

The existing `node.delete` operation SHALL retain its previously documented fields (`node`, `placement`, `descendantCount`).

#### Scenario: Soft delete payload includes promoted child ids

- **WHEN** a soft delete promotes two children (ids `"b"` and `"c"`) to root
- **THEN** the `node.delete` payload SHALL include `softDelete: true`
- **AND** the payload SHALL include `promotedChildIds: ["b", "c"]` (order not significant)

#### Scenario: Restore event reports placement

- **WHEN** a node is restored with its original `parentId` alive
- **THEN** a `node.restore` operation SHALL be emitted
- **AND** the payload SHALL include the restored node id, the resulting `parentId`, the resulting `sortKey`, and `fallbackToRoot: false`

#### Scenario: Restore event reports fallback to root

- **WHEN** a node is restored but its original `parentId` was itself deleted
- **THEN** the `node.restore` payload SHALL include `fallbackToRoot: true`
- **AND** the resulting `parentId` SHALL be `null`
