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

The BookContentStructure model SHALL store a JSON-based content structure for a Book. It has a 1:1 relationship with Book via `bookUnitId` as its primary key. The `nodes` field (Json, required) contains the structured content listing. Deleting the parent Book SHALL cascade-delete the BookContentStructure.

Each node in `nodes` SHALL conform to the following shape:

```
{
  title: string,
  chapterUnitId?: string,   // materialized chapter Unit id, optional and non-unique
  noContent?: boolean,
  children?: ContentStructureNode[],
  rating?: ContentRating    // OPTIONAL override; see write rule below
}
```

The `rating` field on a node is a denormalized cache of the chapter Unit's `rating` value, stored ONLY when it differs from the parent Book Unit's `rating`. It is NOT the source of truth for chapter rating; the chapter `Unit.rating` is. Consumers that need the authoritative chapter rating SHALL read from the chapter Unit directly; consumers rendering the TOC SHALL use `node.rating` (if present) or treat absence as "same as the Book's rating".

#### Scenario: Create a content structure for a book

- GIVEN a Book with `unitId = "unit-1"`
- WHEN the system creates a BookContentStructure with `bookUnitId = "unit-1"` and `nodes = [{"chapterUnitId": "ch-1", "title": "Chapter One", "noContent": false}]`
- THEN the BookContentStructure record SHALL be persisted with the provided JSON nodes
- AND the BookContentStructure SHALL be accessible via the Book's `contentStructure` relation

#### Scenario: Node rating is omitted when matching Book rating

- GIVEN a Book Unit "book-1" with `rating = R_15` and a chapter Unit "ch-1" with `rating = R_15`
- WHEN the frontend writes the BookContentStructure
- THEN the node for "ch-1" SHALL NOT contain a `rating` field

#### Scenario: Node rating is written when differing from Book rating

- GIVEN a Book Unit "book-1" with `rating = R_15` and a chapter Unit "ch-2" with `rating = R_18`
- WHEN the frontend writes the BookContentStructure
- THEN the node for "ch-2" SHALL include `rating: "R_18"`

#### Scenario: Update an existing content structure

- GIVEN a BookContentStructure with `bookUnitId = "unit-1"` and existing nodes
- WHEN the owner updates the `nodes` field with a new content listing
- THEN the BookContentStructure SHALL reflect the updated JSON
- AND `updatedAt` SHALL be set to the current timestamp

#### Scenario: Cascade delete BookContentStructure when Book is deleted

- GIVEN a Book with `unitId = "unit-1"` and an associated BookContentStructure
- WHEN the Book record is deleted
- THEN the associated BookContentStructure record SHALL also be deleted via cascade

### Requirement: BookContentStructure cache write rule is frontend-owned

The BookContentStructure `nodes` JSON SHALL be constructed and written by the frontend TOC editor. The server SHALL persist the JSON as opaque content-structure data and SHALL NOT enforce the rating cache write rule. The chapter Unit's `rating` field remains the source of truth; BookContentStructure acts as a render-time cache of deltas.

When the frontend writes a node for a chapter, it SHALL apply the rule:

```
if (chapter.rating !== book.rating) node.rating = chapter.rating
else omit node.rating
```

#### Scenario: Frontend omits matching rating

- GIVEN book `rating = GENERAL` and chapter `rating = GENERAL`
- WHEN the frontend serializes the node
- THEN the serialized node object SHALL NOT include a `rating` key

#### Scenario: Frontend includes diverging rating

- GIVEN book `rating = GENERAL` and chapter `rating = R_18`
- WHEN the frontend serializes the node
- THEN the serialized node SHALL include `rating: "R_18"`

### Requirement: TOC editor — resync index overrides action

The TOC editor SHALL expose an action (button) that recomputes every content-structure node's `rating` override from scratch using the current Book Unit rating and each chapter Unit's current rating. The action SHALL NOT modify any chapter Unit's `rating`. The action SHALL write the updated BookContentStructure in a single save.

#### Scenario: Resync after Book rating change

- GIVEN a Book Unit with `rating` changed from `R_18` to `GENERAL`
- AND 10 chapter Units that still have `rating = R_18`
- WHEN the maintainer clicks the "Resync index overrides" action
- THEN every node in the BookContentStructure SHALL include `rating: "R_18"`
- AND no chapter Unit's `rating` field SHALL be changed

#### Scenario: Resync removes stale overrides

- GIVEN a BookContentStructure where node "ch-1" has `rating: "R_15"` but the chapter Unit's `rating` is now `GENERAL` and the Book Unit's `rating` is also `GENERAL`
- WHEN the maintainer clicks "Resync index overrides"
- THEN the updated node "ch-1" SHALL NOT include a `rating` field

### Requirement: TOC editor — multi-select batch rating edit

The TOC editor SHALL allow the maintainer to select multiple chapter entries and apply a single `ContentRating` value to all selected chapters in one operation. Each selected chapter's `Unit.rating` SHALL be updated on the server. After the batch update completes, the BookContentStructure node overrides SHALL be recomputed per the standard write rule and persisted.

#### Scenario: Batch-edit three chapters

- GIVEN a Book Unit with `rating = R_15` and chapter Units "ch-1", "ch-2", "ch-3" each with `rating = R_15`
- WHEN the maintainer selects "ch-1" and "ch-2" in the TOC editor and applies `rating = R_18`
- THEN the chapter Units "ch-1" and "ch-2" SHALL be updated to `rating = R_18`
- AND the chapter Unit "ch-3" SHALL remain at `rating = R_15`
- AND the BookContentStructure nodes for "ch-1" and "ch-2" SHALL include `rating: "R_18"`
- AND the BookContentStructure node for "ch-3" SHALL NOT include a `rating` field

#### Scenario: Batch-edit is explicit (no implicit propagation)

- GIVEN a Book Unit whose `rating` changed from `GENERAL` to `R_15`
- WHEN no batch-edit action is invoked
- THEN no chapter Unit's `rating` value SHALL be changed by the Book rating update alone

### Requirement: Chapter Unit materialization is on-demand

The system SHALL materialize a Chapter Unit only when an action requires Unit identity for a BookContentStructure node. Such actions include chapter-specific progress, review, discussion, and storing chapter body content. Plain TOC display, opening an empty chapter surface, and book-level progress position updates SHALL NOT materialize a Chapter Unit.

The materialization operation SHALL be addressed by `bookUnitId` and BookContentStructure path. It SHALL resolve the current node at that path, return the existing `chapterUnitId` if one is already present, or create the required `Unit(type=POST)`, `Post(kind=CHAPTER)`, and `UnitTranslation` rows and write the resulting Unit id into `node.chapterUnitId`.

#### Scenario: Materialize for a chapter-specific review

- GIVEN a BookContentStructure node at path `[3]` has title "Chapter Four" and no `chapterUnitId`
- WHEN an authenticated user starts a chapter-specific review for that node
- THEN the system SHALL materialize a Chapter Unit for the node
- AND the review SHALL target the returned `chapterUnitId`
- AND the BookContentStructure node at path `[3]` SHALL be updated with that `chapterUnitId`

#### Scenario: Return existing materialized chapter id

- GIVEN a BookContentStructure node at path `[3]` already has `chapterUnitId = "chapter-1"`
- WHEN a caller requests materialization for path `[3]`
- THEN the system SHALL return `chapterUnitId = "chapter-1"`
- AND the system SHALL NOT create a duplicate Unit, Post, or UnitTranslation row

#### Scenario: Empty chapter view does not materialize

- GIVEN a BookContentStructure node at path `[2, 0]` has no `chapterUnitId`
- WHEN a user opens the empty chapter surface for that path
- THEN the system SHALL render the node metadata
- AND the system SHALL NOT create a Chapter Unit until the user performs an action that requires Unit identity

#### Scenario: Book-level progress stores path without materialization

- GIVEN a user is reading a BookContentStructure node at path `[2, 0]` with no `chapterUnitId`
- WHEN the system updates book-level progress for the parent Book Unit
- THEN the system MAY store the serialized path in the book Unit progress row's `lastPosition`
- AND the system SHALL NOT create a Chapter Unit only to store that book-level position

### Requirement: Materialization rejects stale BookContentStructure paths

The materialization operation SHALL detect when the requested path no longer resolves to the expected BookContentStructure node. Callers SHOULD provide expected node metadata such as title and/or the BookContentStructure `updatedAt` value they observed. If the current BookContentStructure no longer matches the expectation, the operation SHALL reject with a conflict response and SHALL NOT create or link a Chapter Unit.

#### Scenario: Path no longer matches expected title

- GIVEN a client observed path `[1]` with title "Chapter Two"
- AND the BookContentStructure was later reordered so path `[1]` now has title "Chapter Five"
- WHEN the client requests materialization for path `[1]` with expected title "Chapter Two"
- THEN the system SHALL reject the request with a conflict response
- AND no Unit, Post, or UnitTranslation row SHALL be created
- AND the BookContentStructure SHALL remain unchanged

#### Scenario: Concurrent materialization is idempotent

- GIVEN two requests concurrently materialize the same BookContentStructure path
- WHEN one request creates and links a Chapter Unit first
- THEN the other request SHALL observe the linked `chapterUnitId` and return it
- AND only one Chapter Unit SHALL be created for that path

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
