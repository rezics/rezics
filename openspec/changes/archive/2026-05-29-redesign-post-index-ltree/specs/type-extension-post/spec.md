## MODIFIED Requirements

### Requirement: CHAPTER is a valid Post kindKey

The `Post.kindKey` field SHALL accept `"chapter"` as a valid value alongside the existing `discussion`, `review`, `remark`, `excerpt`, and `post` values. A Post with `kindKey = "chapter"` represents a chapter of a book. Its `targetUnitId` SHALL reference the parent book unit (a Unit of type `BOOK`). Its `content` SHALL hold the chapter content as a `ContentDoc` whose `main` block is Markdown by default. Its `authorUserId` SHALL be the chapter author. Chapter posts SHALL NOT carry a `body` string column or DTO field.

A chapter Post SHALL use the same threading fields as any other Post (`parentPostUnitId`, `rootPostUnitId`, `depth`, `path`) to accommodate replies, annotations, and discussion threads attached to the chapter.

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

- GIVEN a persisted chapter Post for "book-1"
- WHEN the chapter is loaded
- THEN its `content` SHALL be returned as the stored `ContentDoc`

### Requirement: Replies inherit root target identifiers from their parent

When a reply post is created with a non-null `parentPostUnitId`, the post creation flow SHALL inherit `rootTargetUnitId` and `rootTargetUnitType` from the parent post. The inheritance SHALL be performed as part of the same database read that already fetches the parent for `rootPostUnitId`, `depth`, and `path` derivation, with no additional database roundtrip introduced.

The derivation SHALL NOT branch on `PostKind`. Replies of any `PostKind` (including `REVIEW`, `EXCERPT`, `REMARK`, `POST`, `CHAPTER`) SHALL inherit from their parent identically.

#### Scenario: Direct reply inherits rootTargetUnitId from parent review

- **GIVEN** a REVIEW post `R` with `rootTargetUnitId = "book-B"` and `rootTargetUnitType = "BOOK"`
- **WHEN** a comment `C1` is created with `parentPostUnitId = R.unitId`
- **THEN** `C1.rootTargetUnitId` SHALL equal `"book-B"`
- **AND** `C1.rootTargetUnitType` SHALL equal `"BOOK"`

#### Scenario: Nested reply inherits rootTargetUnitId from its parent reply

- **GIVEN** a comment `C1` with `rootTargetUnitId = "book-B"`
- **WHEN** a reply `C2` is created with `parentPostUnitId = C1.unitId`
- **THEN** `C2.rootTargetUnitId` SHALL equal `"book-B"`
- **AND** `C2.rootTargetUnitType` SHALL equal `"BOOK"`

#### Scenario: Reply derivation does not add a database roundtrip

- **WHEN** a reply is created via `PostService.create` with a non-null `parentPostUnitId`
- **THEN** the parent fetch SHALL include `rootTargetUnitId` and `rootTargetUnitType` in its select set
- **AND** no separate query SHALL be issued to read the root post or the target unit
