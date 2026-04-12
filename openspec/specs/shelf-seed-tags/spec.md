## ADDED Requirements

### Requirement: Seed Tag Units for core content types

The database init seed SHALL create Tag Units for each core content type: `book`, `game`, `media`, `post`, `link`. Each seed tag SHALL be a Unit with `type = "TAG"` and a corresponding UnitTranslation.

#### Scenario: Seed creates all content-type tags

- **WHEN** the database seed script runs
- **THEN** five Tag Units SHALL be created for: book, game, media, post, link
- **AND** each SHALL have a UnitTranslation with the tag name as title

#### Scenario: Seed is idempotent

- **WHEN** the seed script runs on a database that already has the seed tags
- **THEN** no duplicate Tag Units SHALL be created
- **AND** existing tags SHALL remain unchanged

### Requirement: Deterministic seed tag IDs

Seed Tag Units SHALL have deterministic UUIDs generated via UUIDv5 with a fixed namespace and the tag name as input. This ensures the same IDs across all environments (dev, staging, prod).

#### Scenario: Consistent IDs across environments

- **WHEN** the seed runs in development with tag name "book"
- **THEN** the generated UUID SHALL be identical to the UUID generated in production for tag name "book"
- **AND** the frontend constants file SHALL reference these deterministic IDs

### Requirement: Official score boost for seed tags

Seed Tag Units SHALL receive an official score boost via the UnitTag scoring system. The boost SHALL be high enough (e.g., score 1000) to ensure these tags appear prominently and resist community downvoting.

#### Scenario: Seed tag has high official score

- **WHEN** a seed tag "book" is created
- **THEN** it SHALL have an admin-set UnitTag score of at least 1000
- **AND** the tag SHALL appear at the top of tag listings for any unit it is applied to

### Requirement: Seed tags used as shelf content-type filters

The frontend collection modal SHALL use seed tags as primary filter chips for the shelf list. The frontend SHALL identify seed tags by their deterministic UUIDs stored as constants.

#### Scenario: Collection modal shows content-type filter chips

- **WHEN** a user opens the collection modal
- **THEN** filter chips for book, game, media, post, link SHALL be displayed
- **AND** clicking a filter chip SHALL filter the shelf list to shelves tagged with that content-type UnitTag

#### Scenario: Shelves without content-type tags shown when no filter is active

- **WHEN** no content-type filter chip is selected
- **THEN** all user's shelves SHALL be displayed regardless of their UnitTags

### Requirement: Seed tag translations

Seed Tag Units SHALL have UnitTranslation entries for all supported languages at seed time, with at minimum English translations.

#### Scenario: Seed tag with English translation

- **WHEN** the seed creates a tag "book"
- **THEN** a UnitTranslation SHALL exist with `language = "en"`, `title = "Book"`
