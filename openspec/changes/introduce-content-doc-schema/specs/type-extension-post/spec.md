## MODIFIED Requirements

### Requirement: CHAPTER is a valid Post kindKey

The `Post.kindKey` field SHALL accept `"chapter"` as a valid value alongside the existing `discussion`, `review`, `remark`, `excerpt`, and `post` values. A Post with `kindKey = "chapter"` represents a chapter of a book. Its `targetUnitId` SHALL reference the parent book unit (a Unit of type `BOOK`). Its `content` SHALL hold the chapter content as a `ContentDoc` whose `main` block is Markdown by default. Its `authorUserId` SHALL be the chapter author. Chapter posts SHALL NOT carry a `body` string column or DTO field.

A chapter Post SHALL use the same threading fields as any other Post (`parentPostUnitId`, `rootPostUnitId`, `depth`, `sortPath`) to accommodate replies, annotations, and discussion threads attached to the chapter.

#### Scenario: Create a chapter post

- GIVEN a user "user-1" and a book "book-1"
- WHEN the user creates a Post with `kindKey = "chapter"`, `targetUnitId = "book-1"`, `authorUserId = "user-1"`, and `content` containing `main = { type: "markdown", source: "Chapter One..." }`
- THEN the Post SHALL be persisted as a chapter of "book-1"
- AND the underlying Unit SHALL have `type = POST`
- AND `Post.content` SHALL store the `ContentDoc`

#### Scenario: Reject chapter post with non-BOOK targetUnitId

- GIVEN a Unit "u-2" of type `POST`
- WHEN a caller attempts to create a Post with `kindKey = "chapter"` and `targetUnitId = "u-2"`
- THEN the system SHALL reject the creation with a validation error
- AND no Post record SHALL be created

#### Scenario: Chapter post content retrieved from Post.content

- GIVEN a chapter Post whose `content.main.source = "Once upon a time..."`
- WHEN a client requests the chapter's detail DTO
- THEN the DTO SHALL expose `content` as a `ContentDoc`
- AND `content.main.source` SHALL equal "Once upon a time..."
- AND the DTO SHALL NOT expose a `body` field
- AND the content SHALL NOT be read from `UnitTranslation.description`

#### Scenario: Chapter cover URL sourced from UnitTranslation.extra

- GIVEN a chapter Post with a `UnitTranslation` row whose `extra = { coverUrl: "https://example.com/ch-cover.jpg" }`
- WHEN a client requests the chapter's detail DTO
- THEN the DTO SHALL expose `coverUrl = "https://example.com/ch-cover.jpg"` via the `unitTranslationExtraSchema` accessor
- AND no chapter-specific cover column SHALL exist on `Post`
- AND the cover URL SHALL NOT be embedded inside `content.slots`

### Requirement: chapter/ server domain is a thin wrapper over post service

The `package/server/src/chapter/` domain SHALL remain as an API surface for chapter-centric operations but SHALL delegate persistence and retrieval to the post service, filtering on `kindKey = "chapter"` and `targetUnitId = <book>`. The domain SHALL NOT read or write `Unit(type=CHAPTER)` (which no longer exists) or `UnitTranslation.description` as a chapter content source. The domain SHALL NOT read or write a `body` string column.

#### Scenario: Chapter list API returns chapter Posts

- WHEN a client calls the chapter list endpoint for a given book
- THEN the implementation SHALL query posts filtered by `kindKey = "chapter"` and `targetUnitId = <book>`
- AND SHALL NOT query by `Unit.type = "CHAPTER"`

#### Scenario: Chapter create API produces a chapter Post

- WHEN a client calls the chapter create endpoint with `{ targetUnitId, title, content, userId }` where `content` is a `ContentDoc`
- THEN the implementation SHALL create a `Unit(type=POST)` and a `Post` row with `kindKey = "chapter"`, `targetUnitId`, `authorUserId = userId`, and `Post.content` set to the provided `ContentDoc`
- AND SHALL create a `UnitTranslation` row for the chapter's title (under the unit's default language) without storing content inside `description`

### Requirement: Root target identifiers are immutable through Post.update

The `Post.update` API SHALL NOT accept changes to `rootTargetUnitId` or `rootTargetUnitType`. Editing post `content`, `isLocked`, or `extra` SHALL leave both fields unchanged.

The `Post.update` API SHALL NOT accept changes to `targetUnitId`. As a consequence, no human-triggerable code path in the current product can produce write amplification across descendants of a root post.

#### Scenario: Editing post content leaves rootTargetUnitId unchanged

- **GIVEN** a post `P` with `rootTargetUnitId = "book-B"`
- **WHEN** `Post.update(P.unitId, { content: <new ContentDoc> })` is called
- **THEN** `P.rootTargetUnitId` SHALL still equal `"book-B"`
- **AND** `P.rootTargetUnitType` SHALL still equal `"BOOK"`

#### Scenario: Update API rejects rootTargetUnitId in input

- **WHEN** an `UpdatePostInput` payload includes `rootTargetUnitId` or `rootTargetUnitType`
- **THEN** the field SHALL be ignored or rejected by the input contract
- **AND** the persisted post values SHALL remain unchanged

## REMOVED Requirements

### Requirement: Chapter Post body as a string

**Reason**: The `Post.body` string column is removed by this change. Chapter content is now stored as `Post.content` `ContentDoc`.

**Migration**: All chapter create / update / read paths SHALL accept and return `content: ContentDoc`. Existing development data is migrated by wrapping `Post.body` strings into `{ schema: "rezics.content", version: 1, main: { type: "markdown", source: <body> } }`. The chapter mapper SHALL stop emitting `noContent: !post.body` and SHALL derive emptiness from `content` (e.g. `noContent: !content?.main?.source`).
