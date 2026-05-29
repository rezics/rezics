## MODIFIED Requirements

### Requirement: Chapter Unit materialization is on-demand

The system SHALL materialize a Chapter Unit only when an action requires Unit identity for a `BookContentStructureNode`. Such actions include chapter-specific progress, review, discussion, and storing chapter body content. Plain TOC display, opening an empty chapter surface, and book-level progress position updates SHALL NOT materialize a Chapter Unit.

The materialization operation SHALL be addressable by `bookUnitId` plus a `nodeId` (the target `ContentStructureNode.id`). The materialization contract SHALL NOT accept a `BookContentStructurePath` (numeric array indexing into the assembled tree); every reading and TOC surface already addresses nodes by `nodeId`, including `/book/:bookId/node/:nodeId`. The server SHALL resolve the target row by `nodeId`, return the existing `chapterUnitId` if present, or create the required `Unit(type=POST)`, `Post(kind=CHAPTER)`, and `UnitTranslation` rows and write the resulting Unit id into the node's `contentUnitId` column.

Book-level progress SHALL store the user's resume position as `UserUnitProgress.lastReadNodeId` (a foreign key to `ContentStructureNode.id`) and optionally `UserUnitProgress.lastReadAnchor` (a JSON `{ text }` snippet). The system SHALL NOT serialize a `BookContentStructurePath` into `UserUnitProgress`. Recording a resume position SHALL NOT materialize a Chapter Unit.

#### Scenario: Materialize for a chapter-specific review

- GIVEN a `BookContentStructureNode` with `nodeId = "node-x"` has title "Chapter Four" and `contentUnitId = NULL`
- WHEN an authenticated user starts a chapter-specific review for that node
- THEN the system SHALL materialize a Chapter Unit for the node addressed by `nodeId = "node-x"`
- AND the review SHALL target the returned `contentUnitId`
- AND the `BookContentStructureNode` row SHALL be updated with that `contentUnitId`

#### Scenario: Return existing materialized chapter id

- GIVEN a `BookContentStructureNode` already has `contentUnitId = "chapter-1"`
- WHEN a caller requests materialization for that node by `nodeId`
- THEN the system SHALL return `contentUnitId = "chapter-1"`
- AND the system SHALL NOT create a duplicate Unit, Post, or UnitTranslation row

#### Scenario: Empty chapter view does not materialize

- GIVEN a `BookContentStructureNode` with `nodeId = "node-x"` has `contentUnitId = NULL`
- WHEN a user opens `/book/:bookId/node/node-x` and the page renders the empty-node placeholder
- THEN the system SHALL render the node metadata and an explicit "Create chapter" CTA
- AND the system SHALL NOT create a Chapter Unit until the user explicitly invokes the create-chapter action

#### Scenario: Book-level progress stores nodeId without materialization

- GIVEN a user is reading a node `nodeId = "node-x"` with `contentUnitId = NULL`
- WHEN the system updates book-level progress for the parent Book Unit
- THEN the system SHALL set `UserUnitProgress.lastReadNodeId = "node-x"`
- AND the system MAY set `UserUnitProgress.lastReadAnchor` with the in-chapter snippet
- AND the system SHALL NOT create a Chapter Unit only to store that resume position

#### Scenario: Materialization request keyed by path is rejected

- GIVEN a materialize request that supplies a numeric `path` instead of a `nodeId`
- WHEN the server validates the request body
- THEN the request SHALL be rejected for failing the `{ nodeId }` contract
- AND no Unit, Post, or UnitTranslation row SHALL be created

#### Scenario: Concurrent materialization is idempotent

- GIVEN two requests concurrently materialize the same `nodeId`
- WHEN one request creates and links a Chapter Unit first
- THEN the other request SHALL observe the linked `chapterUnitId` and return it
- AND only one Chapter Unit SHALL be created for that node

## REMOVED Requirements

### Requirement: Materialization rejects stale BookContentStructure paths

**Reason**: The stale-path guard exists only to detect a TOC reorder racing a
path-addressed materialize request and shifting what the numeric path points at.
With materialization keyed by `nodeId` (`ContentStructureNode.id`, a stable
`uuidv7`), the target row is unambiguous and cannot drift under reorder, so the
`expectedTitle` / `expectedBookContentStructureUpdatedAt` conflict checks are no
longer meaningful. Idempotent concurrent materialization of the same node is
preserved under "Chapter Unit materialization is on-demand".

**Migration**: Callers SHALL stop sending `expectedTitle` and
`expectedBookContentStructureUpdatedAt`; the materialize request body is `{ nodeId }`.
A node that no longer exists (e.g. soft-deleted) SHALL be handled by the standard
node-not-found / deleted-node path rather than a stale-path conflict.
