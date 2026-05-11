## MODIFIED Requirements

### Requirement: Shelf view-mode enum

The shelf-detail frontend SHALL expose exactly four view modes, identified by
the string literals `"nested"`, `"flat"`, `"masonry"`, and `"unit"`. The type
alias `ShelfView` exported from `@rezics/api/shelf` SHALL be the union of these
four literals and no other values. The default view mode SHALL be `"nested"`
unless a surface explicitly chooses the curation-focused `"unit"` view.

#### Scenario: ShelfView type enumerates the four literals

- **WHEN** a consumer imports `ShelfView` from `@rezics/api/shelf`
- **THEN** the type SHALL equal `"nested" | "flat" | "masonry" | "unit"`
- **AND** the tokens `"grid"`, `"list"`, and `"review"` SHALL NOT appear in
  the type

#### Scenario: Default mode when no preference is persisted

- **WHEN** a shelf-detail view renders for a shelf whose `extra.viewMode` is
  absent or null
- **THEN** the effective view mode SHALL be `"nested"`

### Requirement: Item-stream derivation is a pure function of items, mode, sort, and scope

The ordered stream of rendered entries SHALL be derived by a pure function
whose inputs are: the hydrated shelf items, the active view mode, the active
sort state, and the `sortPrimeOnly` flag. The active sort state SHALL include a
field and an order. The function SHALL NOT read React Query state or component
state directly. The function SHALL be unit-testable in isolation from the React
tree.

#### Scenario: Derivation is deterministic and side-effect free

- **GIVEN** a fixed set of hydrated shelf items and fixed
  `(mode, sort, sortPrimeOnly)` inputs
- **WHEN** the derivation runs twice in any order
- **THEN** both runs SHALL return arrays of equal length whose entries compare
  deeply equal in order
- **AND** the function SHALL NOT call any hook, query, or side-effectful API

#### Scenario: Nested mode derivation emits one entry per shelf item

- **GIVEN** a shelf with `N` items and any number of review attachments
- **WHEN** the derivation runs with `mode = "nested"`
- **THEN** the emitted array SHALL have length exactly `N`

#### Scenario: Flat mode derivation emits one entry per prime plus one per attached review

- **GIVEN** a shelf whose items have a total of `N` primes and `M` attached
  reviews across them
- **WHEN** the derivation runs with `mode = "flat"` or `mode = "masonry"` and
  `sortPrimeOnly = true`
- **THEN** the emitted array SHALL have length exactly `N + M`

#### Scenario: Unit mode derivation emits fixed-height unit entries

- **GIVEN** a shelf whose stream has primes and attached entries
- **WHEN** the derivation runs with `mode = "unit"`
- **THEN** the emitted entries SHALL be renderable by the unit feature summary
  card model
- **AND** the derivation SHALL preserve enough shelf item metadata to render
  added time and reorder controls in the editor

## ADDED Requirements

### Requirement: Unit mode renders fixed-height unit cards

In `"unit"` mode, shelf entries SHALL render as fixed-height unit summary cards
from the unit feature. The view SHALL prioritize scannable metadata and stable
row dimensions over rich full-content presentation.

#### Scenario: Unit mode uses unit card rendering

- **WHEN** a shelf renders with `viewMode = "unit"`
- **THEN** each visible entry SHALL render through the reusable unit card
  component or its shelf-specific adapter
- **AND** rich nested tabs, masonry card layout, and full review card bodies
  SHALL NOT be used as the row's primary renderer

#### Scenario: Unit mode rows keep stable height

- **WHEN** entries have different title lengths, image availability, author
  names, or content preview lengths
- **THEN** the rendered unit rows SHALL keep a stable height
- **AND** overflow content SHALL be clamped or truncated

### Requirement: Shelf sort state supports field and order

Shelf sorting SHALL be represented as a field plus an order. The supported
fields SHALL include `manual`, `addedAt`, and `title`. The supported orders
SHALL be `asc` and `desc`. The `addedAt` field SHALL sort by
`ShelfItem.createdAt`.

#### Scenario: Added-time sort uses shelf item creation time

- **WHEN** the active sort is `{ field: "addedAt", order: "desc" }`
- **THEN** items with later `ShelfItem.createdAt` values SHALL render before
  older shelf items
- **AND** the sort SHALL NOT use the underlying book, post, review, or unit
  creation time as the primary timestamp

#### Scenario: Manual descending renders newer appended positions first

- **WHEN** the active sort is `{ field: "manual", order: "desc" }`
- **THEN** items with lexicographically larger fractional positions SHALL render
  before smaller positions

#### Scenario: Title sort supports both directions

- **WHEN** the active sort field is `title`
- **THEN** `order = "asc"` SHALL render titles in ascending collated order
- **AND** `order = "desc"` SHALL render the reverse title order with the same
  deterministic tie breakers

### Requirement: Unit mode coordinates manual sorting affordances

Manual reorder affordances SHALL be available only in `unit` mode and only when
the active sort field is `manual`. Other view modes MAY still display data in
manual order, but they SHALL NOT expose drag or cross-page reorder controls.

#### Scenario: Unit mode with manual sort can expose reorder controls

- **WHEN** the active view is `unit` and the active sort field is `manual`
- **THEN** the shelf surface MAY render reorder controls appropriate to the
  current context

#### Scenario: Rich views hide reorder controls

- **WHEN** the active view is `nested`, `flat`, or `masonry`
- **THEN** the shelf surface SHALL NOT render drag handles or cross-page move
  controls
- **AND** this SHALL remain true even if the visible sort field is `manual`
