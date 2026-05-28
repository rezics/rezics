# unified-attribution Specification

## Purpose

Defines the `Attribution` junction that links a content Unit to an
entity Unit with a free-form `role` string and `sortOrder` integer
under the composite primary key `(unitId, entityId, role)`. Owns
the link/unlink service that drives Meilisearch content sync, the
contract DTOs (`AttributionDTO`, `LinkAttributionInput`, role
constant arrays such as `bookRoles`), and the rule that
`bookQueries.detail()` returns each entity's `translations[]` for
per-language name resolution.

## Requirements

### Requirement: Attribution is a Unit-to-Unit relationship

The `Attribution` model SHALL be a junction table linking a content Unit (`unitId`) to an Entity Unit (`entityId`) with a `role` string and `sortOrder` integer. The composite primary key SHALL be `(unitId, entityId, role)`. Both foreign keys SHALL reference `Unit.id` with cascade delete.

#### Scenario: Create an attribution

- **WHEN** an Attribution is created with `unitId = "book-1"`, `entityId = "entity-1"`, `role = "author"`, `sortOrder = 0`
- **THEN** the record SHALL be persisted with composite PK `(book-1, entity-1, author)`

#### Scenario: Cascade delete from content unit

- **WHEN** a Unit (book) with attributions is deleted
- **THEN** all Attribution rows where `unitId` matches SHALL be cascade-deleted

#### Scenario: Cascade delete from entity unit

- **WHEN** a Unit (entity) with attributions is deleted
- **THEN** all Attribution rows where `entityId` matches SHALL be cascade-deleted

### Requirement: Attribution role is a free string

The `role` field on Attribution SHALL be a free-form string (max 64 characters), NOT a database enum. Valid role values SHALL be defined per content type in `@rezics/contract`. The database SHALL accept any string value.

#### Scenario: Use a standard book role

- **WHEN** an Attribution is created with `role = "translator"`
- **THEN** the record SHALL be persisted with `role = "translator"`

#### Scenario: Use a non-standard role

- **WHEN** an Attribution is created with `role = "color_assistant"`
- **THEN** the record SHALL be persisted without validation error

### Requirement: sortOrder controls display ordering within a role

The `sortOrder` field SHALL determine display position of attributions with the same role for a given unit. Lower values appear first. Default value SHALL be `0`.

#### Scenario: Order multiple authors

- **GIVEN** Unit "book-1" with attributions: (entity-A, "author", sortOrder 2), (entity-B, "author", sortOrder 1)
- **WHEN** retrieving author attributions for "book-1"
- **THEN** they SHALL be returned in order: entity-B, entity-A

### Requirement: Same entity can hold multiple roles on the same unit

An Entity SHALL be able to have multiple Attribution records for the same Unit with different role values. The composite PK `(unitId, entityId, role)` ensures uniqueness per role.

#### Scenario: Entity attributed as both author and illustrator

- **GIVEN** Entity "entity-1" and Unit "book-1"
- **WHEN** attributions are created for `(book-1, entity-1, "author")` and `(book-1, entity-1, "illustrator")`
- **THEN** both records SHALL coexist

#### Scenario: Duplicate role for same entity on same unit is rejected

- **GIVEN** Attribution `(book-1, entity-1, "author")` already exists
- **WHEN** creating another Attribution with `(book-1, entity-1, "author")`
- **THEN** the system SHALL reject with a uniqueness constraint violation

### Requirement: Attribution link and unlink service

The server SHALL provide methods to link and unlink attributions. Linking SHALL create an Attribution row. Unlinking SHALL delete by composite PK. Both operations SHALL trigger Meilisearch content sync for the affected unit.

#### Scenario: Link an attribution

- **WHEN** `linkAttribution({ unitId: "book-1", entityId: "entity-1", role: "author", sortOrder: 0 })` is called
- **THEN** an Attribution row SHALL be created
- **AND** Meilisearch content sync SHALL be triggered for "book-1"

#### Scenario: Unlink an attribution

- **WHEN** `unlinkAttribution("book-1", "entity-1", "author")` is called
- **THEN** the Attribution row SHALL be deleted
- **AND** Meilisearch content sync SHALL be triggered for "book-1"

### Requirement: Retrieve attributions for a unit

The server SHALL provide a method to retrieve all attributions for a given unit, including the Entity's resolved translations. Results SHALL be grouped by role and ordered by sortOrder within each role.

#### Scenario: Get attributions with entity details

- **GIVEN** Unit "book-1" has attributions to entity-A (role: "author") and entity-B (role: "publisher")
- **WHEN** `getAttributionsForUnit("book-1")` is called
- **THEN** the result SHALL include both attributions with their Entity's translations resolved

### Requirement: Attribution contract DTOs

The `@rezics/contract` package SHALL export: `AttributionDTO` (unitId, entityId, role, sortOrder, entity?: EntityDTO), `LinkAttributionInput` (unitId, entityId, role, sortOrder?), and role constant arrays per content type (e.g., `bookRoles`, `gameRoles`).

#### Scenario: AttributionDTO includes entity

- **WHEN** an AttributionDTO is serialized with entity included
- **THEN** it SHALL contain `unitId`, `entityId`, `role`, `sortOrder`, and an `entity` object with translated name and kind

#### Scenario: Role constants are exported

- **WHEN** importing `bookRoles` from `@rezics/contract`
- **THEN** it SHALL be an array including `"author"`, `"translator"`, `"illustrator"`, `"editor"`, `"publisher"`

### Requirement: Book detail attribution response includes translations

The server SHALL provide a method to retrieve all attributions for a given unit, including the Entity's resolved translations. Results SHALL be grouped by role and ordered by sortOrder within each role. The `bookQueries.detail()` response SHALL include attribution entities with their full `translations[]` array so that the frontend can resolve entity names and bios per language without additional API calls.

#### Scenario: Book detail response includes entity translations

- **WHEN** a client fetches book detail via `bookQueries.detail(bookId)`
- **THEN** the response `attributions[]` SHALL include each entity's `translations[]` array
- **AND** the frontend SHALL be able to resolve an entity's name for any available language from this data

#### Scenario: Author name resolved by selected language

- **GIVEN** a book has an attribution with `role = "author"` pointing to entity "entity-1"
- **AND** entity-1 has translations: `[{language: "ja", name: "村上春樹"}, {language: "en", name: "Haruki Murakami"}]`
- **WHEN** the book detail page renders with selected language `"en"`
- **THEN** the author name SHALL display as "Haruki Murakami"

#### Scenario: Author name falls back when selected language unavailable

- **GIVEN** entity-1 has translations only for `"ja"`
- **WHEN** the selected language is `"en"`
- **THEN** the system SHALL fall back through the translation resolution chain and display the Japanese name
