## ADDED Requirements

### Requirement: Media extension creation tied to Unit(type=MEDIA) with required kindKey

A Media record SHALL exist as a 1:1 extension of a Unit with `type = MEDIA`. The Media's `unitId` serves as its primary key and references the parent Unit. The `kindKey` field (VarChar(32)) is required and MUST be provided at creation time. Creating a Media without a corresponding Unit(type=MEDIA) SHALL be rejected. Creating a Media without a `kindKey` SHALL be rejected. Deleting the parent Unit SHALL cascade-delete the Media record. The system uses a single Media table with `kindKey` as a discriminator rather than separate tables per media kind.

#### Scenario: Create a Media extension with kindKey

- GIVEN a Unit with `id = "unit-1"` and `type = MEDIA`
- WHEN the system creates a Media record with `unitId = "unit-1"` and `kindKey = "movie"`
- THEN the Media record SHALL be persisted with `unitId = "unit-1"`, `kindKey = "movie"`, `isLicensed = false`, and auto-generated timestamps
- AND all nullable fields (`releaseDate`, `runtimeMinutes`, `episodeCount`, `seasonCount`, `coverAssetUnitId`, `extra`) SHALL default to null

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

### Requirement: kindKey values cover established media categories and are extensible

The `kindKey` field SHALL support the following initial values: `movie`, `anime`, `tv_series`, `ova`, `documentary`. The field is stored as VarChar(32), allowing new kind values to be added without schema migration. The `kindKey` value MUST NOT be null and MUST NOT be empty. The `kindKey` is immutable after creation -- changing a media's kind requires creating a new Media unit.

#### Scenario: Create media with each standard kindKey

- GIVEN Units with `type = MEDIA`
- WHEN the system creates Media records with `kindKey` values of `"movie"`, `"anime"`, `"tv_series"`, `"ova"`, and `"documentary"` respectively
- THEN all five Media records SHALL be persisted with their respective `kindKey` values

#### Scenario: Query media filtered by kindKey

- GIVEN multiple Media records with varying `kindKey` values
- WHEN a client queries for Media where `kindKey = "anime"`
- THEN the system SHALL return only Media records with `kindKey = "anime"`
- AND the query SHALL be supported by the `(kindKey, releaseDate)` index

#### Scenario: Accept a new extensible kindKey value

- GIVEN a Unit with `id = "unit-1"` and `type = MEDIA`
- WHEN the system creates a Media record with `kindKey = "music_video"`
- THEN the Media record SHALL be persisted with `kindKey = "music_video"`
- AND no schema migration SHALL be required

### Requirement: Episode and season tracking for series-type media

The Media model SHALL include `episodeCount` (Int, nullable) and `seasonCount` (Int, nullable) fields for tracking series-type media. These fields are relevant for `kindKey` values like `tv_series`, `anime`, and `ova` but are not restricted by `kindKey` -- any media MAY use them. The fields are updated as new episodes or seasons are released.

#### Scenario: Track episode and season counts for an anime series

- GIVEN a Media with `unitId = "unit-1"`, `kindKey = "anime"`
- WHEN the owner sets `episodeCount = 24` and `seasonCount = 2`
- THEN the Media record SHALL persist `episodeCount = 24` and `seasonCount = 2`

#### Scenario: Episode count without season count

- GIVEN a Media with `unitId = "unit-1"`, `kindKey = "ova"`
- WHEN the owner sets `episodeCount = 6` and leaves `seasonCount` as null
- THEN the Media record SHALL persist `episodeCount = 6` and `seasonCount = null`

#### Scenario: Movie with no episode or season tracking

- GIVEN a Media with `unitId = "unit-1"`, `kindKey = "movie"`
- WHEN the Media is created without specifying `episodeCount` or `seasonCount`
- THEN both fields SHALL default to null
- AND the Media record SHALL be valid

### Requirement: Runtime for movies and single episodes

The Media model SHALL include a `runtimeMinutes` (Int, nullable) field for storing the runtime in minutes. This is primarily used for movies and single-episode content but is not restricted by `kindKey` -- any media MAY set a runtime value. For series-type media, `runtimeMinutes` MAY represent the average episode length or the total runtime at the implementor's discretion.

#### Scenario: Set runtime for a movie

- GIVEN a Media with `unitId = "unit-1"`, `kindKey = "movie"`
- WHEN the owner sets `runtimeMinutes = 148`
- THEN the Media record SHALL persist `runtimeMinutes = 148`

#### Scenario: Set runtime for a documentary

- GIVEN a Media with `unitId = "unit-1"`, `kindKey = "documentary"`
- WHEN the owner sets `runtimeMinutes = 90`
- THEN the Media record SHALL persist `runtimeMinutes = 90`

#### Scenario: Series without runtime

- GIVEN a Media with `unitId = "unit-1"`, `kindKey = "tv_series"`
- WHEN the Media is created without specifying `runtimeMinutes`
- THEN `runtimeMinutes` SHALL default to null

### Requirement: Work/release support for Media

Media units SHALL support the work/release model via `Unit.workUnitId`, using the same semantics as Book and Game. A Media unit with `workUnitId = null` is a standalone entry or a work (canonical entry). A Media unit with `workUnitId` pointing to another MEDIA unit is a release (e.g., a regional broadcast version, director's cut, dubbed edition, or Blu-ray release). Work-level translations in `UnitTranslation` provide the canonical display metadata, with `sourceReleaseUnitId` pointing to the release that provides content for that language. Title, subtitle, summary, and description SHALL be stored in `UnitTranslation`. Attribution (director, cast, studio) SHALL be stored in `PersonCredit` and `OrgCredit`.

#### Scenario: Create a standalone movie

- GIVEN a Unit with `id = "unit-1"`, `type = MEDIA`, and `workUnitId = null`
- WHEN the system creates a Media extension with `unitId = "unit-1"` and `kindKey = "movie"`
- THEN the Media SHALL function as a standalone entry or a work unit

#### Scenario: Create a director's cut as a release

- GIVEN a work Media unit with `id = "work-1"`, `type = MEDIA`, and `kindKey = "movie"`
- WHEN the system creates a new Unit with `id = "release-1"`, `type = MEDIA`, `workUnitId = "work-1"` and a Media extension with `kindKey = "movie"` and `runtimeMinutes = 175`
- THEN "release-1" SHALL be a release of "work-1"
- AND querying releases of "work-1" SHALL include "release-1"

#### Scenario: Anime work with regional releases

- GIVEN a work Media unit "work-1" with `kindKey = "anime"`, a release "release-jp" with Japanese content, and a release "release-en" with English dubbed content
- WHEN `UnitTranslation` records are created with `unitId = "work-1"`, `language = "ja"`, `sourceReleaseUnitId = "release-jp"` and `unitId = "work-1"`, `language = "en"`, `sourceReleaseUnitId = "release-en"`
- THEN a client viewing "work-1" in Japanese SHALL be directed to "release-jp" for content
- AND a client viewing "work-1" in English SHALL be directed to "release-en" for content
