## ADDED Requirements

### Requirement: Unit add composition supports search, URL import, and contextual browse

The unit feature SHALL provide a reusable add/select composition that can be
used by shelf editing and other unit-selection surfaces. The composition SHALL
support content search, URL import, and contextual browsing as separate sources
under a single add-item workflow.

#### Scenario: Search result can be added

- **WHEN** a user enters a search query in the unit add composition
- **THEN** matching units SHALL render as selectable rows or cards
- **AND** activating a result action SHALL call the caller-provided add/select
  handler with that unit candidate

#### Scenario: URL import remains available as one source

- **WHEN** a user pastes a supported app URL into the URL import source
- **THEN** the composition SHALL resolve ordered unit candidates using the
  existing URL candidate parsing behavior
- **AND** activating a candidate action SHALL call the same caller-provided
  add/select handler used by search results

#### Scenario: Composition supports repeated shelf additions

- **WHEN** a shelf editor user adds one unit from search or URL import
- **THEN** the composition SHALL remain mounted and usable for adding another
  unit

### Requirement: Browse appears only after a valid work context exists

The contextual browse panel SHALL not render as a default shelf-editor block
when the only available id is the shelf id. It SHALL render only when the
composition has a valid work-like context from a parsed URL candidate, selected
search result, or explicit caller-provided work context.

#### Scenario: Shelf id alone does not show browse

- **WHEN** the shelf editor renders the add-item composition for a shelf
- **AND** no URL or search result has resolved to a work-like unit
- **THEN** the browse panel SHALL NOT be visible

#### Scenario: Parsed work URL reveals browse

- **WHEN** the user imports a URL that resolves to a book or work-like unit
- **THEN** the composition MAY reveal a browse panel for related sub-units
- **AND** the browse panel SHALL use that resolved work unit as its context

#### Scenario: Search-selected work reveals browse

- **WHEN** the user selects or focuses a search result that represents a
  work-like unit with sub-units
- **THEN** the composition MAY reveal a browse panel for that work's related
  units

### Requirement: Unit search selection reuses unit card summaries

Search, URL candidate, and browse results in the add/select composition SHALL
render through the same unit summary vocabulary used by `UnitCard`, with a
smaller row variant allowed where space is constrained.

#### Scenario: Search and URL rows share action semantics

- **WHEN** search results and URL candidates are displayed in the same add-item
  workflow
- **THEN** each result SHALL expose the caller-provided action in a consistent
  location
- **AND** result title, kind, image, author, and metadata treatment SHALL remain
  visually consistent across sources

#### Scenario: Loading and empty states are source-specific

- **WHEN** search is loading, URL parsing fails, or browse has no sub-units
- **THEN** the composition SHALL render a localized state message for that
  source
- **AND** the other sources SHALL remain usable

### Requirement: Unit add composition follows feature layering

The reusable unit add/select behavior SHALL live in the `unit` feature and be
exported through `package/app/src/unit/index.ts`. Pure parsing, summary mapping,
and selection models SHALL live in `unit/models` and SHALL NOT import React
hooks or state.

#### Scenario: External consumers import through unit index

- **WHEN** shelf or excerpt code uses the unit add/select composition
- **THEN** it SHALL import public components, hooks, and types from the unit
  feature index
- **AND** it SHALL NOT deep-import internal unit component files

#### Scenario: Models are testable without React

- **WHEN** unit selection models are imported in tests
- **THEN** they SHALL be importable without rendering React
- **AND** they SHALL NOT call router, query, or state hooks directly
