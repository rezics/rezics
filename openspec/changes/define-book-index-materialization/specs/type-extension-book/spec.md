## MODIFIED Requirements

### Requirement: BookIndex for chapter table of contents

The BookIndex model SHALL store a JSON-based chapter table of contents for a Book. It has a 1:1 relationship with Book via `bookUnitId` as its primary key. The `index` field (Json, required) contains the structured chapter listing and SHALL default to an empty array (`[]`) for books with no known chapter structure. Deleting the parent Book SHALL cascade-delete the BookIndex.

Each node in `index` SHALL conform to the following shape:

```
{
  title: string,
  noContent?: boolean,
  chapterUnitId?: string,  // optional materialized Chapter Unit id
  children?: IndexNode[],
  rating?: ContentRating   // optional override or materialization seed
}
```

BookIndex nodes SHALL NOT require an `id` field. A node's occurrence inside one BookIndex SHALL be located by its path in the forest, where `[2, 4, 0]` means the first child of the fifth child of the third root node. A path is a locator for the current BookIndex structure and SHALL NOT be treated as a permanent global identity.

The `chapterUnitId` field SHALL be present only when the node is linked to a materialized Chapter Unit. It SHALL be optional and SHALL NOT be required to be unique inside one BookIndex. Multiple node occurrences MAY reference the same `chapterUnitId`.

For a node with `chapterUnitId`, the `rating` field is a denormalized cache of the chapter Unit's `rating` value, stored ONLY when it differs from the parent Book Unit's `rating`. It is NOT the source of truth for materialized chapter rating; the chapter `Unit.rating` is. For a node without `chapterUnitId`, `rating` is inline BookIndex metadata and MAY be used as the initial chapter Unit rating if the node is later materialized.

#### Scenario: Create an empty chapter index for a book

- GIVEN a Book with `unitId = "unit-1"`
- WHEN the system creates a BookIndex for that book without known chapters
- THEN the BookIndex record SHALL be persisted with `bookUnitId = "unit-1"` and `index = []`
- AND the BookIndex SHALL be accessible via the Book's `chapterIndex` relation

#### Scenario: Persist imported chapter metadata without materializing a chapter

- GIVEN a Book with `unitId = "book-1"`
- WHEN the system imports a table of contents node `{ "title": "Chapter One" }`
- THEN the BookIndex SHALL persist the node without requiring `id`
- AND the node SHALL NOT require `chapterUnitId`
- AND no Unit, Post, or UnitTranslation row SHALL be created only because the node exists

#### Scenario: Persist a materialized chapter reference

- GIVEN a Book with `unitId = "book-1"`
- AND a materialized Chapter Unit with `unitId = "chapter-1"`
- WHEN the system writes a BookIndex node `{ "title": "Chapter One", "chapterUnitId": "chapter-1" }`
- THEN the BookIndex SHALL persist the node with `chapterUnitId = "chapter-1"`

#### Scenario: Allow repeated materialized chapter references

- GIVEN a BookIndex for `bookUnitId = "book-1"`
- WHEN two different node paths both contain `chapterUnitId = "chapter-1"`
- THEN the BookIndex SHALL be valid
- AND consumers that need node occurrence state SHALL key that state by path
- AND consumers that need Unit-scoped engagement SHALL key that state by `chapterUnitId`

#### Scenario: Update an existing chapter index

- GIVEN a BookIndex with `bookUnitId = "unit-1"` and an existing index
- WHEN the owner updates the `index` field with a new chapter listing
- THEN the BookIndex SHALL reflect the updated JSON
- AND `updatedAt` SHALL be set to the current timestamp

#### Scenario: Cascade delete BookIndex when Book is deleted

- GIVEN a Book with `unitId = "unit-1"` and an associated BookIndex
- WHEN the Book record is deleted
- THEN the associated BookIndex record SHALL also be deleted via cascade

### Requirement: BookIndex cache write rule is frontend-owned

The BookIndex `index` JSON SHALL be constructed and written by the frontend TOC editor. The server SHALL persist the JSON as the BookIndex aggregate and SHALL NOT materialize Chapter Units during ordinary BookIndex saves. The chapter Unit's `rating` field remains the source of truth for materialized chapters; BookIndex acts as a render-time cache of rating deltas for nodes with `chapterUnitId`.

When the frontend writes a materialized node, it SHALL apply the rule:

```
if (chapter.rating !== book.rating) node.rating = chapter.rating
else omit node.rating
```

When the frontend writes an unmaterialized node, it MAY include `rating` only as inline BookIndex metadata. Writing that inline metadata SHALL NOT create a chapter Unit.

#### Scenario: Frontend omits matching rating for a materialized chapter

- GIVEN book `rating = GENERAL`
- AND materialized chapter `chapterUnitId = "chapter-1"` has `rating = GENERAL`
- WHEN the frontend serializes the BookIndex node
- THEN the serialized node SHALL NOT include a `rating` key

#### Scenario: Frontend includes diverging rating for a materialized chapter

- GIVEN book `rating = GENERAL`
- AND materialized chapter `chapterUnitId = "chapter-1"` has `rating = R_18`
- WHEN the frontend serializes the BookIndex node
- THEN the serialized node SHALL include `rating: "R_18"`

#### Scenario: Inline rating does not materialize a chapter

- GIVEN an unmaterialized BookIndex node with no `chapterUnitId`
- WHEN the frontend writes the node with `rating = R_15`
- THEN the system SHALL persist the inline rating metadata
- AND the system SHALL NOT create a Unit, Post, or UnitTranslation row only because the rating was written

#### Scenario: Inline rating seeds materialized chapter rating

- GIVEN an unmaterialized BookIndex node with `rating = R_15`
- WHEN the node is materialized into a Chapter Unit
- THEN the created chapter Unit SHALL be initialized with `rating = R_15`

### Requirement: TOC editor - resync index overrides action

The TOC editor SHALL expose an action (button) that recomputes every materialized node's `rating` override from scratch using the current Book Unit rating and each linked chapter Unit's current rating. The action SHALL NOT modify any chapter Unit's `rating`. The action SHALL NOT materialize unmaterialized nodes. For unmaterialized nodes, the action SHALL preserve inline `rating` metadata unless it equals the parent Book rating, in which case it MAY omit the redundant field.

#### Scenario: Resync after Book rating change

- GIVEN a Book Unit with `rating` changed from `R_18` to `GENERAL`
- AND 10 materialized chapter Units that still have `rating = R_18`
- WHEN the maintainer clicks the "Resync index overrides" action
- THEN every linked BookIndex node SHALL include `rating: "R_18"`
- AND no chapter Unit's `rating` field SHALL be changed

#### Scenario: Resync removes stale materialized override

- GIVEN a BookIndex where node path `[0]` has `chapterUnitId = "ch-1"` and `rating: "R_15"`
- AND the chapter Unit "ch-1" has `rating = GENERAL`
- AND the Book Unit also has `rating = GENERAL`
- WHEN the maintainer clicks "Resync index overrides"
- THEN the updated node at path `[0]` SHALL NOT include a `rating` field

#### Scenario: Resync does not materialize an empty node

- GIVEN a BookIndex node at path `[1]` with no `chapterUnitId`
- WHEN the maintainer clicks "Resync index overrides"
- THEN the node SHALL remain without `chapterUnitId`
- AND no Unit, Post, or UnitTranslation row SHALL be created for that node

### Requirement: TOC editor - multi-select batch rating edit

The TOC editor SHALL allow the maintainer to select multiple chapter entries and apply a single `ContentRating` value to all selected entries in one operation. For selected nodes with `chapterUnitId`, each linked chapter Unit's `Unit.rating` SHALL be updated on the server. For selected nodes without `chapterUnitId`, the BookIndex node's inline `rating` metadata SHALL be updated instead. Batch rating edit SHALL NOT materialize unmaterialized nodes only to store a rating.

After the batch update completes, the BookIndex node overrides SHALL be recomputed per the standard write rule and persisted.

#### Scenario: Batch-edit materialized chapters

- GIVEN a Book Unit with `rating = R_15`
- AND materialized chapter Units "ch-1", "ch-2", "ch-3" each have `rating = R_15`
- WHEN the maintainer selects the BookIndex nodes for "ch-1" and "ch-2" and applies `rating = R_18`
- THEN the chapter Units "ch-1" and "ch-2" SHALL be updated to `rating = R_18`
- AND the chapter Unit "ch-3" SHALL remain at `rating = R_15`
- AND the BookIndex nodes for "ch-1" and "ch-2" SHALL include `rating: "R_18"`
- AND the BookIndex node for "ch-3" SHALL NOT include a `rating` field

#### Scenario: Batch-edit unmaterialized chapters

- GIVEN a Book Unit with `rating = GENERAL`
- AND unmaterialized BookIndex nodes at paths `[0]` and `[1]`
- WHEN the maintainer selects both nodes and applies `rating = R_15`
- THEN both BookIndex nodes SHALL be persisted with `rating = R_15`
- AND neither node SHALL gain `chapterUnitId`
- AND no Unit, Post, or UnitTranslation row SHALL be created for either node

#### Scenario: Batch-edit is explicit (no implicit propagation)

- GIVEN a Book Unit whose `rating` changed from `GENERAL` to `R_15`
- WHEN no batch-edit action is invoked
- THEN no chapter Unit's `rating` value SHALL be changed by the Book rating update alone
- AND no unmaterialized BookIndex node SHALL be materialized by the Book rating update alone

## ADDED Requirements

### Requirement: Chapter Unit materialization is on-demand

The system SHALL materialize a Chapter Unit only when an action requires Unit identity for a BookIndex node. Such actions include chapter-specific progress, review, discussion, and storing chapter body content. Plain TOC display, opening an empty chapter surface, and book-level progress position updates SHALL NOT materialize a Chapter Unit.

The materialization operation SHALL be addressed by `bookUnitId` and BookIndex path. It SHALL resolve the current node at that path, return the existing `chapterUnitId` if one is already present, or create the required `Unit(type=POST)`, `Post(kind=CHAPTER)`, and `UnitTranslation` rows and write the resulting Unit id into `node.chapterUnitId`.

#### Scenario: Materialize for a chapter-specific review

- GIVEN a BookIndex node at path `[3]` has title "Chapter Four" and no `chapterUnitId`
- WHEN an authenticated user starts a chapter-specific review for that node
- THEN the system SHALL materialize a Chapter Unit for the node
- AND the review SHALL target the returned `chapterUnitId`
- AND the BookIndex node at path `[3]` SHALL be updated with that `chapterUnitId`

#### Scenario: Return existing materialized chapter id

- GIVEN a BookIndex node at path `[3]` already has `chapterUnitId = "chapter-1"`
- WHEN a caller requests materialization for path `[3]`
- THEN the system SHALL return `chapterUnitId = "chapter-1"`
- AND the system SHALL NOT create a duplicate Unit, Post, or UnitTranslation row

#### Scenario: Empty chapter view does not materialize

- GIVEN a BookIndex node at path `[2, 0]` has no `chapterUnitId`
- WHEN a user opens the empty chapter surface for that path
- THEN the system SHALL render the node metadata
- AND the system SHALL NOT create a Chapter Unit until the user performs an action that requires Unit identity

#### Scenario: Book-level progress stores path without materialization

- GIVEN a user is reading a BookIndex node at path `[2, 0]` with no `chapterUnitId`
- WHEN the system updates book-level progress for the parent Book Unit
- THEN the system MAY store the serialized path in the book Unit progress row's `lastPosition`
- AND the system SHALL NOT create a Chapter Unit only to store that book-level position

### Requirement: Materialization rejects stale BookIndex paths

The materialization operation SHALL detect when the requested path no longer resolves to the expected BookIndex node. Callers SHOULD provide expected node metadata such as title and/or the BookIndex `updatedAt` value they observed. If the current BookIndex no longer matches the expectation, the operation SHALL reject with a conflict response and SHALL NOT create or link a Chapter Unit.

#### Scenario: Path no longer matches expected title

- GIVEN a client observed path `[1]` with title "Chapter Two"
- AND the BookIndex was later reordered so path `[1]` now has title "Chapter Five"
- WHEN the client requests materialization for path `[1]` with expected title "Chapter Two"
- THEN the system SHALL reject the request with a conflict response
- AND no Unit, Post, or UnitTranslation row SHALL be created
- AND the BookIndex SHALL remain unchanged

#### Scenario: Concurrent materialization is idempotent

- GIVEN two requests concurrently materialize the same BookIndex path
- WHEN one request creates and links a Chapter Unit first
- THEN the other request SHALL observe the linked `chapterUnitId` and return it
- AND only one Chapter Unit SHALL be created for that path

### Requirement: Legacy BookIndex node id migration

The system SHALL migrate legacy BookIndex nodes that contain `id` as chapter Unit identity into the new `chapterUnitId` field. After migration, persisted BookIndex nodes SHALL NOT rely on `id`.

#### Scenario: Migrate legacy chapter Unit id

- GIVEN a legacy BookIndex node `{ "id": "chapter-1", "title": "Chapter One" }`
- AND `chapter-1` references an existing materialized Chapter Unit
- WHEN the migration runs
- THEN the persisted node SHALL become `{ "title": "Chapter One", "chapterUnitId": "chapter-1" }`
- AND the persisted node SHALL NOT contain `id`

#### Scenario: Preserve legacy unknown id as metadata only during compatibility normalization

- GIVEN a legacy BookIndex node contains `id = "imported-local-1"` that does not reference an existing Chapter Unit
- WHEN the compatibility normalizer reads the node
- THEN it SHALL NOT treat `imported-local-1` as a `chapterUnitId`
- AND it SHALL NOT create a Chapter Unit only to preserve the old `id`
