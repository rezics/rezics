## ADDED Requirements

### Requirement: Game extension creation tied to Unit(type=GAME)

A Game record SHALL exist as a 1:1 extension of a Unit with `type = GAME`. The Game's `unitId` serves as its primary key and references the parent Unit. Creating a Game without a corresponding Unit(type=GAME) SHALL be rejected. Deleting the parent Unit SHALL cascade-delete the Game record.

#### Scenario: Create a Game extension for a GAME unit

- GIVEN a Unit with `id = "unit-1"` and `type = GAME`
- WHEN the system creates a Game record with `unitId = "unit-1"`
- THEN the Game record SHALL be persisted with `unitId = "unit-1"`, `isLicensed = false`, and auto-generated timestamps
- AND all nullable fields (`releaseDate`, `versionLabel`, `ageRatingKey`, `coverAssetUnitId`, `extra`) SHALL default to null

#### Scenario: Reject Game creation for non-GAME unit

- GIVEN a Unit with `id = "unit-2"` and `type = BOOK`
- WHEN a caller attempts to create a Game record with `unitId = "unit-2"`
- THEN the system SHALL reject the request with a validation error
- AND no Game record SHALL be created

#### Scenario: Cascade delete Game when Unit is deleted

- GIVEN a Unit with `id = "unit-1"` and `type = GAME` with an associated Game record and GamePlatform entries
- WHEN the Unit row is hard-deleted from the database
- THEN the associated Game record and all its GamePlatform entries SHALL also be deleted via cascade

### Requirement: GamePlatform junction for multi-platform support

The GamePlatform model SHALL store platform associations for a Game via a junction table with composite primary key `(gameUnitId, platformKey)`. Each entry records a platform the game is available on, with an integer `sortOrder` (default 0) for display ordering. A Game MAY have zero or more GamePlatform entries. The `platformKey` field (VarChar(64)) uses string keys (e.g., `"pc"`, `"ps5"`, `"switch"`, `"xbox_series"`, `"steam_deck"`, `"ios"`, `"android"`). Deleting the parent Game SHALL cascade-delete all GamePlatform entries.

#### Scenario: Add platforms to a game

- GIVEN a Game with `unitId = "unit-1"`
- WHEN the system creates GamePlatform entries with `(gameUnitId = "unit-1", platformKey = "pc", sortOrder = 0)` and `(gameUnitId = "unit-1", platformKey = "ps5", sortOrder = 1)`
- THEN both GamePlatform records SHALL be persisted
- AND querying platforms for "unit-1" SHALL return both entries ordered by `sortOrder`

#### Scenario: Prevent duplicate platform entries

- GIVEN a Game with `unitId = "unit-1"` and an existing GamePlatform with `platformKey = "pc"`
- WHEN a caller attempts to create another GamePlatform with `gameUnitId = "unit-1"` and `platformKey = "pc"`
- THEN the system SHALL reject the request due to the composite primary key constraint

#### Scenario: Query games by platform

- GIVEN GamePlatform entries for multiple games with `platformKey = "switch"`
- WHEN a client queries for games available on the "switch" platform
- THEN the system SHALL return all Game records linked via GamePlatform entries where `platformKey = "switch"`
- AND the query SHALL be supported by the `(platformKey, gameUnitId)` index

### Requirement: Game stores only language-neutral facts

The Game extension table SHALL contain only language-neutral metadata. Title, subtitle, summary, and description SHALL be stored in `UnitTranslation`. Author, developer, publisher, and other attribution SHALL be stored in `PersonCredit` and `OrgCredit` with appropriate `roleKey` values (e.g., `"developer"`, `"publisher"`, `"designer"`, `"composer"`). Tags SHALL be stored in `UnitTag`. **Cover images SHALL be stored in `UnitTranslation.extra.coverUrl`** via the `unitTranslationExtraSchema` defined in the `unit-translation` capability. The Game table SHALL NOT hold a `coverUrl` column or `coverAssetUnitId` reference.

#### Scenario: Game schema excludes language-dependent and attribution fields

- GIVEN the Game model in the Prisma schema
- WHEN inspecting its fields
- THEN it SHALL NOT contain fields named `title`, `subtitle`, `description`, `language`, `coverUrl`, `coverAssetUnitId`, `tags`, `developer`, or `publisher`
- AND the only fields present SHALL be `unitId`, `releaseDate`, `versionLabel`, `ageRatingKey`, `isLicensed`, `extra`, `createdAt`, and `updatedAt`

#### Scenario: Game display text retrieved from UnitTranslation

- GIVEN a Game with `unitId = "unit-1"` and a `UnitTranslation` record with `unitId = "unit-1"`, `language = "ja"`, `title = "ゼルダの伝説"`
- WHEN a client requests the game's display information in Japanese
- THEN the system SHALL return the title from `UnitTranslation` and the language-neutral facts from the Game record

#### Scenario: Game cover URL retrieved from UnitTranslation.extra

- GIVEN a Game with `unitId = "unit-1"` and a `UnitTranslation` with `language = "ja"` and `extra = { coverUrl: "https://example.com/boxart-jp.jpg" }`
- WHEN a client requests the game's display information in Japanese
- THEN the returned DTO SHALL expose `coverUrl = "https://example.com/boxart-jp.jpg"` resolved from the translation's `extra` field
- AND no `coverUrl` column SHALL be read from the Game table

### Requirement: Work/release support for Game

Game units SHALL support the work/release model via `Unit.workUnitId`, using the same semantics as Book. A Game unit with `workUnitId = null` is a standalone game or a work (canonical entry). A Game unit with `workUnitId` pointing to another GAME unit is a release (e.g., a regional edition, remaster, or platform-specific build). Work-level translations in `UnitTranslation` provide the canonical display metadata, with `sourceReleaseUnitId` pointing to the release that provides content for that language.

#### Scenario: Create a standalone game

- GIVEN a Unit with `id = "unit-1"`, `type = GAME`, and `workUnitId = null`
- WHEN the system creates a Game extension for "unit-1"
- THEN the Game SHALL function as a standalone entry or a work unit
- AND the Game MAY have releases linked to it via other Game units whose `workUnitId = "unit-1"`

#### Scenario: Create a regional release of a game

- GIVEN a work Game unit with `id = "work-1"` and `type = GAME`
- WHEN the system creates a new Unit with `id = "release-1"`, `type = GAME`, `workUnitId = "work-1"` and an associated Game extension
- THEN "release-1" SHALL be a release of "work-1"
- AND querying releases of "work-1" SHALL include "release-1"

#### Scenario: Work-level translation references a release

- GIVEN a work Game unit "work-1" with a release "release-jp" containing Japanese content
- WHEN a `UnitTranslation` is created with `unitId = "work-1"`, `language = "ja"`, `title = "ゼルダの伝説"`, `sourceReleaseUnitId = "release-jp"`
- THEN a client viewing "work-1" in Japanese SHALL see the translated title
- AND the system SHALL know that Japanese content is available via "release-jp"

### Requirement: Game metadata fields

The Game model SHALL include the following metadata fields: `releaseDate` (DateTime, nullable) for the game's release date, `versionLabel` (String, nullable) for version identifiers (e.g., `"1.0"`, `"Definitive Edition"`), `ageRatingKey` (VarChar(32), nullable) for age rating classification keys (e.g., `"esrb_e"`, `"cero_b"`, `"pegi_12"`), `isLicensed` (Boolean, default false) indicating official licensing status, and `extra` (Json, nullable) for extensible metadata. The cover URL is NOT a column on Game; it is stored in `UnitTranslation.extra.coverUrl`.

#### Scenario: Create a game with full metadata

- GIVEN a Unit with `id = "unit-1"` and `type = GAME`
- WHEN the system creates a Game with `unitId = "unit-1"`, `releaseDate = 2024-03-15`, `versionLabel = "1.2.0"`, `ageRatingKey = "esrb_t"`, `isLicensed = true`
- THEN the Game record SHALL persist all provided field values
- AND no cover-related column SHALL exist or be written on the Game table

#### Scenario: Extra JSON stores extensible metadata

- GIVEN a Game with `unitId = "unit-1"`
- WHEN the owner sets `extra = {"engine": "Unreal Engine 5", "multiplayer": true, "maxPlayers": 4}`
- THEN the Game record SHALL persist the JSON value in the `extra` field
- AND subsequent reads SHALL return the stored JSON

#### Scenario: Default values on minimal creation

- WHEN a Game record is created with only `unitId` specified
- THEN `isLicensed` SHALL default to `false`
- AND `releaseDate`, `versionLabel`, `ageRatingKey`, and `extra` SHALL default to null
