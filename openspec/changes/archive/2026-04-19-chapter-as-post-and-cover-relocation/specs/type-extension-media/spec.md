## MODIFIED Requirements

### Requirement: Media extension creation tied to Unit(type=MEDIA) with required kindKey

A Media record SHALL exist as a 1:1 extension of a Unit with `type = MEDIA`. The Media's `unitId` serves as its primary key and references the parent Unit. The `kindKey` field (VarChar(32)) is required and MUST be provided at creation time. Creating a Media without a corresponding Unit(type=MEDIA) SHALL be rejected. Creating a Media without a `kindKey` SHALL be rejected. Deleting the parent Unit SHALL cascade-delete the Media record. The system uses a single Media table with `kindKey` as a discriminator rather than separate tables per media kind.

The Media table SHALL NOT hold a cover URL or IMAGE-unit reference column. Media cover URLs SHALL be stored in `UnitTranslation.extra.coverUrl` via the `unitTranslationExtraSchema` defined in the `unit-translation` capability.

#### Scenario: Create a Media extension with kindKey

- GIVEN a Unit with `id = "unit-1"` and `type = MEDIA`
- WHEN the system creates a Media record with `unitId = "unit-1"` and `kindKey = "movie"`
- THEN the Media record SHALL be persisted with `unitId = "unit-1"`, `kindKey = "movie"`, `isLicensed = false`, and auto-generated timestamps
- AND all nullable fields (`releaseDate`, `runtimeMinutes`, `episodeCount`, `seasonCount`, `extra`) SHALL default to null
- AND the Media record SHALL NOT contain a `coverUrl` or `coverAssetUnitId` column

#### Scenario: Reject Media creation without kindKey

- GIVEN a Unit with `id = "unit-1"` and `type = MEDIA`
- WHEN a caller attempts to create a Media record with `unitId = "unit-1"` and no `kindKey`
- THEN the system SHALL reject the request with a validation error
- AND no Media record SHALL be created

#### Scenario: Reject Media creation for non-MEDIA unit

- GIVEN a Unit with `id = "unit-2"` and `type = BOOK`
- WHEN a caller attempts to create a Media record with `unitId = "unit-2"`
- THEN the system SHALL reject the request with a validation error
- AND no Media record SHALL be created

#### Scenario: Cascade delete Media when Unit is deleted

- GIVEN a Unit with `id = "unit-1"` and `type = MEDIA` with an associated Media record
- WHEN the Unit row is hard-deleted from the database
- THEN the associated Media record SHALL also be deleted via cascade

#### Scenario: Media cover URL retrieved from UnitTranslation.extra

- GIVEN a Media with `unitId = "unit-1"` and a `UnitTranslation` with `language = "ja"` and `extra = { coverUrl: "https://example.com/poster.jpg" }`
- WHEN a client requests the media's display information in Japanese
- THEN the returned DTO SHALL expose `coverUrl = "https://example.com/poster.jpg"` resolved from the translation's `extra` field
- AND no `coverUrl` column SHALL be read from the Media table
