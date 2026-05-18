## MODIFIED Requirements

### Requirement: Book extension creation tied to Unit(type=BOOK)

A Book record SHALL exist as a 1:1 extension of a Unit with `type = BOOK`. The Book's `unitId` serves as its primary key and references the parent Unit. Creating a Book without a corresponding Unit(type=BOOK) SHALL be rejected. Deleting the parent Unit SHALL cascade-delete the Book record.

#### Scenario: Create a Book extension for a BOOK unit

- GIVEN a Unit with `id = "unit-1"` and `type = BOOK`
- WHEN the system creates a Book record with `unitId = "unit-1"`
- THEN the Book record SHALL be persisted with `unitId = "unit-1"`, `textLength = 0`, `chapterCount = 0`, `isLicensed = false`, and auto-generated timestamps
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
- AND the only fields present SHALL be `unitId`, `isbn13`, `publicationDate`, `pageCount`, `textLength`, `chapterCount`, `formatKey`, `isLicensed`, `extra`, `createdAt`, and `updatedAt`

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

## ADDED Requirements

### Requirement: Book chapter count cache

The Book model SHALL expose a `chapterCount` integer field. `chapterCount` SHALL represent the number of readable entries in the BookContentStructure tree: every `BookContentStructureNode` row for the book with `noContent = false` counts as one chapter entry.

The count SHALL be occurrence-based, not Unit-based. If two nodes reference the same `chapterUnitId`, both nodes SHALL be counted. Nodes without `chapterUnitId` SHALL be counted when `noContent = false` because chapter Unit materialization is on-demand.

#### Scenario: New book starts with zero chapters

- GIVEN a caller creates a Book
- WHEN the Book record is persisted
- THEN `Book.chapterCount` SHALL be `0`
- AND the returned Book DTO SHALL expose `chapterCount = 0`

#### Scenario: Count readable content-structure nodes

- GIVEN a BookContentStructure for book `"book-1"` has 5 node rows
- AND 3 rows have `noContent = false`
- AND 2 rows have `noContent = true`
- WHEN the system synchronizes the Book chapter count
- THEN `Book.chapterCount` SHALL be `3`

#### Scenario: Count repeated chapter links as separate entries

- GIVEN a BookContentStructure for book `"book-1"` has two node rows with `chapterUnitId = "chapter-1"`
- AND both rows have `noContent = false`
- WHEN the system synchronizes the Book chapter count
- THEN both rows SHALL count
- AND `Book.chapterCount` SHALL include `2` entries for those rows

#### Scenario: Count unmaterialized readable nodes

- GIVEN a BookContentStructureNode for book `"book-1"` has `chapterUnitId = NULL`
- AND the node has `noContent = false`
- WHEN the system synchronizes the Book chapter count
- THEN the node SHALL count toward `Book.chapterCount`

### Requirement: Book chapter count stays synchronized with content-structure writes

Any write path that changes the number of readable BookContentStructure nodes for a book SHALL update `Book.chapterCount` in the same transaction as the content-structure mutation.

Writes that only materialize a node by assigning `chapterUnitId`, rename a node, edit chapter body content, or update per-node `updatedAt` without changing `noContent` or node membership SHALL NOT change `chapterCount`.

#### Scenario: TOC save updates chapter count

- GIVEN a Book has `chapterCount = 2`
- WHEN a TOC editor save persists a tree with 4 nodes where `noContent = false`
- THEN the save transaction SHALL update `Book.chapterCount` to `4`
- AND the returned Book DTO on subsequent reads SHALL expose `chapterCount = 4`

#### Scenario: noContent toggle updates chapter count

- GIVEN a BookContentStructureNode has `noContent = true`
- WHEN a TOC editor save changes the node to `noContent = false`
- THEN the save transaction SHALL increment the Book's readable chapter count by 1

#### Scenario: Materialization does not change chapter count

- GIVEN a BookContentStructureNode has `chapterUnitId = NULL` and `noContent = false`
- AND the node already contributes to `Book.chapterCount`
- WHEN the system materializes the node and assigns `chapterUnitId`
- THEN `Book.chapterCount` SHALL remain unchanged

### Requirement: Frontend TOC naming boundary

Frontend code SHALL use `BookContentStructure` terminology for data, API, query, mutation, and path helper boundaries. Frontend UI/editor components that render or edit the user-visible table of contents SHALL use TOC-oriented names such as `BookTocEditor`, `BookTocTree`, and `BookTocNode` instead of `ChapterTree` when the component represents the whole content structure.

Live code SHALL NOT introduce new `BookIndex`, `chapterIndex`, or `chapterIndexNodes` names for book content-structure behavior.

#### Scenario: Data boundary keeps BookContentStructure naming

- WHEN frontend code imports the content-structure API response or path helper
- THEN the imported type or helper name SHALL use `BookContentStructure` terminology
- AND it SHALL NOT use `BookIndex` or `chapterIndex` terminology

#### Scenario: UI component uses TOC naming

- WHEN frontend code renders the editor for the book table of contents
- THEN the editor component SHALL use a TOC-oriented name
- AND visible copy SHALL be localized user-facing text rather than implementation terms such as `BookContentStructure`

#### Scenario: Legacy chapterIndexNodes relation is not used for new count behavior

- WHEN implementing Book chapter count synchronization
- THEN the implementation SHALL read from `BookContentStructureNode` rows scoped by `bookUnitId`
- AND it SHALL NOT depend on a `chapterIndexNodes` relation
