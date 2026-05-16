## ADDED Requirements

### Requirement: Seed Tag Units for core content types

The database init seed SHALL create Tag Units for each core content type: `book`, `game`, `media`, `post`, `link`. Each seed tag SHALL be a Unit with `type = "TAG"` and a corresponding UnitTranslation. When the seed applies these tags to seeded shelves (or any other seeded units), the resulting UnitTag rows SHALL be created with `pinned = true` and a low `position` value rather than via an inflated score.

#### Scenario: Seed creates all content-type tags

- **WHEN** the database seed script runs
- **THEN** five Tag Units SHALL be created for: book, game, media, post, link
- **AND** each SHALL have a UnitTranslation with the tag name as title

#### Scenario: Seed is idempotent

- **WHEN** the seed script runs on a database that already has the seed tags
- **THEN** no duplicate Tag Units SHALL be created
- **AND** existing tags SHALL remain unchanged

### Requirement: Deterministic seed tag IDs

Seed Tag Units SHALL have deterministic UUIDs generated via UUIDv5 with a fixed namespace and the tag name as input. This ensures the same IDs across all environments (dev, staging, prod). Likewise, the `position` values assigned to seed-created UnitTag rows SHALL be deterministic, so the seeded ordering is identical across environments.

#### Scenario: Consistent IDs across environments

- **WHEN** the seed runs in development with tag name "book"
- **THEN** the generated UUID SHALL be identical to the UUID generated in production for tag name "book"
- **AND** the frontend constants file SHALL reference these deterministic IDs

#### Scenario: Consistent positions across environments

- **WHEN** the seed creates pinned UnitTag rows for the same content type across two environments
- **THEN** the assigned `position` values SHALL be identical

### Requirement: Seed tag UnitTag rows are pinned with low-position values

For each unit that a seed tag is applied to during installation (e.g. shelves used as content-type filters), the seed installer SHALL create the UnitTag row with `pinned = true` and assign a `position` value low enough to place the row at the top of the pinned section relative to any subsequently pinned rows. The seed installer SHALL select positions in a deterministic order so that re-running the seed produces the same ordering across environments.

#### Scenario: Seed creates pinned UnitTag rows for content-type tags

- **WHEN** the database init seed applies content-type tags to a shelf
- **THEN** each resulting UnitTag row SHALL have `pinned = true`
- **AND** the row's `position` SHALL be a low fractional-indexing key suitable for placing it ahead of typical curator-set positions

#### Scenario: Seed is idempotent for pin status

- **GIVEN** the seed has previously installed pinned UnitTag rows for content-type tags
- **WHEN** the seed runs again
- **THEN** existing pinned rows SHALL retain their `pinned = true` and `position` values
- **AND** no duplicate UnitTag rows SHALL be created

### Requirement: Seed tag UnitTag rows use pin instead of score boost

Seed Tag Units, when applied to seeded units, SHALL receive prominence through `pinned = true` and a low `position` value rather than via a boosted `score`. The `score` of a seed-created UnitTag row SHALL start at the standard creation value (`1` if the seed installer is recorded as a TagVote, otherwise `0`) and SHALL evolve solely through community TagVote activity thereafter.

#### Scenario: Seed tag is pinned and not score-boosted

- **WHEN** a seed UnitTag is created for the content-type tag "book" applied to a seeded shelf
- **THEN** the row SHALL have `pinned = true` and a populated `position`
- **AND** the row's `score` SHALL NOT be set to an artificial boost value
- **AND** the tag SHALL appear at the top of tag listings for that shelf because of its pinned status, not because of an inflated score

#### Scenario: Seed tag survives community downvoting in display order

- **GIVEN** a seed-pinned UnitTag with `score = 1, pinned = true, position = "A"`
- **WHEN** community members downvote the tag and `score` becomes `-3`
- **THEN** the tag SHALL still appear at the top of the unit's tag list because `pinned = true`
- **AND** unpinned tags SHALL continue to be ordered by their own `score` below the pinned section

### Requirement: Seed tags used as shelf content-type filters

The frontend collection modal SHALL use seed tags as primary filter chips for the shelf list. The frontend SHALL identify seed tags by their deterministic UUIDs stored as constants. The filter chip presentation SHALL NOT depend on the `score` value of the corresponding UnitTag rows; presentation order, where applicable, MAY follow the `pinned` + `position` ordering of those rows.

The shelf DTO field consumed by the filter chain (`shelfDTO.tags`) SHALL be projected from `UnitTag` rows where `pinned = true` only. UnitTag rows with `pinned = false` (e.g., rows accumulated through community tag voting or automated tagging) SHALL NOT contribute to this projection and SHALL NOT cause a shelf to surface under a content-type filter. A shelf SHALL appear under a content-type filter if and only if one of its pinned `UnitTag` rows references the corresponding seed-tag id.

#### Scenario: Collection modal shows content-type filter chips

- **WHEN** a user opens the collection modal
- **THEN** filter chips for book, game, media, post, link SHALL be displayed
- **AND** clicking a filter chip SHALL filter the shelf list to shelves whose **pinned** UnitTag rows include the corresponding seed-tag id

#### Scenario: Shelves without content-type tags shown when no filter is active

- **WHEN** no content-type filter chip is selected
- **THEN** all user's shelves SHALL be displayed regardless of their UnitTags

#### Scenario: Unpinned UnitTag rows are excluded from the filter chain

- **GIVEN** a shelf S has one UnitTag row referencing the seed-tag id for `book` with `pinned = false`
- **WHEN** the user opens the collection modal and selects the `book` filter chip
- **THEN** shelf S SHALL NOT be displayed in the filtered result
- **AND** the same shelf SHALL appear in the unfiltered ("All" filter) result

#### Scenario: Pinned UnitTag rows drive the filter chain regardless of score

- **GIVEN** a shelf S has one pinned UnitTag row referencing the seed-tag id for `game` with `score = -5`
- **WHEN** the user selects the `game` filter chip
- **THEN** shelf S SHALL be displayed in the filtered result
- **AND** the filtering decision SHALL NOT consider the row's `score` value

### Requirement: Seed tag translations

Seed Tag Units SHALL have UnitTranslation entries for all supported languages at seed time, with at minimum English translations.

#### Scenario: Seed tag with English translation

- **WHEN** the seed creates a tag "book"
- **THEN** a UnitTranslation SHALL exist with `language = "en"`, `title = "Book"`

### Requirement: Shelf owners pin seed tags via create and edit flows

A shelf owner SHALL be able to pin one or more seed tags (from the fixed set `book`, `game`, `media`, `post`, `link`) on their shelf at create time and at edit time. Pinning a seed tag SHALL cause a `UnitTag` row to be persisted with `unitId = shelfId`, `tagUnitId = <seed-tag-id>`, and `pinned = true`. Pinned-set updates SHALL be expressible as a full-set replacement of the shelf's currently-pinned seed tags. Unpinning a seed tag SHALL remove the corresponding `UnitTag` row.

Only the shelf owner SHALL be permitted to mutate the pinned-tag set on a shelf. Requests by other users SHALL be rejected with an authorization error consistent with existing shelf-edit semantics.

#### Scenario: Pin seed tags at shelf creation

- **GIVEN** an authenticated user is creating a new shelf
- **WHEN** the create request includes `tagIds = [<book-seed-id>, <media-seed-id>]`
- **THEN** the shelf SHALL be created
- **AND** two UnitTag rows SHALL be persisted with `unitId = newShelfId`, the supplied `tagUnitId`s, and `pinned = true`

#### Scenario: Update the pinned set at shelf edit time

- **GIVEN** a shelf S owned by user U with pinned seed tags `{book}`
- **WHEN** U requests to set the pinned-tag set to `{book, game}`
- **THEN** the existing pinned UnitTag row for `book` SHALL remain
- **AND** a new UnitTag row for `game` SHALL be created with `pinned = true`

#### Scenario: Unpin removes the row

- **GIVEN** a shelf S owned by user U with pinned seed tags `{book, media}`
- **WHEN** U requests to set the pinned-tag set to `{book}`
- **THEN** the UnitTag row for `media` on shelf S SHALL be deleted
- **AND** the UnitTag row for `book` SHALL remain unchanged

#### Scenario: Non-owner cannot mutate pinned set

- **GIVEN** a shelf S owned by user U
- **WHEN** another user V requests to update the pinned-tag set on S
- **THEN** the request SHALL be rejected with an authorization error
- **AND** no UnitTag rows on S SHALL be modified

### Requirement: Pinned-tag write path restricted to seed-tag identifiers

The pinned-tag write paths (both create-time `tagIds` and edit-time pinned-set replacement) SHALL accept only the five deterministic seed-tag UUIDs (`book`, `game`, `media`, `post`, `link`). Any request containing a tag identifier outside that set SHALL be rejected with a typed `400 invalid-pin-target` error. The server SHALL NOT silently drop unknown identifiers.

#### Scenario: Non-seed tag id rejected at create

- **WHEN** a shelf create request includes a `tagIds` array containing an identifier that is not one of the five seed-tag UUIDs
- **THEN** the request SHALL be rejected with a `400 invalid-pin-target` error
- **AND** no shelf row or UnitTag row SHALL be created

#### Scenario: Non-seed tag id rejected at edit

- **WHEN** a pinned-set replacement request contains an identifier that is not one of the five seed-tag UUIDs
- **THEN** the request SHALL be rejected with a `400 invalid-pin-target` error
- **AND** the shelf's existing pinned-tag set SHALL remain unchanged

### Requirement: Shelf DTO projects pinned UnitTag rows only

The server-side shelf DTO mapping SHALL project the `tags` field of `shelfDTO` and `shelfSummaryDTO` from `UnitTag` rows with `pinned = true`. Rows with `pinned = false` SHALL be excluded from this projection regardless of their `score` or other metadata.

#### Scenario: Detail DTO excludes unpinned rows

- **GIVEN** a shelf S with three UnitTag rows: one with `pinned = true` for seed-tag `book`, and two with `pinned = false` for non-seed tags
- **WHEN** the server returns the shelf detail DTO for S
- **THEN** `tags` SHALL contain exactly one entry referencing the `book` seed-tag id

#### Scenario: Summary DTO excludes unpinned rows

- **GIVEN** the same shelf S
- **WHEN** the server returns the shelf summary DTO for S
- **THEN** `tags` SHALL contain exactly one entry referencing the `book` seed-tag id
