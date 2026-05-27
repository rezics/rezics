## ADDED Requirements

### Requirement: GAME and MEDIA use release-first work domains

GAME and MEDIA library content SHALL use the release-first work-domain model.
Visible release Units SHALL be the normal public detail, shelf, review, post,
and interaction targets. Hidden work Units SHALL provide grouping, inherited
metadata, search grouping, and shared work-domain content through `UnitWork`.

Hidden GAME and MEDIA work Units SHALL NOT require public titles for ordinary
display. Public labels SHALL be derived from release context, primary release
selection, aliases, or admin-only maintenance metadata.

#### Scenario: Game release belongs to hidden work

- **WHEN** a GAME release is linked to a hidden GAME work
- **THEN** `UnitWork(unitId = gameRelease, workUnitId = gameWork, role = RELEASE)` SHALL exist
- **AND** public navigation SHALL continue to target the visible release Unit

#### Scenario: Media work label comes from release context

- **WHEN** a MEDIA work-domain surface needs to display the work context
- **THEN** it SHALL derive the public label from a release or release list context
- **AND** it SHALL NOT require a separate public title on the hidden work Unit

### Requirement: GAME and MEDIA metadata ownership is explicit

GAME and MEDIA backends SHALL store each metadata category in the correct shared
system. Display text and covers SHALL live in `UnitTranslation`. Creator,
publisher, studio, cast, and crew SHALL live in `CreditAttribution`. Platforms,
age ratings, characters, worlds, franchises, and other subject classifications
SHALL live in `SubjectAttribution`. Source ids SHALL live in `UnitExternalRef`.
Editable long-form wiki or infobox content SHALL live in `ContentDoc`.

#### Scenario: Game developer is credit attribution

- **WHEN** a game release records a developer
- **THEN** the developer SHALL be represented by a CreditAttribution role
- **AND** the Game table SHALL NOT introduce a `developer` field

#### Scenario: Media cast is credit attribution

- **WHEN** a media release records cast members
- **THEN** each cast member SHALL be represented by CreditAttribution rows
- **AND** the Media table SHALL NOT introduce cast-specific columns

#### Scenario: Platform is subject attribution

- **WHEN** a game release is available on PlayStation 5
- **THEN** the platform SHALL be represented by an Entity-backed subject relation
- **AND** the backend SHALL NOT write a string platform key to the Game row

### Requirement: Platform and age-rating Entities are reusable catalog subjects

The system SHALL represent game/media platforms and age ratings as ENTITY Units.
Public write paths SHALL use registered subject roles such as `available_on` and
`age_rating` and SHALL validate Entity subject eligibility through the existing
SubjectAttribution rules.

#### Scenario: Query games available on platform Entity

- **GIVEN** platform Entity `platform-ps5`
- **WHEN** a client queries GAME releases available on `platform-ps5`
- **THEN** the server SHALL filter by the Entity-backed platform subject relation

#### Scenario: Query media by age rating Entity

- **GIVEN** age-rating Entity `rating-tv-14`
- **WHEN** a client queries MEDIA releases with that rating
- **THEN** the server SHALL filter by the Entity-backed age-rating subject relation

### Requirement: External source identity stays in UnitExternalRef

GAME and MEDIA source identifiers SHALL be stored as `UnitExternalRef` records.
This includes IGDB ids, Steam app ids, TMDB ids, IMDb ids, and PCGamingWiki page
identifiers. GAME and MEDIA extension tables SHALL NOT add source-specific id
columns.

#### Scenario: Store Steam app id

- **WHEN** a GAME release is matched to a Steam app
- **THEN** the Steam app id SHALL be stored as a UnitExternalRef
- **AND** the Game table SHALL NOT add a `steamAppId` column

#### Scenario: Store TMDB movie id

- **WHEN** a MEDIA release is matched to TMDB
- **THEN** the TMDB id SHALL be stored as a UnitExternalRef
- **AND** the Media table SHALL NOT add a `tmdbId` column

### Requirement: GAME and MEDIA frontend detail pages follow book detail structure

Frontend GAME and MEDIA detail pages SHALL follow the current book detail
pattern at the product-structure level: a hero region followed by multiple
tabs. The hero layout SHALL stay broadly consistent with the book hero, while
domain-specific media such as trailer, clip, screenshot, or poster carousels
MAY replace book-specific review preview content.

#### Scenario: Game detail uses hero plus tabs

- **WHEN** a user opens a game detail page
- **THEN** the page SHALL present a hero region with release metadata and actions
- **AND** it SHALL provide tabbed sections for overview, content/DLC, releases, community, and metadata as applicable

#### Scenario: Media hero can show trailer carousel

- **WHEN** a media release has trailer or clip assets
- **THEN** the hero MAY render a carousel in the domain media region
- **AND** the layout SHALL remain aligned with the book detail hero structure
