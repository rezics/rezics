## MODIFIED Requirements

### Requirement: Unit creation requires a valid UnitType

Every Unit record SHALL be created with a `type` from the `UnitType` enum (`BOOK`, `GAME`, `MEDIA`, `POST`, `TAG`, `REALM`, `SHELF`, `IMAGE`, `VIDEO`, `QUOTE`, `LINK`, `ENTITY`, `ZONE`). The `type` field is immutable after creation.

`CHAPTER` is NOT a member of `UnitType`. Chapter content is represented as `Unit(type=POST)` paired with a `Post` row whose `kind = CHAPTER`; see the `post-kind-contract` and `type-extension-post` capabilities.

#### Scenario: Create a unit with a valid type

- GIVEN an authenticated user with userId "user-1"
- WHEN the system creates a new Unit with `type = BOOK`
- THEN the Unit record SHALL be persisted with `type = BOOK`, `status = DRAFT`, `visibility = PRIVATE`, `nsfw = false`, `userId = "user-1"`, and auto-generated timestamps
- AND the Unit SHALL have no `title` or `content` columns

#### Scenario: Reject unit creation with invalid type

- WHEN a caller attempts to create a Unit with a type value not in the `UnitType` enum
- THEN the system SHALL reject the request with a validation error
- AND no Unit record SHALL be created

#### Scenario: CHAPTER is not a valid UnitType

- WHEN a caller attempts to create a Unit with `type = CHAPTER`
- THEN the system SHALL reject the request with a validation error
- AND no Unit record SHALL be created

## REMOVED Requirements

### Requirement: CHAPTER UnitType value

**Reason**: `CHAPTER` conflates structural role (part of a book) with content form (authored post) and creates an extension table gap — no `Chapter` extension exists, forcing chapter body to be stored in `UnitTranslation.description`, which is the wrong semantic slot. Chapters share every structural property of posts (author, body, target unit, threading, reactions, scoring) and are more cleanly represented as a `PostKind` value on the existing `Post` extension.

**Migration**: Every existing `Unit` with `type = CHAPTER` SHALL be converted to `Unit(type=POST)` in the same migration step that drops `CHAPTER` from the `UnitType` enum. For each converted unit:
- A `Post` row SHALL be created with the same `unitId`, `kind = CHAPTER`, `authorUserId` set from the unit's `userId`, `targetUnitId` set from the unit's prior `workUnitId`, and `body` set from the unit's `UnitTranslation.description` resolved via the standard fallback chain.
- The unit's `workUnitId` SHALL be set to null to avoid polluting the work/release invariant (which requires `release.type == work.type`).
- Existing `UnitTranslation.title` rows SHALL be preserved as the chapter's title source.
- Existing `UnitTranslation.description` rows MAY be cleared after the body is copied to `Post.body` (retaining them is permitted as migration evidence, but they MUST NOT be treated as chapter body by subsequent reads).

Consumers that previously filtered by `UnitType.CHAPTER` SHALL filter by `Post.kind = CHAPTER` (or the equivalent `Unit.type = POST` combined with the joined `Post` row) instead.
