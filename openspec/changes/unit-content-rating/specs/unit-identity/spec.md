## MODIFIED Requirements

### Requirement: Unit creation requires a valid UnitType

Every Unit record SHALL be created with a `type` from the `UnitType` enum (`BOOK`, `GAME`, `MEDIA`, `POST`, `TAG`, `REALM`, `SHELF`, `IMAGE`, `VIDEO`, `QUOTE`, `LINK`, `ENTITY`, `ZONE`). The `type` field is immutable after creation.

`CHAPTER` is NOT a member of `UnitType`. Chapter content is represented as `Unit(type=POST)` paired with a `Post` row whose `kind = CHAPTER`; see the `post-kind-contract` and `type-extension-post` capabilities.

#### Scenario: Create a unit with a valid type

- GIVEN an authenticated user with userId "user-1"
- WHEN the system creates a new Unit with `type = BOOK`
- THEN the Unit record SHALL be persisted with `type = BOOK`, `status = DRAFT`, `visibility = PRIVATE`, `rating = GENERAL`, `userId = "user-1"`, and auto-generated timestamps
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

### Requirement: NSFW flagging

**Reason**: Replaced by the four-tier `ContentRating` enum, which offers per-tier discovery filtering and per-user opt-in. See the new `content-rating` capability and the added `Content rating field` requirement below.

**Migration**: The `Unit.nsfw: Boolean` column is dropped. No heuristic backfill from `nsfw=true` is performed; all Units default to `rating = GENERAL` after migration and maintainers re-rate as needed. This is a dev-phase breaking change with no backward-compatibility shim.

## ADDED Requirements

### Requirement: Content rating field

A Unit SHALL have a `rating: ContentRating` field defaulting to `GENERAL` on creation. Valid values are `GENERAL`, `R_15`, `R_18`, and `R_18G` (see the `content-rating` capability). The owner MAY update the field at any time. Systems that display or list Units SHALL respect the rating when applying discovery filters.

The system SHALL NOT derive or enforce the Unit's rating from any related entity. In particular, it SHALL NOT enforce that a Book's `rating` is greater than or equal to the `rating` of any chapter Unit that targets the Book. The rating represents the maintainer's declared classification of the Unit at the catalog layer; fine-grained chapter-level rating information is expressed on each chapter Unit independently.

#### Scenario: Set a Unit's rating

- GIVEN a Unit with `rating = GENERAL`
- WHEN the owner updates the rating to `R_15`
- THEN the Unit record SHALL persist `rating = R_15`
- AND discovery filters SHALL evaluate the Unit against the new rating value

#### Scenario: Default rating on creation

- WHEN a new Unit is created without specifying the `rating` field
- THEN the Unit SHALL be created with `rating = GENERAL`

#### Scenario: Chapter rating independent of Book rating

- GIVEN a Book Unit with `rating = R_15` and a chapter Unit with `rating = R_18` targeting it
- WHEN the maintainer updates the Book's rating to `GENERAL`
- THEN the Book's rating SHALL be persisted as `GENERAL`
- AND the chapter's rating SHALL remain `R_18`
- AND the system SHALL NOT emit a validation error for the combination
