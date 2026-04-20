## ADDED Requirements

### Requirement: Shelf view-mode enum

The shelf-detail frontend SHALL expose exactly three view modes, identified by the string literals `"nested"`, `"flat"`, and `"masonry"`. The type alias `ShelfView` exported from `@rezics/api/shelf` SHALL be the union of these three literals and no other values. The default view mode SHALL be `"nested"`.

#### Scenario: ShelfView type enumerates the three literals

- **WHEN** a consumer imports `ShelfView` from `@rezics/api/shelf`
- **THEN** the type SHALL equal `"nested" | "flat" | "masonry"`
- **AND** the tokens `"grid"`, `"list"`, and `"review"` SHALL NOT appear in the type

#### Scenario: Default mode when no preference is persisted

- **WHEN** a shelf-detail view renders for a shelf whose `extra.viewMode` is absent or null
- **THEN** the effective view mode SHALL be `"nested"`

### Requirement: Nested mode renders reviews as tabs inside the prime card

In `"nested"` mode, each `ShelfItem` SHALL render as a single card whose body shows the prime unit's content, and any `role='review'` attachments for that slot SHALL be presented as tabs inside the same card. The stream emitted in nested mode SHALL contain exactly one card per shelf item — attached reviews SHALL NOT appear as independent siblings.

#### Scenario: Item with two attached reviews renders one card

- **GIVEN** a shelf item for book `B` with two `role='review'` attachments `R1` and `R2`
- **WHEN** the shelf is rendered in `"nested"` mode
- **THEN** one card SHALL be emitted for `B`
- **AND** `R1` and `R2` SHALL be reachable as tabs inside that card
- **AND** no independent card SHALL be emitted for `R1` or `R2`

#### Scenario: Item with no attached reviews

- **GIVEN** a shelf item for book `B` with zero review attachments
- **WHEN** the shelf is rendered in `"nested"` mode
- **THEN** one card SHALL be emitted for `B`
- **AND** the card SHALL render the prime content without a tab strip

### Requirement: Flat mode emits primes and attachments as peer entries

In `"flat"` mode, the emitted item stream SHALL contain the prime entry followed by one peer entry per `role='review'` attachment for that slot. Each entry SHALL render as an independent row-style card. Masonry layout SHALL NOT be used in flat mode.

#### Scenario: Item with two reviews emits three peer entries in prime-adjacent order

- **GIVEN** a shelf item for book `B` with two reviews `R1`, `R2`
- **WHEN** the shelf is rendered in `"flat"` mode and sort-scope is prime-only
- **THEN** the emitted stream SHALL contain, in order: `B`, `R1`, `R2`
- **AND** `R1` and `R2` SHALL be rendered as independent row-style cards, not as tabs

### Requirement: Masonry mode uses the flat emission with masonry layout

In `"masonry"` mode, the emitted item stream SHALL be identical to the stream produced by `"flat"` mode for the same input and the same sort-scope, and only the visual layout SHALL differ: entries SHALL be placed in a masonry/waterfall grid rather than linear rows. The masonry layout implementation MAY be mocked until the real masonry primitive lands; the emission rule and the enum value SHALL be real.

#### Scenario: Flat and masonry produce the same stream order for the same input

- **GIVEN** a shelf with items `B` (two reviews `R1`, `R2`) and `C` (one review `R3`)
- **WHEN** the shelf is rendered first in `"flat"` mode and then in `"masonry"` mode with the same sort state
- **THEN** the sequence of rendered entity ids SHALL be identical between the two renders
- **AND** only the layout container SHALL differ

#### Scenario: Masonry layout is annotated as MOCK until the primitive lands

- **WHEN** the masonry layout is implemented with a placeholder grid
- **THEN** the placeholder SHALL carry a `// MOCK:` comment per the project's mock convention
- **AND** the enum value `"masonry"` SHALL NOT itself be mocked

### Requirement: Sort-scope toggle governs which entries participate in the comparator

The shelf-detail view SHALL expose a boolean option `sortPrimeOnly` with default value `true`. The named value `sortPrimeOnly` SHALL be the canonical identifier — the name SHALL reflect the inclusion criterion (primary-role entries only) rather than being framed as a negation, so future non-primary roles can be added without renaming the flag.

When `sortPrimeOnly = true`, the sort comparator SHALL be applied only to prime (primary-role) entries; attached reviews and any future non-primary roles SHALL keep their prime-adjacent position in the emitted stream regardless of the active sort. When `sortPrimeOnly = false`, every entry in the emitted stream — primes and attachments alike — SHALL participate in the comparator as a peer.

The `manual` sort mode SHALL ignore `sortPrimeOnly` because no comparator runs.

#### Scenario: Title sort with sortPrimeOnly = true keeps reviews next to their prime

- **GIVEN** primes `Apple`, `Banana`, `Cherry` with reviews `Apple→"Zebra"`, `Banana→"Alpha"`
- **WHEN** the user selects title sort with `sortPrimeOnly = true` in flat mode
- **THEN** the emitted stream SHALL be in the order: `Apple`, `"Zebra"`, `Banana`, `"Alpha"`, `Cherry`
- **AND** each review SHALL appear immediately after its prime regardless of its own title

#### Scenario: Title sort with sortPrimeOnly = false interleaves reviews with primes

- **GIVEN** primes `Apple`, `Banana`, `Cherry` with reviews `Apple→"Zebra"`, `Banana→"Alpha"`
- **WHEN** the user selects title sort with `sortPrimeOnly = false` in flat mode
- **THEN** the emitted stream SHALL be sorted by title across all five entries
- **AND** the resulting order SHALL be: `"Alpha"`, `Apple`, `Banana`, `Cherry`, `"Zebra"`

#### Scenario: Manual sort ignores the toggle

- **GIVEN** a shelf with any items and any value of `sortPrimeOnly`
- **WHEN** the user selects `manual` sort
- **THEN** entries SHALL be emitted in persisted `position` order
- **AND** the value of `sortPrimeOnly` SHALL have no effect on the stream

### Requirement: Sort-scope toggle visibility

The UI control for `sortPrimeOnly` SHALL be visible only when the active view mode is `"flat"` or `"masonry"` AND the active sort mode is not `"manual"`. In `"nested"` mode the control SHALL be hidden because attached reviews are rendered as tabs and never participate in the item stream. Under `"manual"` sort the control SHALL be hidden because no comparator runs. When hidden, the stored preference SHALL be preserved and re-applied when the control becomes visible again.

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

The ordered stream of rendered entries SHALL be derived by a pure function whose inputs are: the hydrated shelf items, the active view mode, the active sort mode, and the `sortPrimeOnly` flag. The function SHALL NOT read React Query state or component state directly. The function SHALL be unit-testable in isolation from the React tree.

#### Scenario: Derivation is deterministic and side-effect free

- **GIVEN** a fixed set of hydrated shelf items and fixed `(mode, sort, sortPrimeOnly)` inputs
- **WHEN** the derivation runs twice in any order
- **THEN** both runs SHALL return arrays of equal length whose entries compare deeply equal in order
- **AND** the function SHALL NOT call any hook, query, or side-effectful API

#### Scenario: Nested mode derivation emits one entry per shelf item

- **GIVEN** a shelf with `N` items and any number of review attachments
- **WHEN** the derivation runs with `mode = "nested"`
- **THEN** the emitted array SHALL have length exactly `N`

#### Scenario: Flat mode derivation emits one entry per prime plus one per attached review

- **GIVEN** a shelf whose items have a total of `N` primes and `M` attached reviews across them
- **WHEN** the derivation runs with `mode = "flat"` (or `"masonry"`) and `sortPrimeOnly = true`
- **THEN** the emitted array SHALL have length exactly `N + M`
