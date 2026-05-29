# type-extension-game Specification

## Purpose

Defines the GAME Unit extension, language-neutral game release facts, platform
and rating relationships, work/release semantics, the rule that platform ports
default to attributes rather than releases, and dedicated game metadata.
## Requirements
### Requirement: Game extension creation tied to Unit(type=GAME)

A Game record SHALL exist as a 1:1 extension of a Unit with `type = GAME`. The
Game's `unitId` serves as its primary key and references the parent Unit.
Creating a Game without a corresponding Unit(type=GAME) SHALL be rejected.
Deleting the parent Unit SHALL cascade-delete the Game record and all dedicated
game-only child rows such as system requirements.

#### Scenario: Create a Game extension for a GAME unit

- GIVEN a Unit with `id = "unit-1"` and `type = GAME`
- WHEN the system creates a Game record with `unitId = "unit-1"`
- THEN the Game record SHALL be persisted with `unitId = "unit-1"`, `isLicensed = false`, and auto-generated timestamps
- AND all nullable Game extension fields SHALL default to null
- AND platform, age-rating, and system-requirement data SHALL be stored outside the Game row

#### Scenario: Reject Game creation for non-GAME unit

- GIVEN a Unit with `id = "unit-2"` and `type = BOOK`
- WHEN a caller attempts to create a Game record with `unitId = "unit-2"`
- THEN the system SHALL reject the request with a validation error
- AND no Game record SHALL be created

#### Scenario: Cascade delete Game when Unit is deleted

- GIVEN a Unit with `id = "unit-1"` and `type = GAME` with an associated Game record and game system requirement rows
- WHEN the Unit row is hard-deleted from the database
- THEN the associated Game record and dedicated game-only child rows SHALL also be deleted via cascade

### Requirement: Game stores only language-neutral facts

The Game extension table SHALL contain only language-neutral game-release facts.
Title, subtitle, summary, description, and cover SHALL be stored in
`UnitTranslation`. Author, developer, publisher, designer, composer, and other
creator or production credits SHALL be stored in `CreditAttribution`. Platforms
SHALL be stored as Entity-backed `SubjectAttribution` rows. External official
age ratings SHALL be stored as catalog tags through `UnitTag`. System
requirements SHALL be stored in dedicated game system requirement rows.

The Game table SHALL NOT hold `coverUrl`, `coverAssetUnitId`, `ageRatingKey`,
platform keys, developer, publisher, or system requirement text columns.

#### Scenario: Game schema excludes language-dependent and relationship fields

- GIVEN the Game model in the Prisma schema
- WHEN inspecting its fields
- THEN it SHALL NOT contain fields named `title`, `subtitle`, `description`, `language`, `coverUrl`, `coverAssetUnitId`, `tags`, `developer`, `publisher`, `ageRatingKey`, `platformKey`, or `systemRequirementsText`
- AND platforms, ratings, credits, tags, and requirements SHALL be represented by their dedicated shared systems

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

Game Units SHALL support the work/release model through `UnitWork`. A GAME
release Unit is the visible catalog, shelf, review, post, search, and detail
target. A hidden GAME work Unit groups one or more release Units and provides
inherited discovery metadata and shared work-domain content. Work Units SHALL
not be treated as ordinary public game detail pages and SHALL not require
public titles.

GAME work membership SHALL be resolved from `UnitWork(role = RELEASE)`; the
landed `introduce-unit-work-domain` foundation already removed legacy
`Unit.workUnitId` as a membership source. `UnitTranslation.sourceUnitId` MAY
record provenance for hidden work translations, but it SHALL NOT select release
navigation.

#### Scenario: Create a game release in a work domain

- GIVEN a hidden GAME work Unit "work-1"
- WHEN the system creates a visible GAME release Unit "release-1"
- THEN a `UnitWork(unitId = "release-1", workUnitId = "work-1", role = RELEASE)` row SHALL exist
- AND "release-1" SHALL be the public game detail target

#### Scenario: Single-release game still uses release model

- GIVEN a game has only one known release
- WHEN the game is represented in the library backend
- THEN the known public game entry SHALL still be a visible GAME release Unit
- AND it MAY be the only `role = RELEASE` member of its hidden work domain

#### Scenario: Work translation source does not select release

- GIVEN a hidden game work translation has `sourceUnitId = "release-jp"`
- WHEN a client opens the game release language switcher
- THEN the switcher SHALL consider the current release's own translations
- AND it SHALL NOT navigate to "release-jp" solely because of `sourceUnitId`

### Requirement: Game metadata fields

The Game model SHALL include only compact language-neutral release facts that
are not better represented by shared relations. It MAY include `releaseDate`,
`versionLabel`, `isLicensed`, and `extra` for low-frequency transitional
metadata. Age ratings, platforms, credits, tags, external refs, and system
requirements SHALL be stored outside the Game row.

#### Scenario: Create a game with release metadata

- GIVEN a Unit with `id = "unit-1"` and `type = GAME`
- WHEN the system creates a Game with `unitId = "unit-1"`, `releaseDate = 2024-03-15`, `versionLabel = "Definitive Edition"`, and `isLicensed = true`
- THEN the Game record SHALL persist those field values
- AND no platform or age-rating string field SHALL be written on the Game table

#### Scenario: Extra JSON is not used for platform or requirement facts

- GIVEN a Game with `unitId = "unit-1"`
- WHEN the owner records supported platforms or system requirements
- THEN platforms SHALL be written through Entity-backed subject relations
- AND system requirements SHALL be written through dedicated requirement rows
- AND `Game.extra` SHALL NOT be the canonical storage for those facts

#### Scenario: Default values on minimal creation

- WHEN a Game record is created with only `unitId` specified
- THEN `isLicensed` SHALL default to `false`
- AND optional release metadata fields SHALL default to null

### Requirement: Platform ports default to attributes, not releases

A platform port of a GAME SHALL default to a platform attribute on an existing
release through `SubjectAttribution`, not a separate release. A port SHALL be
promoted to a distinct `role = RELEASE` Unit only when it passes the
work-release reviewable-thing test — for example a notoriously divergent port,
or a fundamentally different product such as a touch-based free-to-play mobile
conversion. When a port is promoted to a release for divergence reasons rather
than being the primary version, its `UnitWork.displayPolicy` SHALL default to
`HIDDEN_BY_DEFAULT`.

A difference of edition or generation (such as Enhanced or Definitive) SHALL
create a release under the work/release edition rule independent of platform and
SHALL NOT be governed by this port rule. Per-platform content differences that
do not warrant a release MAY be recorded as platform-attribute notes and SHALL
NOT be stored as Game-table columns.

#### Scenario: Pure port is recorded as a platform attribute

- GIVEN a GAME release exists for an edition on PS5
- WHEN the same edition ships on PC with no separately reviewed or tracked
  divergence
- THEN the PC platform SHALL be recorded as a `SubjectAttribution` on the
  existing release
- AND no new release Unit SHALL be created for the port

#### Scenario: Divergent port graduates to a hidden release

- GIVEN a console port that a distinct population reviews and rates separately
  because its experience is degraded
- WHEN the port is added to the catalog
- THEN it MAY be created as a `role = RELEASE` Unit
- AND its `UnitWork.displayPolicy` SHALL default to `HIDDEN_BY_DEFAULT` unless
  it is the primary version

#### Scenario: Edition difference creates a release regardless of platform

- GIVEN an "Enhanced" edition that differs from the original game
- WHEN it is added to the catalog
- THEN it SHALL be a separate release under the edition rule
- AND the decision SHALL NOT depend on which platforms it targets

