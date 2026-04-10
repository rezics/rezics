## ADDED Requirements

### Requirement: Unit creation requires a valid UnitType

Every Unit record SHALL be created with a `type` from the `UnitType` enum (`BOOK`, `GAME`, `MEDIA`, `POST`, `TAG`, `REALM`, `SHELF`, `CHAPTER`, `IMAGE`, `VIDEO`, `QUOTE`). The `type` field is immutable after creation.

#### Scenario: Create a unit with a valid type

- GIVEN an authenticated user with userId "user-1"
- WHEN the system creates a new Unit with `type = BOOK`
- THEN the Unit record SHALL be persisted with `type = BOOK`, `status = DRAFT`, `visibility = PRIVATE`, `nsfw = false`, `userId = "user-1"`, and auto-generated timestamps
- AND the Unit SHALL have no `title` or `content` columns

#### Scenario: Reject unit creation with invalid type

- WHEN a caller attempts to create a Unit with a type value not in the `UnitType` enum
- THEN the system SHALL reject the request with a validation error
- AND no Unit record SHALL be created

### Requirement: Unit status follows a defined lifecycle

Unit status SHALL transition according to these rules: a Unit in `DRAFT` MAY transition to `PUBLISHED`. A Unit in `PUBLISHED` MAY transition to `ARCHIVED`. A Unit in `ARCHIVED` MAY transition back to `PUBLISHED`. A Unit in any status MAY transition to `DELETED`. No other transitions are permitted.

#### Scenario: Publish a draft unit

- GIVEN a Unit with `status = DRAFT`
- WHEN the owner sets the status to `PUBLISHED`
- THEN the Unit's `status` SHALL become `PUBLISHED`
- AND `publishedAt` SHALL be set to the current timestamp if it was previously null

#### Scenario: Archive a published unit

- GIVEN a Unit with `status = PUBLISHED`
- WHEN the owner sets the status to `ARCHIVED`
- THEN the Unit's `status` SHALL become `ARCHIVED`

#### Scenario: Re-publish an archived unit

- GIVEN a Unit with `status = ARCHIVED`
- WHEN the owner sets the status to `PUBLISHED`
- THEN the Unit's `status` SHALL become `PUBLISHED`
- AND `publishedAt` SHALL retain its original value

#### Scenario: Delete a unit from any state

- GIVEN a Unit with `status = DRAFT`, `PUBLISHED`, or `ARCHIVED`
- WHEN the owner sets the status to `DELETED`
- THEN the Unit's `status` SHALL become `DELETED`

#### Scenario: Reject invalid status transition

- GIVEN a Unit with `status = DRAFT`
- WHEN a caller attempts to set the status directly to `ARCHIVED`
- THEN the system SHALL reject the transition with a validation error
- AND the Unit's status SHALL remain `DRAFT`

### Requirement: Visibility controls access scope

A Unit's `visibility` field SHALL be one of `PUBLIC`, `UNLISTED`, or `PRIVATE`. `PUBLIC` units are discoverable and accessible to all users. `UNLISTED` units are accessible via direct link but excluded from discovery feeds and search. `PRIVATE` units are accessible only to the owner.

#### Scenario: Set visibility to PUBLIC

- GIVEN a Unit with `visibility = PRIVATE`
- WHEN the owner updates visibility to `PUBLIC`
- THEN the Unit SHALL appear in public feeds and search results

#### Scenario: Set visibility to UNLISTED

- GIVEN a Unit with `visibility = PUBLIC`
- WHEN the owner updates visibility to `UNLISTED`
- THEN the Unit SHALL be accessible via its direct URL
- AND the Unit SHALL NOT appear in public discovery feeds or search results

#### Scenario: Private unit access restricted to owner

- GIVEN a Unit with `visibility = PRIVATE` owned by userId "user-1"
- WHEN a different user "user-2" attempts to access the Unit
- THEN the system SHALL deny access
- AND when the owner "user-1" accesses the Unit, it SHALL be returned normally

### Requirement: NSFW flagging

A Unit SHALL have a boolean `nsfw` field defaulting to `false`. The owner MAY set `nsfw = true` to indicate the unit contains sensitive content. Systems that display units MUST respect the `nsfw` flag for content filtering.

#### Scenario: Flag a unit as NSFW

- GIVEN a Unit with `nsfw = false`
- WHEN the owner sets `nsfw = true`
- THEN the Unit record SHALL persist `nsfw = true`
- AND content filtering systems SHALL treat this unit as sensitive

#### Scenario: Default NSFW value on creation

- WHEN a new Unit is created without specifying the `nsfw` field
- THEN the Unit SHALL be created with `nsfw = false`

### Requirement: Unit deletion is a soft-delete via DELETED status

Deleting a Unit SHALL set `status = DELETED` rather than removing the database row. Units with `status = DELETED` SHALL be excluded from all public queries and feeds. The underlying data is retained for potential recovery.

#### Scenario: Soft-delete a unit

- GIVEN a Unit with `status = PUBLISHED` and `id = "unit-1"`
- WHEN the owner deletes the unit
- THEN the Unit's `status` SHALL become `DELETED`
- AND the Unit row SHALL still exist in the database
- AND the Unit SHALL NOT appear in any public query results

### Requirement: Unit MUST NOT store title or content directly

The Unit model SHALL NOT contain `title`, `subtitle`, `summary`, `description`, or `content` columns. All language-dependent display text MUST be stored in `UnitTranslation` records linked to the Unit.

#### Scenario: Unit schema has no text columns

- GIVEN the Unit model in the Prisma schema
- WHEN inspecting its fields
- THEN it SHALL NOT contain fields named `title`, `subtitle`, `summary`, `description`, or `content`
- AND all display text for the Unit SHALL be retrieved from associated `UnitTranslation` records

### Requirement: userId tracks the creator and owner

Every Unit SHALL have a non-nullable `userId` field referencing the user who created it. This field identifies the owner for authorization checks.

#### Scenario: Creator is recorded on unit creation

- GIVEN an authenticated user with userId "user-1"
- WHEN the user creates a new Unit
- THEN the Unit record SHALL have `userId = "user-1"`

#### Scenario: Authorization uses userId for ownership checks

- GIVEN a Unit with `userId = "user-1"`
- WHEN user "user-2" attempts to update the Unit
- THEN the system SHALL deny the operation unless "user-2" has elevated permissions

### Requirement: Extra JSON field provides extensible metadata

The Unit model SHALL have an `extra` field of type `Json` (nullable or defaulting to empty object) that stores type-specific or domain-specific metadata not covered by the fixed schema columns.

#### Scenario: Store extra metadata on a unit

- GIVEN a Unit of type `BOOK`
- WHEN the owner sets `extra = { "pageCount": 320, "isbn": "978-3-16-148410-0" }`
- THEN the Unit record SHALL persist the JSON value in the `extra` field
- AND subsequent reads SHALL return the stored JSON

#### Scenario: Extra field defaults to null or empty

- WHEN a new Unit is created without specifying the `extra` field
- THEN the `extra` field SHALL default to its schema-defined default (null or `{}`)
