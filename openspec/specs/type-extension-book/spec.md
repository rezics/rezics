## ADDED Requirements

### Requirement: Book extension creation tied to Unit(type=BOOK)

A Book record SHALL exist as a 1:1 extension of a Unit with `type = BOOK`. The Book's `unitId` serves as its primary key and references the parent Unit. Creating a Book without a corresponding Unit(type=BOOK) SHALL be rejected. Deleting the parent Unit SHALL cascade-delete the Book record.

#### Scenario: Create a Book extension for a BOOK unit

- GIVEN a Unit with `id = "unit-1"` and `type = BOOK`
- WHEN the system creates a Book record with `unitId = "unit-1"`
- THEN the Book record SHALL be persisted with `unitId = "unit-1"`, `textLength = 0`, `isLicensed = false`, and auto-generated timestamps
- AND all nullable fields (`isbn13`, `publicationDate`, `pageCount`, `formatKey`, `coverAssetUnitId`, `extra`) SHALL default to null

#### Scenario: Reject Book creation for non-BOOK unit

- GIVEN a Unit with `id = "unit-2"` and `type = GAME`
- WHEN a caller attempts to create a Book record with `unitId = "unit-2"`
- THEN the system SHALL reject the request with a validation error
- AND no Book record SHALL be created

#### Scenario: Cascade delete Book when Unit is deleted

- GIVEN a Unit with `id = "unit-1"` and `type = BOOK` with an associated Book record
- WHEN the Unit row is hard-deleted from the database
- THEN the associated Book record SHALL also be deleted via cascade

### Requirement: Book MUST NOT contain title, description, language, coverUrl, tags, author, press, or producer fields

The Book extension table SHALL store only language-neutral facts. Title, subtitle, summary, and description SHALL be stored in `UnitTranslation`. Language information SHALL be stored in `UnitSupportLanguage`. Author, press, and producer attribution SHALL be stored in `PersonCredit` and `OrgCredit`. Tags SHALL be stored in `UnitTag`. **Cover images SHALL be stored in `UnitTranslation.extra.coverUrl` via the `unitTranslationExtraSchema` defined in the `unit-translation` capability.** The Book table SHALL NOT hold a `coverUrl` column or any IMAGE-unit reference for covers.

#### Scenario: Book schema excludes language-dependent and attribution fields

- GIVEN the Book model in the Prisma schema
- WHEN inspecting its fields
- THEN it SHALL NOT contain fields named `title`, `subtitle`, `description`, `language`, `coverUrl`, `coverAssetUnitId`, `tags`, `author`, `press`, or `producer`
- AND the only fields present SHALL be `unitId`, `isbn13`, `publicationDate`, `pageCount`, `textLength`, `formatKey`, `isLicensed`, `extra`, `createdAt`, and `updatedAt`

#### Scenario: Book display text retrieved from UnitTranslation

- GIVEN a Book with `unitId = "unit-1"` and a `UnitTranslation` record with `unitId = "unit-1"`, `language = "en"`, `title = "The Great Gatsby"`
- WHEN a client requests the book's display information in English
- THEN the system SHALL return the title from `UnitTranslation` and the language-neutral facts from the Book record
- AND no title SHALL be read from or written to the Book table

#### Scenario: Book cover URL retrieved from UnitTranslation.extra

- GIVEN a Book with `unitId = "unit-1"` and a `UnitTranslation` with `language = "en"` and `extra = { coverUrl: "https://example.com/cover.jpg" }`
- WHEN a client requests the book's display information in English
- THEN the returned DTO SHALL expose `coverUrl = "https://example.com/cover.jpg"` resolved from the translation's `extra` field
- AND no `coverUrl` column SHALL be read from the Book table

### Requirement: ISBN lookup

The Book model SHALL support an optional `isbn13` field (VarChar(32)) indexed for fast lookup. The system SHALL allow querying books by ISBN-13 value. Multiple books MAY share the same ISBN-13 (e.g., work and release entries for the same physical book).

#### Scenario: Look up a book by ISBN-13

- GIVEN a Book record with `unitId = "unit-1"` and `isbn13 = "9780743273565"`
- WHEN a client queries for books with `isbn13 = "9780743273565"`
- THEN the system SHALL return the Book record with `unitId = "unit-1"`

#### Scenario: Book created without ISBN

- WHEN a Book record is created without specifying `isbn13`
- THEN the Book SHALL be created with `isbn13 = null`
- AND the Book SHALL still be discoverable via other query paths (unit id, title search via UnitTranslation, etc.)

### Requirement: BookContentStructure for chapter table of contents

The `BookContentStructure` model SHALL store a Book's table-of-contents tree using a normalized one-row-per-node design. `BookContentStructure` itself is a 1:1 extension of `Book` (`bookUnitId` PK, FK to `Book.unitId`, cascade-delete on Book deletion); it carries no `nodes` column. Tree contents live in a related `BookContentStructureNode` table with `bookUnitId` foreign keys back to the container.

The container `BookContentStructure.updatedAt` SHALL reflect **structure-shape changes only** — i.e., a node was inserted, removed, moved, renamed, or had its `rating` / `noContent` flag changed. Per-chapter content edits (chapter body text edits) SHALL NOT bump `BookContentStructure.updatedAt`; they bump only the affected `BookContentStructureNode.updatedAt` (see "Per-node updatedAt is propagated from chapter content edits").

The on-the-wire shape returned to clients SHALL remain a nested `ChapterTreeItem[]` tree assembled server-side from the row data (see "ChapterTreeItem wire shape gains optional id and updatedAt").

#### Scenario: Create a content structure container for a book

- GIVEN a Book with `unitId = "unit-1"`
- WHEN the system creates a BookContentStructure with `bookUnitId = "unit-1"`
- THEN the BookContentStructure row SHALL be persisted with `bookUnitId = "unit-1"` and auto-generated `createdAt` / `updatedAt`
- AND the BookContentStructure SHALL be accessible via the Book's `contentStructure` relation
- AND the BookContentStructure row SHALL NOT carry a `nodes` column

#### Scenario: Structure-shape change bumps container updatedAt

- GIVEN a BookContentStructure with `bookUnitId = "unit-1"` and one or more child nodes
- WHEN a TOC editor save inserts a new node, removes a node, moves a node, renames a node, or changes a node's `rating` / `noContent`
- THEN the container `BookContentStructure.updatedAt` SHALL be set to the current timestamp
- AND every mutated `BookContentStructureNode` row's `updatedAt` SHALL also be set to the current timestamp

#### Scenario: Chapter content edit does not bump container updatedAt

- GIVEN a chapter Unit "ch-1" linked to a `BookContentStructureNode` whose `bookUnitId = "unit-1"`
- WHEN the chapter Unit's body content is edited (no structural change to the TOC)
- THEN only the linked `BookContentStructureNode.updatedAt` SHALL be set to the current timestamp
- AND the container `BookContentStructure.updatedAt` SHALL NOT change

#### Scenario: Cascade delete BookContentStructure and its nodes when Book is deleted

- GIVEN a Book with `unitId = "unit-1"`, an associated BookContentStructure, and N child `BookContentStructureNode` rows
- WHEN the Book record is deleted
- THEN the BookContentStructure row SHALL also be deleted via cascade
- AND every BookContentStructureNode row whose `bookUnitId = "unit-1"` SHALL also be deleted via cascade

### Requirement: BookContentStructure cache write rule is frontend-owned

The denormalized fields on each `BookContentStructureNode` row (`title`, `noContent`, `rating`) SHALL be constructed and written by the frontend TOC editor. The server SHALL persist these fields as opaque cache values and SHALL NOT enforce the rating cache write rule. The chapter Unit's `rating` field remains the source of truth; `BookContentStructureNode.rating` acts as a render-time cache of deltas.

When the frontend writes a node for a chapter, it SHALL apply the rule:

```
if (chapter.rating !== book.rating) node.rating = chapter.rating
else omit node.rating
```

#### Scenario: Frontend omits matching rating

- GIVEN book `rating = GENERAL` and chapter `rating = GENERAL`
- WHEN the frontend serializes the node for save
- THEN the submitted node SHALL NOT include a `rating` key
- AND the persisted `BookContentStructureNode.rating` SHALL be NULL

#### Scenario: Frontend includes diverging rating

- GIVEN book `rating = GENERAL` and chapter `rating = R_18`
- WHEN the frontend serializes the node for save
- THEN the submitted node SHALL include `rating: "R_18"`
- AND the persisted `BookContentStructureNode.rating` SHALL be `R_18`

### Requirement: TOC editor — resync index overrides action

The TOC editor SHALL expose an action (button) that recomputes every node's `rating` override from scratch using the current Book Unit rating and each chapter Unit's current rating. The action SHALL NOT modify any chapter Unit's `rating`. The action SHALL apply all `BookContentStructureNode` updates in a single transaction, and SHALL bump `BookContentStructure.updatedAt` once at the end.

#### Scenario: Resync after Book rating change

- GIVEN a Book Unit with `rating` changed from `R_18` to `GENERAL`
- AND 10 chapter Units that still have `rating = R_18`, each linked to a `BookContentStructureNode`
- WHEN the maintainer clicks the "Resync index overrides" action
- THEN every linked `BookContentStructureNode.rating` SHALL be set to `R_18`
- AND no chapter Unit's `rating` field SHALL be changed
- AND `BookContentStructure.updatedAt` SHALL be bumped exactly once

#### Scenario: Resync removes stale overrides

- GIVEN a `BookContentStructureNode` for "ch-1" with `rating = R_15` but the chapter Unit's `rating` is now `GENERAL` and the Book Unit's `rating` is also `GENERAL`
- WHEN the maintainer clicks "Resync index overrides"
- THEN the `BookContentStructureNode.rating` for "ch-1" SHALL be set to NULL

### Requirement: TOC editor — multi-select batch rating edit

The TOC editor SHALL allow the maintainer to select multiple chapter entries and apply a single `ContentRating` value to all selected chapters in one operation. Each selected chapter's `Unit.rating` SHALL be updated on the server. After the batch update completes, the linked `BookContentStructureNode.rating` overrides SHALL be recomputed per the standard write rule and persisted in the same transaction.

#### Scenario: Batch-edit three chapters

- GIVEN a Book Unit with `rating = R_15` and chapter Units "ch-1", "ch-2", "ch-3" each with `rating = R_15` and each linked to a node
- WHEN the maintainer selects "ch-1" and "ch-2" in the TOC editor and applies `rating = R_18`
- THEN the chapter Units "ch-1" and "ch-2" SHALL be updated to `rating = R_18`
- AND the chapter Unit "ch-3" SHALL remain at `rating = R_15`
- AND the `BookContentStructureNode.rating` for "ch-1" and "ch-2" SHALL be `R_18`
- AND the `BookContentStructureNode.rating` for "ch-3" SHALL be NULL

#### Scenario: Batch-edit is explicit (no implicit propagation)

- GIVEN a Book Unit whose `rating` changed from `GENERAL` to `R_15`
- WHEN no batch-edit action is invoked
- THEN no chapter Unit's `rating` value SHALL be changed by the Book rating update alone
- AND no `BookContentStructureNode.rating` SHALL be changed

### Requirement: Chapter Unit materialization is on-demand

The system SHALL materialize a Chapter Unit only when an action requires Unit identity for a `BookContentStructureNode`. Such actions include chapter-specific progress, review, discussion, and storing chapter body content. Plain TOC display, opening an empty chapter surface, and book-level progress position updates SHALL NOT materialize a Chapter Unit.

The materialization operation SHALL be addressed by `bookUnitId` and a `BookContentStructurePath` (number array indexing into the assembled tree). The server SHALL resolve the path against current `BookContentStructureNode` rows (walking children ordered by `sortKey` at each level) to locate the target row. It SHALL return the existing `chapterUnitId` if the row already has one, or create the required `Unit(type=POST)`, `Post(kind=CHAPTER)`, and `UnitTranslation` rows and write the resulting Unit id into `BookContentStructureNode.chapterUnitId`.

#### Scenario: Materialize for a chapter-specific review

- GIVEN a `BookContentStructureNode` resolved from path `[3]` has title "Chapter Four" and `chapterUnitId = NULL`
- WHEN an authenticated user starts a chapter-specific review for that path
- THEN the system SHALL materialize a Chapter Unit for the node
- AND the review SHALL target the returned `chapterUnitId`
- AND the `BookContentStructureNode` row SHALL be updated with that `chapterUnitId`

#### Scenario: Return existing materialized chapter id

- GIVEN a `BookContentStructureNode` resolved from path `[3]` already has `chapterUnitId = "chapter-1"`
- WHEN a caller requests materialization for path `[3]`
- THEN the system SHALL return `chapterUnitId = "chapter-1"`
- AND the system SHALL NOT create a duplicate Unit, Post, or UnitTranslation row

#### Scenario: Empty chapter view does not materialize

- GIVEN a `BookContentStructureNode` resolved from path `[2, 0]` has `chapterUnitId = NULL`
- WHEN a user opens the empty chapter surface for that path
- THEN the system SHALL render the node metadata
- AND the system SHALL NOT create a Chapter Unit until the user performs an action that requires Unit identity

#### Scenario: Book-level progress stores path without materialization

- GIVEN a user is reading a node at path `[2, 0]` with `chapterUnitId = NULL`
- WHEN the system updates book-level progress for the parent Book Unit
- THEN the system MAY store the serialized path in the book Unit progress row's `lastPosition`
- AND the system SHALL NOT create a Chapter Unit only to store that book-level position

### Requirement: Materialization rejects stale BookContentStructure paths

The materialization operation SHALL detect when the requested path no longer resolves to the expected `BookContentStructureNode`. Callers SHOULD provide expected node metadata such as `expectedTitle` and/or the container `BookContentStructure.updatedAt` value they observed (`expectedBookContentStructureUpdatedAt`). If the current row at the resolved path doesn't match the expected title, or if the container `updatedAt` doesn't match, the operation SHALL reject with a conflict response and SHALL NOT create or link a Chapter Unit.

#### Scenario: Path no longer matches expected title

- GIVEN a client observed path `[1]` with title "Chapter Two"
- AND the BookContentStructure was later reordered so the node at path `[1]` now has title "Chapter Five"
- WHEN the client requests materialization for path `[1]` with `expectedTitle = "Chapter Two"`
- THEN the system SHALL reject the request with a conflict response
- AND no Unit, Post, or UnitTranslation row SHALL be created
- AND no `BookContentStructureNode` row SHALL be modified

#### Scenario: Concurrent materialization is idempotent

- GIVEN two requests concurrently materialize the same path resolving to the same `BookContentStructureNode`
- WHEN one request creates and links a Chapter Unit first
- THEN the other request SHALL observe the linked `chapterUnitId` and return it
- AND only one Chapter Unit SHALL be created for that node

### Requirement: Legacy BookContentStructure node id migration

The system SHALL migrate legacy BookContentStructure nodes that contain `id` as chapter Unit identity into the new `chapterUnitId` field. After migration, persisted BookContentStructure nodes SHALL NOT rely on `id`.

#### Scenario: Migrate legacy chapter Unit id

- GIVEN a legacy BookContentStructure node `{ "id": "chapter-1", "title": "Chapter One" }`
- AND `chapter-1` references an existing materialized Chapter Unit
- WHEN the migration runs
- THEN the persisted node SHALL become `{ "title": "Chapter One", "chapterUnitId": "chapter-1" }`
- AND the persisted node SHALL NOT contain `id`

#### Scenario: Drop legacy unknown id during dev migration

- GIVEN a legacy BookContentStructure node contains `id = "imported-local-1"` that does not reference an existing Chapter Unit
- WHEN the dev-stage migration runs
- THEN it SHALL NOT treat `imported-local-1` as a `chapterUnitId`
- AND it SHALL NOT create a Chapter Unit only to preserve the old `id`
- AND the persisted node SHALL NOT contain `id`

### Requirement: Migration from old Book model

The migration SHALL transfer data from the current Book model to the new schema. `Book.title` and `Book.description` SHALL be migrated to `UnitTranslation` records. `Book.language` SHALL be migrated to `UnitSupportLanguage` records. `Book.anchorId` SHALL be migrated to `Unit.workUnitId`. `Book.author`, `Book.press`, and `Book.producer` M2M relations SHALL be migrated to `PersonCredit` and `OrgCredit` records with appropriate `roleKey` values. `Book.coverUrl` SHALL be replaced by creating IMAGE units and setting `coverAssetUnitId`. `Book.tags` (String[]) SHALL be migrated to `UnitTag` records referencing existing or newly created TAG units.

#### Scenario: Migrate Book.title and Book.description to UnitTranslation

- GIVEN an old Book record with `unitId = "unit-1"`, `title = "The Great Gatsby"`, `description = "A novel by F. Scott Fitzgerald"`, and `language = "en"`
- WHEN the migration runs
- THEN a `UnitTranslation` record SHALL be created with `unitId = "unit-1"`, `language = "en"`, `title = "The Great Gatsby"`, `description = "A novel by F. Scott Fitzgerald"`
- AND the `title` and `description` columns SHALL be removed from the Book table

#### Scenario: Migrate Book.anchorId to Unit.workUnitId

- GIVEN an old Book record with `unitId = "unit-1"` and `anchorId = "work-1"`
- WHEN the migration runs
- THEN the corresponding Unit record SHALL have `workUnitId = "work-1"`
- AND the `anchorId` column SHALL be removed from the Book table

#### Scenario: Migrate Book.author to PersonCredit

- GIVEN an old Book record with `unitId = "unit-1"` linked to a User with `unitId = "author-1"` via the author M2M relation
- WHEN the migration runs
- THEN a `PersonCredit` record SHALL be created linking `unitId = "unit-1"` to the corresponding Person entity with `roleKey = "author"`
- AND the author M2M relation SHALL be removed from the Book table

### Requirement: BookContentStructureNode normalized row model

The system SHALL store one `BookContentStructureNode` row per TOC node. Each row SHALL carry:

- `id` (UUID, primary key)
- `bookUnitId` (UUID, FK to `Book.unitId`, NOT NULL, cascade-delete)
- `parentId` (UUID, FK to self.id, NULL when the node is a root of the tree)
- `sortKey` (text, NOT NULL) — base36 LexoRank string used to order siblings
- `chapterUnitId` (UUID, FK to chapter Unit, NULL until the node is materialized; NOT unique because multiple nodes MAY reference the same chapter; `ON DELETE SET NULL` so chapter deletion leaves node placeholders intact — see "Multiple BookContentStructureNode rows may reference the same chapter Unit")
- `title` (text, NOT NULL) — denormalized cache, frontend-written
- `noContent` (boolean, NOT NULL, default false) — true for purely structural nodes (section headers without body)
- `rating` (ContentRating enum, NULL when matching the parent Book's rating)
- `createdAt` (timestamp, NOT NULL, default now)
- `updatedAt` (timestamp, NOT NULL, auto-updated)

The table SHALL be indexed on `(bookUnitId, parentId, sortKey)` for ordered child fetch, on `(chapterUnitId)` for reverse lookup from chapter to node, and on `(bookUnitId, updatedAt DESC)` for "recently updated nodes" queries.

#### Scenario: Insert a child node under an existing parent

- GIVEN a BookContentStructure for book `"unit-1"` exists with a node `n1` (`id = "node-1"`, `parentId = NULL`)
- WHEN the system inserts a new `BookContentStructureNode` with `parentId = "node-1"`, `title = "Section A"`, `sortKey = "g"`
- THEN the new row SHALL be persisted with the supplied `parentId`, `title`, `sortKey`
- AND `(bookUnitId, parentId, sortKey)` SHALL be queryable to return this row

#### Scenario: Same chapter Unit referenced from multiple nodes is allowed

- GIVEN two `BookContentStructureNode` rows with the same `chapterUnitId = "ch-1"`
- WHEN inspecting the table
- THEN both rows SHALL coexist without unique-constraint violation
- AND a lookup by `chapterUnitId = "ch-1"` SHALL return both rows

### Requirement: Sibling ordering uses LexoRank sortKey

Sibling nodes (rows sharing the same `bookUnitId` and `parentId`) SHALL be ordered by lexicographic comparison of their `sortKey` field. The system SHALL assign `sortKey` values such that:

- A new sibling appended at the end receives a `sortKey` strictly greater than every existing sibling's `sortKey`.
- A new sibling inserted between two existing siblings receives a `sortKey` strictly between the two adjacent `sortKey` values.
- A node moved (re-parented or reordered) receives a single `sortKey` update; its descendants SHALL NOT be touched.

The system SHALL never renumber existing siblings to make room for a new insertion or move.

#### Scenario: Insert between two siblings is a single-row write

- GIVEN three sibling nodes `A.sortKey = "g"`, `B.sortKey = "n"`, `C.sortKey = "u"` under the same parent
- WHEN the system inserts a new node `X` between `A` and `B`
- THEN exactly one `INSERT` SHALL be issued for `X` with `X.sortKey` lexicographically between `"g"` and `"n"`
- AND the `sortKey` of `A`, `B`, and `C` SHALL be unchanged

#### Scenario: Move single node is a single-row update

- GIVEN a node `X` with `parentId = "p1"` and `sortKey = "m"`
- WHEN the system moves `X` to become a sibling under `parentId = "p2"` between two existing siblings
- THEN exactly one `UPDATE` SHALL be issued for `X` setting its new `parentId` and new `sortKey`
- AND no other row's `parentId` or `sortKey` SHALL change

#### Scenario: Move subtree only updates the root node

- GIVEN a node `X` with 200 descendants
- WHEN the system moves `X` (and its subtree) to a new parent
- THEN exactly one `UPDATE` SHALL be issued for `X` (its `parentId` and `sortKey`)
- AND the descendant rows' `parentId` and `sortKey` SHALL NOT change
- AND the descendants SHALL remain reachable as the subtree of `X` via the `parentId` chain

### Requirement: Multiple BookContentStructureNode rows may reference the same chapter Unit

A single chapter Unit MAY be referenced from any number of `BookContentStructureNode` rows — within the same book or across books. The `chapterUnitId` column SHALL NOT carry a UNIQUE constraint at the DB level. All server-side flows that mutate node rows or propagate from chapter mutations SHALL handle the "multiple linked nodes" case correctly:

- The diff-based TOC save (see "TOC editor save uses diff-based row mutations") SHALL accept a submitted tree where two or more nodes carry the same `chapterUnitId` (whether matching an existing row's `chapterUnitId` in this book or supplied by the client as a known materialized chapter id) without rejecting or de-duplicating.
- Chapter content edit propagation (see "Per-node updatedAt is propagated from chapter content edits") SHALL bump the `updatedAt` of **every** node whose `chapterUnitId` matches the edited chapter, not just one.
- Chapter title rename propagation SHALL update the denormalized `title` on **every** node whose `chapterUnitId` matches the renamed chapter, in the same transaction as the `UnitTranslation.title` update.
- Materialization (see "Chapter Unit materialization is on-demand") SHALL NOT remove `chapterUnitId` from any node when materializing another path; node-to-chapter relationships are owned by the TOC editor's save flow, not by materialization.
- Cascade delete of a chapter Unit SHALL leave all referencing `BookContentStructureNode` rows in place with `chapterUnitId = NULL` (so the TOC structure survives chapter deletion). This is implemented via `ON DELETE SET NULL` on the `chapterUnitId` foreign key.

This capability supports TOC patterns such as "preface appears as both a top-level entry and inside the bibliography section," "the same chapter is reachable from multiple table-of-contents organizations," and "factory/test fixtures verifying the multi-link contract."

#### Scenario: TOC save creates two nodes pointing at the same chapter

- GIVEN a book "unit-1" with one existing chapter Unit "ch-1" already materialized at exactly one node
- WHEN the TOC editor submits a tree that contains two nodes both with `chapterUnitId = "ch-1"` (one existing, one new)
- THEN the save SHALL succeed without conflict
- AND after the save two `BookContentStructureNode` rows SHALL exist with `chapterUnitId = "ch-1"` in book "unit-1"
- AND a query for nodes by `chapterUnitId = "ch-1"` SHALL return both rows

#### Scenario: Title rename propagates to every linked node

- GIVEN a chapter Unit "ch-1" linked from three `BookContentStructureNode` rows (some in book "unit-1", some in book "unit-2")
- WHEN the chapter Unit's `UnitTranslation.title` is renamed
- THEN every one of the three node rows SHALL have its denormalized `title` updated to the new value in the same transaction
- AND the container `BookContentStructure.updatedAt` of every affected book SHALL be bumped (since title is a structure-shape field)

#### Scenario: Chapter deletion leaves nodes in place with NULL chapterUnitId

- GIVEN a chapter Unit "ch-1" linked from two `BookContentStructureNode` rows
- WHEN the chapter Unit is deleted
- THEN both node rows SHALL remain in the table
- AND both rows SHALL have `chapterUnitId = NULL`
- AND the denormalized `title` on those rows SHALL NOT be cleared (the TOC editor surface treats title-without-chapterUnitId as a `noContent`-style placeholder)

### Requirement: Per-node updatedAt is propagated from chapter content edits

When a chapter Unit's body content is edited via the chapter service, every `BookContentStructureNode` row whose `chapterUnitId` matches the edited chapter SHALL have its `updatedAt` set to the current timestamp in the same transaction. The container `BookContentStructure.updatedAt` SHALL NOT be modified by this propagation.

#### Scenario: Chapter body edit updates linked node updatedAt

- GIVEN a chapter Unit "ch-1" linked to exactly one `BookContentStructureNode` row `n1` in book "unit-1"
- WHEN the chapter Unit's body is edited
- THEN `n1.updatedAt` SHALL be set to the current timestamp
- AND `BookContentStructure.updatedAt` for book "unit-1" SHALL NOT change

#### Scenario: Same chapter referenced from multiple nodes propagates to all

- GIVEN a chapter Unit "ch-shared" linked to two `BookContentStructureNode` rows `n1` and `n2`
- WHEN the chapter Unit's body is edited
- THEN both `n1.updatedAt` and `n2.updatedAt` SHALL be set to the current timestamp

### Requirement: ChapterTreeItem wire shape gains optional id and updatedAt

The `ChapterTreeItem` type returned to clients SHALL include two new optional fields:

- `id?: string` — the `BookContentStructureNode.id` of this node, populated on reads. On writes, the server SHALL use this value to identify which existing row the submitted node corresponds to; nodes submitted without `id` SHALL be treated as new and inserted.
- `updatedAt?: string` — the `BookContentStructureNode.updatedAt` of this node, populated on reads. On writes the server SHALL ignore any client-supplied value for this field.

The existing fields (`title`, `chapterUnitId`, `noContent`, `rating`, `children`) SHALL retain their current shape and semantics. Both new fields SHALL be optional in the schema so that clients constructed before this change continue to validate.

#### Scenario: Reads include id and updatedAt on every node

- GIVEN a BookContentStructure with three nodes
- WHEN a client reads the content structure
- THEN every node in the response SHALL include a non-empty `id` (the row PK)
- AND every node SHALL include `updatedAt` (ISO 8601 timestamp)

#### Scenario: Write with id updates the matching row

- GIVEN a `BookContentStructureNode` row exists with `id = "node-1"` and `title = "Old"`
- WHEN the TOC editor submits a tree where the node with `id = "node-1"` has `title = "New"`
- THEN the existing row SHALL be updated to `title = "New"`
- AND no new row SHALL be inserted for that node

#### Scenario: Write without id inserts a new row

- GIVEN a `BookContentStructureNode` row exists with `id = "node-1"`
- WHEN the TOC editor submits a tree with a new node (no `id` field) as a sibling of `node-1`
- THEN a new `BookContentStructureNode` row SHALL be inserted with a server-generated `id` and a freshly assigned `sortKey`
- AND the existing `node-1` row SHALL NOT be deleted or modified

#### Scenario: Client-supplied updatedAt is ignored on write

- GIVEN the TOC editor submits a node with `updatedAt = "2020-01-01T00:00:00Z"`
- WHEN the server processes the save
- THEN the persisted row's `updatedAt` SHALL be set by the server (current timestamp on actual change; otherwise unchanged)
- AND the client-supplied value SHALL be ignored

### Requirement: TOC editor save uses diff-based row mutations

The endpoint that saves a whole TOC tree (`PUT /books/:bookUnitId/content-structure`) SHALL diff the submitted tree against current `BookContentStructureNode` rows and apply only the minimum set of mutations in a single transaction:

- A submitted node with an `id` matching an existing row, where any persisted field (`parentId`, `sortKey`, `title`, `noContent`, `rating`, `chapterUnitId`) differs, SHALL produce one `UPDATE`.
- A submitted node without an `id`, or with an `id` not matching any existing row of that book, SHALL produce one `INSERT`.
- An existing row whose `id` is not present in the submitted tree SHALL produce one `DELETE`.

A submission that is structurally identical to the current state SHALL produce zero row mutations.

#### Scenario: Single chapter rename produces a single update

- GIVEN a book with 50 `BookContentStructureNode` rows
- WHEN the TOC editor submits the same tree with exactly one node's `title` changed
- THEN exactly one `UPDATE` SHALL be issued against the matching row
- AND `BookContentStructure.updatedAt` SHALL be bumped once

#### Scenario: No-op save issues no mutations

- GIVEN a book with N `BookContentStructureNode` rows
- WHEN the TOC editor submits the exact current tree (no field differs on any node, no nodes added or removed)
- THEN zero `INSERT`, `UPDATE`, or `DELETE` operations SHALL be issued against `BookContentStructureNode`
- AND `BookContentStructure.updatedAt` SHALL NOT change

#### Scenario: Delete a subtree

- GIVEN a node `X` with 5 descendants
- WHEN the TOC editor submits a tree that omits `X` and its descendants entirely
- THEN 6 `DELETE` operations SHALL be issued (X and its 5 descendants)
- AND `BookContentStructure.updatedAt` SHALL be bumped once

### Requirement: One-time migration from BookContentStructure.nodes JSON to rows

The system SHALL provide a one-time migration script that converts every existing `BookContentStructure.nodes` JSON value into a set of `BookContentStructureNode` rows. The migration SHALL preserve sibling order via assigned `sortKey` values, preserve every node's `chapterUnitId`, `title`, `noContent`, and `rating` fields, and produce a tree structurally identical to the source JSON. The migration SHALL be runnable against the dev database and SHALL NOT drop the legacy `nodes` column until a verification pass confirms parity for every book.

#### Scenario: Migration preserves order and parent-child relationships

- GIVEN a legacy `BookContentStructure.nodes = [{title: "A", children: [{title: "A.1"}, {title: "A.2"}]}, {title: "B"}]`
- WHEN the migration runs
- THEN four `BookContentStructureNode` rows SHALL exist for that book
- AND the row for "A" SHALL have `parentId = NULL` and `sortKey < ` the row for "B"
- AND the rows for "A.1" and "A.2" SHALL both have `parentId = ` the row id of "A"
- AND the `sortKey` of "A.1" SHALL be lexicographically less than the `sortKey` of "A.2"

#### Scenario: Migration verification compares assembled tree to source JSON

- GIVEN the migration completes the row inserts for all books
- WHEN the verification pass runs
- THEN for each book it SHALL fetch all `BookContentStructureNode` rows, assemble them into a tree, and compare structurally to the source JSON (titles, children order, `chapterUnitId`, `noContent`, `rating`)
- AND if any divergence is found, the verification pass SHALL log the offending `bookUnitId` and exit non-zero without dropping the legacy `nodes` column

#### Scenario: Legacy nodes column dropped after parity confirmed

- GIVEN verification has confirmed parity for every BookContentStructure row
- WHEN the cleanup Prisma migration runs
- THEN the `BookContentStructure.nodes` column SHALL be dropped from the schema
- AND no server code SHALL read or write `BookContentStructure.nodes` after this point
