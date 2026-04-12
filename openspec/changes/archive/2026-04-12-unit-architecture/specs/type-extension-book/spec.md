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

The Book extension table SHALL store only language-neutral facts. Title, subtitle, summary, and description SHALL be stored in `UnitTranslation`. Language information SHALL be stored in `UnitSupportLanguage`. Author, press, and producer attribution SHALL be stored in `PersonCredit` and `OrgCredit`. Tags SHALL be stored in `UnitTag`. Cover images SHALL be referenced by `coverAssetUnitId` pointing to an IMAGE unit, not stored as a URL string.

#### Scenario: Book schema excludes language-dependent and attribution fields

- GIVEN the Book model in the Prisma schema
- WHEN inspecting its fields
- THEN it SHALL NOT contain fields named `title`, `subtitle`, `description`, `language`, `coverUrl`, `tags`, `author`, `press`, or `producer`
- AND the only fields present SHALL be `unitId`, `isbn13`, `publicationDate`, `pageCount`, `textLength`, `formatKey`, `isLicensed`, `coverAssetUnitId`, `extra`, `createdAt`, and `updatedAt`

#### Scenario: Book display text retrieved from UnitTranslation

- GIVEN a Book with `unitId = "unit-1"` and a `UnitTranslation` record with `unitId = "unit-1"`, `language = "en"`, `title = "The Great Gatsby"`
- WHEN a client requests the book's display information in English
- THEN the system SHALL return the title from `UnitTranslation` and the language-neutral facts from the Book record
- AND no title SHALL be read from or written to the Book table

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

### Requirement: BookIndex for chapter table of contents

The BookIndex model SHALL store a JSON-based chapter table of contents for a Book. It has a 1:1 relationship with Book via `bookUnitId` as its primary key. The `index` field (Json, required) contains the structured chapter listing. Deleting the parent Book SHALL cascade-delete the BookIndex.

#### Scenario: Create a chapter index for a book

- GIVEN a Book with `unitId = "unit-1"`
- WHEN the system creates a BookIndex with `bookUnitId = "unit-1"` and `index = [{"chapter": 1, "title": "Chapter One", "chapterUnitId": "ch-1"}]`
- THEN the BookIndex record SHALL be persisted with the provided JSON index
- AND the BookIndex SHALL be accessible via the Book's `chapterIndex` relation

#### Scenario: Update an existing chapter index

- GIVEN a BookIndex with `bookUnitId = "unit-1"` and an existing index
- WHEN the owner updates the `index` field with a new chapter listing
- THEN the BookIndex SHALL reflect the updated JSON
- AND `updatedAt` SHALL be set to the current timestamp

#### Scenario: Cascade delete BookIndex when Book is deleted

- GIVEN a Book with `unitId = "unit-1"` and an associated BookIndex
- WHEN the Book record is deleted
- THEN the associated BookIndex record SHALL also be deleted via cascade

### Requirement: coverAssetUnitId references an IMAGE unit

The Book model's `coverAssetUnitId` field SHALL reference a Unit with `type = IMAGE`. This field is optional and nullable. The system SHALL validate that the referenced Unit exists and has `type = IMAGE` when the field is set.

#### Scenario: Set a valid cover image reference

- GIVEN a Book with `unitId = "unit-1"` and a Unit with `id = "img-1"` and `type = IMAGE`
- WHEN the owner sets `coverAssetUnitId = "img-1"` on the Book
- THEN the Book record SHALL persist `coverAssetUnitId = "img-1"`

#### Scenario: Reject invalid cover asset reference

- GIVEN a Book with `unitId = "unit-1"` and a Unit with `id = "unit-2"` and `type = BOOK`
- WHEN the owner attempts to set `coverAssetUnitId = "unit-2"` on the Book
- THEN the system SHALL reject the update with a validation error
- AND the Book's `coverAssetUnitId` SHALL remain unchanged

#### Scenario: Cover asset is optional

- WHEN a Book record is created without specifying `coverAssetUnitId`
- THEN the Book SHALL be created with `coverAssetUnitId = null`

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
