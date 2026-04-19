## ADDED Requirements

### Requirement: CHAPTER is a valid Post kindKey

The `Post.kindKey` field SHALL accept `"chapter"` as a valid value alongside the existing `discussion`, `review`, `remark`, `quote` / `excerpt`, and `post` values. A Post with `kindKey = "chapter"` represents a chapter of a book. Its `targetUnitId` SHALL reference the parent book unit (a Unit of type `BOOK`). Its `body` SHALL hold the chapter content as a string (markdown by default). Its `authorUserId` SHALL be the chapter author.

A chapter Post SHALL use the same threading fields as any other Post (`parentPostUnitId`, `rootPostUnitId`, `depth`, `sortPath`) to accommodate replies, annotations, and discussion threads attached to the chapter.

#### Scenario: Create a chapter post

- GIVEN a user "user-1" and a book "book-1"
- WHEN the user creates a Post with `kindKey = "chapter"`, `targetUnitId = "book-1"`, `authorUserId = "user-1"`, and `body = "Chapter One..."`
- THEN the Post SHALL be persisted as a chapter of "book-1"
- AND the underlying Unit SHALL have `type = POST`

#### Scenario: Reject chapter post with non-BOOK targetUnitId

- GIVEN a Unit "u-2" of type `POST`
- WHEN a caller attempts to create a Post with `kindKey = "chapter"` and `targetUnitId = "u-2"`
- THEN the system SHALL reject the creation with a validation error
- AND no Post record SHALL be created

#### Scenario: Chapter post body retrieved from Post.body

- GIVEN a chapter Post with `body = "Once upon a time..."`
- WHEN a client requests the chapter's detail DTO
- THEN the DTO's `content` (or equivalent body field) SHALL return `"Once upon a time..."`
- AND the body SHALL NOT be read from `UnitTranslation.description`

#### Scenario: Chapter cover URL sourced from UnitTranslation.extra

- GIVEN a chapter Post with a `UnitTranslation` row whose `extra = { coverUrl: "https://example.com/ch-cover.jpg" }`
- WHEN a client requests the chapter's detail DTO
- THEN the DTO SHALL expose `coverUrl = "https://example.com/ch-cover.jpg"` via the `unitTranslationExtraSchema` accessor
- AND no chapter-specific cover column SHALL exist on `Post`

### Requirement: Chapter ordering and grouping live in BookIndex, not Post

A chapter Post SHALL NOT carry ordering, numbering, or parent-chapter fields on the `Post` model. Chapter order and nesting within a book SHALL remain the responsibility of the `BookIndex` JSON index keyed by `bookUnitId`, which references chapters by their `unitId`. The Post model SHALL remain agnostic of chapter-specific position metadata.

#### Scenario: Post model has no chapter-specific ordering fields

- GIVEN the Post model in the Prisma schema
- WHEN inspecting its fields
- THEN Post SHALL NOT contain `chapterNumber`, `sortOrder`, or `parentChapterUnitId` fields
- AND chapter position SHALL be derivable only by reading the `BookIndex` JSON index for the target book

#### Scenario: Listing chapters of a book

- GIVEN a book `"book-1"` with three chapter Posts whose `targetUnitId = "book-1"` and `kindKey = "chapter"`
- WHEN a client requests the chapter list for `"book-1"`
- THEN the system SHALL return the three chapter Posts
- AND the order SHALL be determined by the `BookIndex` JSON index, not by any field on Post

### Requirement: chapter/ server domain is a thin wrapper over post service

The `package/server/src/chapter/` domain SHALL remain as an API surface for chapter-centric operations but SHALL delegate persistence and retrieval to the post service, filtering on `kindKey = "chapter"` and `targetUnitId = <book>`. The domain SHALL NOT read or write `Unit(type=CHAPTER)` (which no longer exists) or `UnitTranslation.description` as a chapter body source.

#### Scenario: Chapter list API returns chapter Posts

- WHEN a client calls the chapter list endpoint for a given book
- THEN the implementation SHALL query posts filtered by `kindKey = "chapter"` and `targetUnitId = <book>`
- AND SHALL NOT query by `Unit.type = "CHAPTER"`

#### Scenario: Chapter create API produces a chapter Post

- WHEN a client calls the chapter create endpoint with `{ targetUnitId, title, content, userId }`
- THEN the implementation SHALL create a `Unit(type=POST)` and a `Post` row with `kindKey = "chapter"`, `targetUnitId`, `authorUserId = userId`, and `body = content`
- AND SHALL create a `UnitTranslation` row for the chapter's title (under the unit's default language) without storing `content` in `description`
