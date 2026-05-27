## ADDED Requirements

### Requirement: Series is public knowledge

The system SHALL model Series as catalog-maintained public knowledge, not as a
Shelf kind or user collection. A Series SHALL be represented by a Unit with a
Series extension row and SHALL use normal public-knowledge infrastructure for
translations, aliases, external references, permissions, and history.

#### Scenario: Series is not created as a Shelf

- **WHEN** an editor creates a canonical book, game, film, media, franchise, or universe Series
- **THEN** the system SHALL create a Series Unit and Series extension row
- **AND** the system SHALL NOT create `Shelf(kindKey = "series")` as the canonical model

### Requirement: Series kind taxonomy is contract-defined

The contract package SHALL define Series kind values for `book_series`,
`game_series`, `film_series`, `media_series`, `franchise`, and `universe` with
comments that distinguish public-knowledge grouping semantics. The kind SHALL
identify the Series Unit's primary semantics and SHALL NOT be treated as an
exclusive taxonomy across all Series membership.

#### Scenario: Release work domain belongs to multiple Series kinds

- **WHEN** a release belongs to a work domain represented in a film series, a universe, and a franchise
- **THEN** the system SHALL allow separate Series Units with different `kindKey` values to directly contain representative releases from that work domain
- **AND** each Series Unit SHALL retain its own primary `kindKey`

### Requirement: Franchise and universe are distinct Series kinds

A `franchise` Series SHALL represent brand, IP, publishing-lineage, or
commercial grouping. A `universe` Series SHALL represent shared fictional
continuity, setting, or world grouping.

#### Scenario: Franchise and universe coexist

- **WHEN** Marvel franchise and Marvel Cinematic Universe are represented in the catalog
- **THEN** Marvel franchise SHALL use `kindKey = "franchise"`
- **AND** Marvel Cinematic Universe SHALL use `kindKey = "universe"`
- **AND** representative releases from the same work domain MAY be directly present in both Series Units

### Requirement: Internal content partitions are not Series kinds

The system SHALL NOT model seasons, season groups, episode groups, volume
groups, disc groups, track groups, arcs, or source-specific ordering groups as
`Series.kindKey` values. Those concepts SHALL belong to content-structure node
metadata or future content-structure variants.

#### Scenario: Season group remains content structure

- **WHEN** a media release has seasons, specials, or source-specific season grouping
- **THEN** the system SHALL model those groups in content structure metadata
- **AND** the system SHALL NOT create a Series Unit with a season-group kind for that internal partition

### Requirement: Series is release-first

A Series SHALL use visible release Units as counted member entries. Hidden Work
Units SHALL NOT be direct Series member entries.

#### Scenario: Editor adds work-level intent to Series

- **WHEN** an editor chooses to add a work to a Series from a release-aware editing flow
- **THEN** the system SHALL select or require selection of a representative release for that work
- **AND** the Series content structure SHALL store the selected release Unit rather than the hidden Work Unit
