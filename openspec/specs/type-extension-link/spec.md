# type-extension-link Specification

## Purpose

Defines the `LINK` UnitType and its `Link` 1:1 extension storing
`url`, optional `siteName` / `faviconUrl`, and `extra`. Routes
LINK titles and descriptions through `UnitTranslation`, makes LINK
units first-class citizens of tagging, shelves, and Meilisearch
discovery, and cascades the `Link` row on Unit deletion.

## Requirements

### Requirement: LINK as a Unit type

The system SHALL support a `LINK` value in the UnitType enum. A LINK unit represents an external URL resource that participates in all Unit-level systems (tagging, collection, discussion, search).

#### Scenario: Create a LINK unit

- **WHEN** a user creates a LINK unit with URL "https://github.com/example/repo"
- **THEN** a Unit with `type = "LINK"` SHALL be created
- **AND** a Link extension record SHALL be created with the URL

#### Scenario: LINK unit participates in UnitTag system

- **WHEN** a LINK unit exists
- **THEN** it SHALL be taggable via the UnitTag system like any other Unit
- **AND** tags SHALL be scored and voted on using the standard TagVote mechanism

### Requirement: Link extension model

A Link extension SHALL be a 1:1 relation on a Unit with `type = LINK`. The Link model SHALL have `unitId` as primary key and foreign key to Unit. The model SHALL store `url` (required), `siteName` (optional), `faviconUrl` (optional), and `extra` (Json, optional).

#### Scenario: Create a link with full metadata

- **WHEN** a LINK unit is created with URL "https://example.com/article", siteName "Example Blog", and faviconUrl "https://example.com/favicon.ico"
- **THEN** a Link record SHALL be created with all provided fields

#### Scenario: Create a link with URL only

- **WHEN** a LINK unit is created with only a URL
- **THEN** a Link record SHALL be created with `siteName` and `faviconUrl` as null

### Requirement: Link title and description via UnitTranslation

A LINK unit's title and description SHALL be stored in `UnitTranslation`, consistent with all other Unit types. The Link extension table SHALL NOT have title or description columns.

#### Scenario: LINK unit with translated title

- **WHEN** a LINK unit is created with title "Example Article" in English
- **THEN** a UnitTranslation record SHALL be created with `language = "en"` and `title = "Example Article"`
- **AND** the Link extension table SHALL contain only `url`, `siteName`, `faviconUrl`, `extra`

### Requirement: LINK units collectible in shelves

LINK units SHALL be collectible as ShelfItems like any other Unit type.

#### Scenario: Add a LINK unit to a shelf

- **WHEN** a user collects a LINK unit to their shelf
- **THEN** a ShelfItem SHALL be created with `itemUnitId` referencing the LINK unit
- **AND** the LINK unit SHALL appear alongside other unit types in the shelf

### Requirement: LINK units in search index

LINK units SHALL be indexed in the Meilisearch content index for discovery.

#### Scenario: Search finds a LINK unit

- **WHEN** a user searches for a term that matches a LINK unit's title or description
- **THEN** the LINK unit SHALL appear in search results alongside other content types
- **AND** the result SHALL include the Link's URL and siteName for display

### Requirement: Link deletion cascades

Deleting a LINK Unit SHALL cascade to the Link extension record via the foreign key relationship.

#### Scenario: Delete a LINK unit

- **WHEN** a LINK Unit is deleted
- **THEN** the Link extension record SHALL be cascade-deleted
- **AND** any ShelfItems referencing this LINK unit SHALL be cascade-deleted
- **AND** any UnitTag entries SHALL be cascade-deleted
