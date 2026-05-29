## MODIFIED Requirements

### Requirement: Chapter Unit materialization is on-demand

The system SHALL materialize a Chapter Unit only when an action requires Unit identity for a `BookContentStructureNode`. Such actions include chapter-specific progress, review, discussion, and storing chapter body content. Plain TOC display, opening an empty chapter surface, and book-level progress position updates SHALL NOT materialize a Chapter Unit.

The materialization operation SHALL be addressable by `bookUnitId` plus either a `BookContentStructurePath` (numeric array indexing into the assembled tree) or a `nodeId` (preferred for new code, required for `/book/:bookId/node/:nodeId` interactions). The server SHALL resolve the target row, return the existing `chapterUnitId` if present, or create the required `Unit(type=POST)`, `Post(kind=CHAPTER)`, and `UnitTranslation` rows and write the resulting Unit id into the node's `contentUnitId` column.

Book-level progress SHALL store the user's resume position as `UserUnitProgress.lastReadNodeId` (a foreign key to `ContentStructureNode.id`) and optionally `UserUnitProgress.lastReadAnchor` (a JSON `{ text }` snippet). The system SHALL NOT serialize a `BookContentStructurePath` into `UserUnitProgress`. Recording a resume position SHALL NOT materialize a Chapter Unit.

#### Scenario: Materialize for a chapter-specific review

- GIVEN a `BookContentStructureNode` with `nodeId = "node-x"` has title "Chapter Four" and `contentUnitId = NULL`
- WHEN an authenticated user starts a chapter-specific review for that node
- THEN the system SHALL materialize a Chapter Unit for the node
- AND the review SHALL target the returned `contentUnitId`
- AND the `BookContentStructureNode` row SHALL be updated with that `contentUnitId`

#### Scenario: Return existing materialized chapter id

- GIVEN a `BookContentStructureNode` already has `contentUnitId = "chapter-1"`
- WHEN a caller requests materialization for that node
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

## ADDED Requirements

### Requirement: Node-scoped reading URL serves three rendered states

The frontend SHALL expose a route `/book/:bookId/node/:nodeId` that resolves a `ContentStructureNode` by id within the scope of the given book Unit and renders one of three views depending on node state:

1. **Deleted-node placeholder** — when `node.isDeleted = true` OR (the node has a `contentUnitId` whose chapter Unit `status = DELETED`). The view SHALL display the node's title (still readable from the row), the book context, and (for users with edit permission) a restore CTA. The view SHALL NOT attempt to fetch chapter body content.
2. **Empty-node placeholder** — when `node.isDeleted = false` AND `node.contentUnitId = null`. The view SHALL display the node's title, the book context, and a "Create chapter" CTA. Invoking the CTA SHALL materialize a chapter Unit and set `node.contentUnitId`, after which the same URL SHALL render the reading view.
3. **Reading view** — otherwise. The view SHALL render the chapter body, the book TOC sidebar with this node highlighted, and a "Mark as read" toggle that calls the per-node completion endpoint defined in the `user-unit-progress` capability.

The route SHALL be additive — `/chapter/:contentUnitId` SHALL remain available and serve a chapter-only view (no book context, no node id, no mark-as-read).

When the route loads, the frontend SHALL set `UserUnitProgress.lastReadNodeId` to `:nodeId` and update `lastReadAnchor` as the user reads. These updates SHALL go through the existing progress upsert endpoint, not through any node-completion endpoint.

#### Scenario: Reading view renders chapter for a materialized live node

- GIVEN a node with `nodeId = "node-x"` belongs to book `bookId = "book-1"`, has `isDeleted = false`, and has `contentUnitId = "chapter-1"` whose chapter Unit `status != DELETED`
- WHEN a user navigates to `/book/book-1/node/node-x`
- THEN the page SHALL fetch and render the chapter content for `contentUnitId = "chapter-1"`
- AND the TOC sidebar SHALL highlight node `node-x`
- AND the page SHALL display a "Mark as read" toggle whose state reflects whether a `UserContentNodeProgress` row exists for the caller and `node-x`

#### Scenario: Empty-node placeholder offers chapter creation

- GIVEN a node with `nodeId = "node-y"` belongs to book `bookId = "book-1"`, has `isDeleted = false`, and has `contentUnitId = null`
- WHEN a user with edit permission navigates to `/book/book-1/node/node-y`
- THEN the page SHALL display the node title and a "Create chapter" CTA
- AND the page SHALL NOT fetch any chapter body
- WHEN the user invokes the CTA
- THEN the system SHALL materialize a chapter Unit and assign `node-y.contentUnitId`
- AND a subsequent load of `/book/book-1/node/node-y` SHALL render the reading view

#### Scenario: Deleted-node placeholder offers restore for the owner

- GIVEN a node with `nodeId = "node-z"` has `isDeleted = true`
- WHEN a user with edit permission on the book navigates to `/book/book-1/node/node-z`
- THEN the page SHALL display the node title and a placeholder explaining the node is deleted
- AND the page SHALL display a restore CTA (whose underlying call goes through the `restoreNodes` content-structure service path)
- AND the page SHALL NOT fetch any chapter body

#### Scenario: Deleted chapter Unit renders deleted placeholder

- GIVEN a node has `isDeleted = false` and `contentUnitId = "chapter-1"` where `chapter-1.status = DELETED`
- WHEN a user navigates to `/book/book-1/node/node-x`
- THEN the page SHALL display a deleted placeholder for the chapter
- AND the page SHALL NOT attempt to render deleted chapter body content

#### Scenario: Reading saves last read node id to UserUnitProgress

- GIVEN an authenticated user is viewing `/book/book-1/node/node-x` in the reading view
- WHEN the page loads and the reader scrolls
- THEN the frontend SHALL upsert `UserUnitProgress` for `unitId = "book-1"` with `lastReadNodeId = "node-x"`
- AND the frontend MAY update `lastReadAnchor` with the current resume snippet
- AND no `UserContentNodeProgress` row SHALL be created or modified as a side effect
