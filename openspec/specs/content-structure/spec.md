# content-structure Specification

## Purpose

Defines generic content-structure terminology for release content trees, the `contentUnitId` content-node identity that replaces chapter-specific `chapterId`, the reservation of `targetUnitId` for interaction targets, and explicit legacy-compatibility handling during migration.
## Requirements
### Requirement: Content Structure Uses Generic Content Terminology

The system SHALL use generic `contentStructure` terminology for release content
trees instead of treating the concept as book-only in API, frontend-facing
vocabulary, and backend persistence. Existing book table-of-contents behavior
remains the first implementation, but contracts, service boundaries, storage
models, and UI copy introduced by this capability SHALL avoid new
book/chapter-only naming where a generic content structure concept is meant.

#### Scenario: Book content structure remains supported

- **WHEN** a book release loads its table of contents
- **THEN** the data MAY still be exposed through book compatibility APIs during
  migration
- **AND** canonical storage and service terminology SHALL expose it as
  `contentStructure`
- **AND** the owner SHALL be the release Unit id, not a book-specific storage
  key

### Requirement: contentUnitId Replaces chapterId For Content Unit Identity

Content structure nodes and reader/editor DTOs SHALL use `contentUnitId` for
the Unit identity of a concrete content node. `contentUnitId` replaces old
chapter-specific `chapterId` and `chapterUnitId` language in contracts, backend
storage, service code, API clients, and UI work. For book chapters,
`contentUnitId` points to the materialized chapter content Unit.

Generic content-structure contracts, service responses, write inputs, mappers,
and history operation payloads SHALL NOT expose `chapterId` or `chapterUnitId`.
Book/chapter adapters MAY keep local route params or compatibility names only
when the surrounding surface is explicitly book-specific.

`targetUnitId` SHALL remain reserved for interaction targets such as posts,
reviews, ratings, and comments. It SHALL NOT be reused as the content-structure
node identity field.

#### Scenario: Materialized book chapter exposes contentUnitId

- **GIVEN** a book content structure node has a materialized chapter Unit
  `chapter-unit-1`
- **WHEN** the content structure DTO is returned
- **THEN** the node SHALL expose `contentUnitId = "chapter-unit-1"`
- **AND** canonical storage SHALL persist the same value as `contentUnitId`
- **AND** clients SHALL NOT need to read a `chapterId` or `chapterUnitId` field
  for the same identity

#### Scenario: Interactions continue to use targetUnitId

- **WHEN** a user creates a review or discussion post for a content Unit
- **THEN** the interaction write SHALL use `targetUnitId` for the reviewed or
  discussed Unit
- **AND** content structure DTOs and storage SHALL use `contentUnitId` only to
  identify the content node's Unit

#### Scenario: Generic response omits chapterUnitId

- **WHEN** a client reads `/content-structure/:ownerUnitId`
- **THEN** every returned node SHALL use `contentUnitId` for linked content Unit
  identity
- **AND** the response SHALL NOT include `chapterUnitId`

### Requirement: Migration Keeps Legacy Compatibility Explicit

The system SHALL keep legacy content-structure compatibility only at
book-specific adapter boundaries that still need URL or product-surface
compatibility. Existing book routes and helper names MAY remain temporarily
when they are explicitly documented as adapters over generic content-structure
storage. Generic contracts, service boundaries, storage models, and reusable
app/API helpers SHALL use `contentStructure`, `ownerUnitId`, and
`contentUnitId`.

#### Scenario: Legacy field is removed from generic contracts

- **WHEN** a generic content-structure contract or frontend DTO describes node
  identity
- **THEN** it SHALL expose `contentUnitId`
- **AND** it SHALL NOT expose `chapterUnitId`

#### Scenario: Legacy book endpoint is compatibility wrapper

- **WHEN** a legacy `/book/:bookUnitId/content-structure` endpoint remains
- **THEN** it SHALL be documented as a compatibility wrapper
- **AND** it SHALL delegate to generic content-structure storage
- **AND** internal callers that do not require book-specific compatibility SHALL
  use generic content-structure clients instead

### Requirement: Generic ContentStructure Backend Model

The system SHALL store content structures in generic backend tables keyed by
the Unit that owns the structure. The container SHALL be modeled as
`ContentStructure(ownerUnitId)` and the node rows SHALL be modeled as
`ContentStructureNode(ownerUnitId, contentUnitId)`.

`ownerUnitId` identifies the release, Series, or other Unit whose structure is
being edited. `contentUnitId` identifies the concrete Unit referenced by a
node. Book-specific `bookUnitId` and chapter-specific `chapterUnitId` SHALL NOT
be the canonical storage names for generic content structure.

#### Scenario: Book content structure uses generic rows

- **GIVEN** a book release Unit `book-release-1`
- **WHEN** its table of contents is stored
- **THEN** the container SHALL be `ContentStructure(ownerUnitId = "book-release-1")`
- **AND** each node SHALL be stored as `ContentStructureNode(ownerUnitId = "book-release-1", ...)`
- **AND** materialized chapter identity SHALL be stored in `contentUnitId`

#### Scenario: Series content structure uses the same model

- **GIVEN** a Series Unit `series-1`
- **WHEN** its direct member tree is stored
- **THEN** the container SHALL be `ContentStructure(ownerUnitId = "series-1")`
- **AND** release member nodes SHALL reference visible releases through
  `contentUnitId`

### Requirement: Generic ContentStructure Preserves Normalized Tree Semantics

The generic content-structure model SHALL preserve the normalized one-row-per
node behavior previously implemented for books. Each node SHALL carry stable
node id, nullable `parentId`, LexoRank `sortKey`, nullable `contentUnitId`,
title cache, `noContent`, optional rating cache, created/updated timestamps,
and non-unique content-unit references.

#### Scenario: Duplicate contentUnitId references are supported

- **GIVEN** one content Unit `content-1`
- **WHEN** two nodes in the same or different owner structures reference it
- **THEN** both `ContentStructureNode` rows SHALL be valid
- **AND** no uniqueness constraint SHALL reject the duplicate `contentUnitId`

#### Scenario: Content unit delete keeps structure placeholder

- **GIVEN** a node references `contentUnitId = "content-1"`
- **WHEN** `content-1` is deleted
- **THEN** the node row SHALL remain
- **AND** `contentUnitId` SHALL be set to null

### Requirement: Generic ContentStructure Service Owns Tree Operations

The system SHALL provide a backend content-structure domain that owns generic
tree assembly, path parsing/resolution, diff planning, batch save, and history
event writing. Book services MAY expose compatibility wrappers, but generic tree
mutation logic SHALL NOT remain owned by the book domain.

Generic tree operations SHALL accept and return `contentUnitId` only for linked
content Unit identity. They SHALL NOT synthesize `chapterUnitId` aliases in
generic mapper output or operation planning.

#### Scenario: Generic owner read returns content structure

- **GIVEN** `ContentStructure(ownerUnitId = "unit-1")` exists
- **WHEN** a client reads the content structure for `unit-1`
- **THEN** the server SHALL assemble `ContentStructureNode` rows into the nested
  content-structure DTO
- **AND** the DTO SHALL expose node identity through `contentUnitId`

#### Scenario: Book wrapper delegates to generic service

- **WHEN** a caller uses a compatibility book content-structure endpoint
- **THEN** the endpoint SHALL delegate storage reads and writes to the generic
  content-structure service
- **AND** no separate `BookContentStructure` storage path SHALL be maintained

#### Scenario: Generic write rejects chapterUnitId-only identity

- **WHEN** a generic content-structure update receives a node identity through
  `chapterUnitId` without `contentUnitId`
- **THEN** the generic service SHALL reject the payload or require the caller to
  use a book compatibility adapter
- **AND** canonical writes SHALL persist only `contentUnitId`

### Requirement: ContentStructure History Is Generic

Content-structure mutations SHALL record generic structure history events.
Book-specific event names such as `book.contentStructure.batch` MAY be displayed
for pre-cutover legacy rows, but new canonical writes SHALL use generic
content-structure event names and payload fields.

#### Scenario: Generic structure edit records generic event

- **WHEN** a content-structure batch save inserts, updates, moves, links,
  unlinks, deletes, or replaces nodes
- **THEN** the history payload SHALL identify the owner Unit
- **AND** the event type SHALL use generic content-structure terminology
- **AND** node link/unlink payloads SHALL use `contentUnitId`
- **AND** node link/unlink payloads SHALL NOT include chapter-specific aliases

### Requirement: Existing BookContentStructure Data Migrates To Generic Storage

The system SHALL migrate existing `BookContentStructure` and
`BookContentStructureNode` data to generic `ContentStructure` and
`ContentStructureNode` storage. Migration SHALL preserve node ids, ordering,
parent links, timestamps, title/noContent/rating caches, and materialized
content Unit references.

#### Scenario: Migration preserves existing book tree

- **GIVEN** a book has existing `BookContentStructureNode` rows
- **WHEN** the migration runs
- **THEN** equivalent generic `ContentStructureNode` rows SHALL exist with the
  same tree shape
- **AND** every previous `chapterUnitId` value SHALL be represented as
  `contentUnitId`
- **AND** parity checks SHALL be able to reconstruct the same nested tree

### Requirement: Game and media parts use content structure

Game and media parts that need identity SHALL be represented as Units and
organized through content structure nodes. This includes DLC, expansions,
episodes, seasons, volumes, specials, bonus content, soundtrack entries, and
similar concrete content parts.

The node identity field SHALL remain `contentUnitId`; `targetUnitId` SHALL
remain reserved for interactions such as reviews, posts, ratings, and comments.

#### Scenario: Game DLC is a content Unit

- **WHEN** a game release includes a DLC entry that needs its own title or metadata
- **THEN** the DLC SHALL be represented as a Unit
- **AND** the game release content structure SHALL include a node pointing at that Unit through `contentUnitId`

#### Scenario: Media episode is a content Unit

- **WHEN** a media release includes an episode that users can discuss or track
- **THEN** the episode SHALL be represented as a Unit
- **AND** the media release content structure SHALL include a node pointing at that Unit through `contentUnitId`

#### Scenario: Interaction targets still use targetUnitId

- **WHEN** a user reviews a DLC Unit or media episode Unit
- **THEN** the review write SHALL use `targetUnitId` for the reviewed Unit
- **AND** the release content structure SHALL continue to use `contentUnitId` for node identity

### Requirement: Summary counts are not canonical content structure

Summary count fields SHALL NOT be canonical content structure. Episode count,
season count, DLC count, volume count, and similar summary fields SHALL NOT be
treated as canonical structure. Canonical part identity and ordering SHALL come
from content structure when the parts are modeled.

#### Scenario: Episode list reads content structure

- **WHEN** a client renders a media release's episode list
- **THEN** it SHALL read content-structure nodes
- **AND** it SHALL NOT construct episode identities from `episodeCount`

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

