## MODIFIED Requirements

### Requirement: Media extension creation tied to Unit(type=MEDIA) with required kindKey

A Media record SHALL exist as a 1:1 extension of a Unit with `type = MEDIA`.
The Media's `unitId` serves as its primary key and references the parent Unit.
The `kindKey` field is required and MUST be provided at creation time. Creating
a Media without a corresponding Unit(type=MEDIA) SHALL be rejected. Creating a
Media without a `kindKey` SHALL be rejected. Deleting the parent Unit SHALL
cascade-delete the Media record. The system uses a single Media table with
`kindKey` as a discriminator rather than separate tables per media kind.

The Media table SHALL NOT hold a cover URL, IMAGE-unit reference column,
episode identity, season identity, cast, crew, studio, age-rating string, or
source-specific id column. Display text and cover URLs SHALL be stored in
`UnitTranslation`. Credits SHALL be stored in `CreditAttribution`. Age ratings
and subject classifications SHALL be stored in Entity-backed
`SubjectAttribution`. Source ids SHALL be stored in `UnitExternalRef`.

#### Scenario: Create a Media extension with kindKey

- GIVEN a Unit with `id = "unit-1"` and `type = MEDIA`
- WHEN the system creates a Media record with `unitId = "unit-1"` and `kindKey = "movie"`
- THEN the Media record SHALL be persisted with `unitId = "unit-1"`, `kindKey = "movie"`, `isLicensed = false`, and auto-generated timestamps
- AND nullable summary metadata fields SHALL default to null
- AND the Media record SHALL NOT contain a `coverUrl`, `coverAssetUnitId`, episode identity, cast, studio, or age-rating string column

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

### Requirement: Episode and season tracking for series-type media

Media concrete parts SHALL be represented as Units when they need identity.
Episodes, seasons, volumes, OVAs, specials, and similar concrete parts SHALL be
organized through `contentStructure` / `contentUnitId`. `Media.episodeCount` and
`Media.seasonCount`, if retained during migration, SHALL be treated only as
summary metadata and SHALL NOT be the canonical source of episode or season
identity.

#### Scenario: Anime episodes are content Units

- GIVEN a MEDIA release for an anime series
- WHEN the system models its first episode
- THEN the episode SHALL be represented by a Unit
- AND the release content structure SHALL include a node whose `contentUnitId` points to that episode Unit

#### Scenario: Episode count is not canonical identity

- GIVEN a Media row has `episodeCount = 12`
- WHEN a client needs the list of episodes
- THEN the client SHALL read the release content structure
- AND it SHALL NOT infer episode Unit identities from `episodeCount`

#### Scenario: Season is modeled as Unit when it needs identity

- WHEN a season needs its own title, discussion, metadata, or ordering identity
- THEN it SHALL be represented as a Unit
- AND it SHALL be placed in the parent media release content structure

### Requirement: Runtime for movies and single episodes

The Media model SHALL treat runtime as language-neutral summary metadata.
`runtimeMinutes` MAY exist for movies and simple single-part media. Runtime
SHALL NOT replace content-structure identity for episodes, seasons, or other
parts.

#### Scenario: Set runtime for a movie

- GIVEN a Media with `unitId = "unit-1"`, `kindKey = "movie"`
- WHEN the owner sets `runtimeMinutes = 148`
- THEN the Media record SHALL persist `runtimeMinutes = 148`

#### Scenario: Episode runtime belongs to episode Unit when episode is modeled

- GIVEN an episode is represented as its own Unit
- WHEN the episode has a specific runtime
- THEN runtime metadata SHALL be associated with the episode Unit's media extension or equivalent part metadata
- AND the parent series Media row SHALL NOT be the canonical source for that episode runtime

### Requirement: Work/release support for Media

Media Units SHALL support the work/release model through `UnitWork`. A MEDIA
release Unit is the visible catalog, shelf, review, post, search, and detail
target. A hidden MEDIA work Unit groups one or more releases and provides
inherited discovery metadata and shared work-domain content. Work Units SHALL
not be treated as ordinary public media detail pages and SHALL not require
public titles.

`Unit.workUnitId` MAY exist during migration as a denormalized shortcut, but
new behavior SHALL resolve canonical work membership from
`UnitWork(role = RELEASE)`. `UnitTranslation.sourceUnitId` MAY record provenance
for hidden work translations, but it SHALL NOT select release navigation.

#### Scenario: Create a director's cut as a release

- GIVEN a hidden MEDIA work Unit with a visible theatrical release
- WHEN the system creates a director's cut release
- THEN the director's cut SHALL be a visible MEDIA release Unit
- AND it SHALL be linked to the hidden work through `UnitWork(role = RELEASE)`

#### Scenario: Anime work with regional releases

- GIVEN Japanese and English-dubbed releases belong to the same hidden MEDIA work
- WHEN a user opens the Japanese release
- THEN the page SHALL display the Japanese release as the concrete target
- AND same-work release discovery SHALL happen through release browsing, not through `UnitTranslation.sourceUnitId`

#### Scenario: Work translation source does not select release

- GIVEN a hidden media work translation has `sourceUnitId = "release-en"`
- WHEN a client opens the media release language switcher
- THEN the switcher SHALL consider the current release's own translations
- AND it SHALL NOT navigate to "release-en" solely because of `sourceUnitId`
