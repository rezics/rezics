## ADDED Requirements

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

### Requirement: Nested mode renders reviews as tabs inside the prime card

In `"nested"` mode, the stream SHALL be derived from `ShelfUnit[]` and `ShelfUnitRelation[]`. Root units are units that do not appear as `childUnitId` in a relation for the same shelf. Each root unit SHALL render as one card. Child units linked by `role='review'` SHALL be presented inside the parent card as tabs or equivalent attached content. A child unit SHALL NOT also render as a root card.

#### Scenario: Item with two attached reviews renders one root card

- **GIVEN** shelf unit `B` has review child units `R1` and `R2`
- **WHEN** the shelf is rendered in `"nested"` mode
- **THEN** one root card SHALL be emitted for `B`
- **AND** `R1` and `R2` SHALL be reachable as attached content inside that card
- **AND** no independent root card SHALL be emitted for `R1` or `R2`

#### Scenario: Child unit is not rendered as a root

- **GIVEN** shelf unit `R1` exists in the shelf and appears as `childUnitId` in at least one relation
- **WHEN** the grouped stream is derived
- **THEN** `R1` SHALL be emitted only under its parent(s)
- **AND** `R1` SHALL NOT appear in the root list

#### Scenario: Multi-parent child renders under each parent

- **GIVEN** shelf unit `T` is the `childUnitId` of relations `(B1, T, 'tag')` and `(B2, T, 'tag')`
- **WHEN** the nested stream is derived
- **THEN** `B1`'s card SHALL emit `T` in its attached content
- **AND** `B2`'s card SHALL emit `T` in its attached content
- **AND** `T` SHALL NOT appear as a root entry
- **AND** every rendered instance of `T` SHALL refer to the same `ShelfUnit(T)` row with the same `position` and the same hydrated DTO

### Requirement: Flat mode emits primes and attachments as peer entries

In `"flat"` mode, the emitted stream SHALL contain `ShelfUnit` entries. When `sortPrimeOnly = false`, every `ShelfUnit` SHALL be emitted once as a peer and sorted by the active sort state. When `sortPrimeOnly = true`, root units SHALL be sorted first and each root's child units SHALL be emitted immediately after that root, with children sorted by the same sort state.

#### Scenario: Flat all-entry mode renders every unit once

- **GIVEN** shelf units `B`, `R1`, and `R2`, where `R1` and `R2` are children of `B`
- **WHEN** flat mode renders with `sortPrimeOnly = false`
- **THEN** the stream SHALL contain `B`, `R1`, and `R2` exactly once each
- **AND** all three entries SHALL participate in the same comparator

#### Scenario: Flat all-entry mode emits multi-parent child only once

- **GIVEN** shelf unit `T` is the `childUnitId` of relations under both `B1` and `B2`
- **WHEN** flat mode renders with `sortPrimeOnly = false`
- **THEN** the stream SHALL contain `T` exactly once
- **AND** the number of incoming relations on `T` SHALL NOT multiply its appearance

#### Scenario: Flat grouped mode keeps children under sorted root

- **GIVEN** shelf unit `B` has child units `R1` and `R2`
- **WHEN** flat mode renders with `sortPrimeOnly = true`
- **THEN** `B` SHALL be emitted as a root entry
- **AND** `R1` and `R2` SHALL be emitted immediately under `B`
- **AND** neither child SHALL appear again as a peer root

### Requirement: Masonry mode uses the flat emission with masonry layout

In `"masonry"` mode, the emitted item stream SHALL be identical to the stream produced by `"flat"` mode for the same `ShelfUnit[]`, `ShelfUnitRelation[]`, sort state, and `sortPrimeOnly` value. Only the visual layout SHALL differ.

#### Scenario: Flat and masonry produce the same stream order for the same input

- **GIVEN** a shelf with roots and attached children
- **WHEN** the shelf is rendered first in `"flat"` mode and then in `"masonry"` mode with the same sort state
- **THEN** the sequence of rendered unit ids SHALL be identical between the two renders
- **AND** only the layout container SHALL differ

#### Scenario: Masonry layout is annotated as MOCK until the primitive lands

- **WHEN** the masonry layout is implemented with a placeholder grid
- **THEN** the placeholder SHALL carry a `// MOCK:` comment per the project's mock convention
- **AND** the enum value `"masonry"` SHALL NOT itself be mocked

### Requirement: Sort-scope toggle governs which entries participate in the comparator

The shelf-detail view SHALL expose a boolean option `sortPrimeOnly` with default value `true`.

When `sortPrimeOnly = true`, sorting SHALL be grouped: the comparator SHALL sort root units first, then sort each root's child units by the same sort state before emitting them under the root. When `sortPrimeOnly = false`, every `ShelfUnit` in the shelf SHALL participate in the comparator as a peer and SHALL render once.

The `manual` sort mode SHALL use `ShelfUnit.position` in both modes.

#### Scenario: Title sort with sortPrimeOnly true sorts roots and children separately

- **GIVEN** roots `Apple` and `Banana`, with child reviews titled `"Zebra"` and `"Alpha"` under `Apple`
- **WHEN** the user selects title sort with `sortPrimeOnly = true` in flat mode
- **THEN** roots SHALL be sorted by root title
- **AND** `"Alpha"` SHALL appear before `"Zebra"` within Apple's child group
- **AND** neither child SHALL interleave with root `Banana`

#### Scenario: Title sort with sortPrimeOnly false interleaves all units

- **GIVEN** roots `Apple`, `Banana`, and child reviews titled `"Zebra"` and `"Alpha"`
- **WHEN** the user selects title sort with `sortPrimeOnly = false` in flat mode
- **THEN** all units SHALL be sorted together by title
- **AND** `"Alpha"` MAY appear before `Apple`

#### Scenario: Manual sort uses ShelfUnit position

- **GIVEN** a shelf with root and child units
- **WHEN** the user selects `manual` sort
- **THEN** every sorted segment SHALL be ordered by `ShelfUnit.position`
- **AND** no relation order SHALL be used

### Requirement: Sort-scope toggle visibility

The UI control for `sortPrimeOnly` SHALL be visible only when the active view mode is `"flat"` or `"masonry"` AND the active sort mode is not `"manual"`. In `"nested"` mode the control SHALL be hidden because attached children are rendered inside their parent and never participate as peers in the item stream. Under `"manual"` sort the control SHALL be hidden because the manual comparator uses `ShelfUnit.position` directly. When hidden, the stored preference SHALL be preserved and re-applied when the control becomes visible again.

#### Scenario: Nested mode hides the sort-scope toggle

- **WHEN** the user is in `"nested"` mode
- **THEN** the `sortPrimeOnly` control SHALL NOT be visible in the toolbar

#### Scenario: Flat mode with title sort shows the toggle

- **WHEN** the user is in `"flat"` mode with `title` sort
- **THEN** the `sortPrimeOnly` control SHALL be visible in the toolbar
- **AND** its default state on first render SHALL be checked (true)

#### Scenario: Switching from title sort to manual hides the toggle without losing the preference

- **GIVEN** the user has toggled `sortPrimeOnly` to `false` in flat + title sort
- **WHEN** the user switches the sort mode to `manual`
- **THEN** the `sortPrimeOnly` control SHALL be hidden
- **AND** on switching back to a non-manual sort the control SHALL reappear with the previously-chosen `false` value

### Requirement: Persistence on shelf.extra.viewMode with legacy-value tolerance

The view-mode preference SHALL be persisted at `shelf.extra.viewMode` using one of the new string literals. On read, the frontend SHALL tolerate legacy values written by earlier versions of the UI by applying the mapping `"review" → "nested"`, `"list" → "flat"`, `"grid" → "masonry"`. No data migration SHALL be required. On the next write that updates `shelf.extra.viewMode`, the legacy value SHALL be overwritten with the new literal.

#### Scenario: Legacy "review" value is read as "nested"

- **GIVEN** a shelf whose `extra.viewMode` is the string `"review"` persisted by a prior UI version
- **WHEN** the shelf-detail page reads the preference
- **THEN** the effective view mode SHALL be `"nested"`

#### Scenario: Legacy "list" value is read as "flat"

- **GIVEN** a shelf whose `extra.viewMode` is the string `"list"` persisted by a prior UI version
- **WHEN** the shelf-detail page reads the preference
- **THEN** the effective view mode SHALL be `"flat"`

#### Scenario: Legacy "grid" value is read as "masonry"

- **GIVEN** a shelf whose `extra.viewMode` is the string `"grid"` persisted by a prior UI version
- **WHEN** the shelf-detail page reads the preference
- **THEN** the effective view mode SHALL be `"masonry"`

#### Scenario: Unknown persisted values fall back to the default

- **GIVEN** a shelf whose `extra.viewMode` is any string outside the new set and the legacy set
- **WHEN** the shelf-detail page reads the preference
- **THEN** the effective view mode SHALL be the default `"nested"`

### Requirement: Item-stream derivation is a pure function of items, mode, sort, and scope

The ordered stream of rendered entries SHALL be derived by a pure function whose inputs are: hydrated shelf units, shelf unit relations, active view mode, active sort state, and the `sortPrimeOnly` flag. The function SHALL NOT read React Query state or component state directly. The function SHALL be unit-testable in isolation from the React tree.

#### Scenario: Derivation is deterministic and side-effect free

- **GIVEN** fixed shelf units, fixed relations, and fixed `(mode, sort, sortPrimeOnly)` inputs
- **WHEN** the derivation runs twice in any order
- **THEN** both runs SHALL return arrays of equal length whose entries compare deeply equal in order
- **AND** the function SHALL NOT call any hook, query, or side-effectful API

#### Scenario: Nested mode derivation emits one root entry per unattached root

- **GIVEN** a shelf with `N` root units and `M` child units
- **WHEN** the derivation runs with `mode = "nested"`
- **THEN** the emitted root array SHALL have length exactly `N`
- **AND** child units SHALL be reachable through parent entry metadata

#### Scenario: Flat all-entry derivation emits every shelf unit once

- **GIVEN** a shelf with `N` total shelf units
- **WHEN** the derivation runs with `mode = "flat"` and `sortPrimeOnly = false`
- **THEN** the emitted array SHALL have length exactly `N`

#### Scenario: Unit mode derivation emits fixed-height unit entries

- **GIVEN** a shelf whose stream has primes and attached entries
- **WHEN** the derivation runs with `mode = "unit"`
- **THEN** the emitted entries SHALL be renderable by the unit feature summary
  card model
- **AND** the derivation SHALL preserve enough shelf unit metadata to render
  added time and reorder controls in the editor

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

Shelf sorting SHALL be represented as a field plus an order. The supported fields SHALL include `manual`, `addedAt`, and `title`. The supported orders SHALL be `asc` and `desc`. The `addedAt` field SHALL sort by `ShelfUnit.createdAt`.

#### Scenario: Added-time sort uses shelf unit creation time

- **WHEN** the active sort is `{ field: "addedAt", order: "desc" }`
- **THEN** units with later `ShelfUnit.createdAt` values SHALL render before older shelf units
- **AND** the sort SHALL NOT use relation creation time as the primary timestamp

#### Scenario: Manual descending renders larger positions first

- **WHEN** the active sort is `{ field: "manual", order: "desc" }`
- **THEN** units with lexicographically larger fractional positions SHALL render before smaller positions

#### Scenario: Title sort supports both directions

- **WHEN** the active sort field is `title`
- **THEN** `order = "asc"` SHALL render titles in ascending collated order
- **AND** `order = "desc"` SHALL render the reverse title order with the same deterministic tie breakers

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
