## MODIFIED Requirements

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

## ADDED Requirements

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
