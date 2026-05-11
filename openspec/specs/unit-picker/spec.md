### Requirement: URL input resolves to ordered unit candidates

The `UnitPicker` component SHALL accept a free-form URL string and resolve it
to a list of unit candidates by calling the TanStack Router instance's
`getMatchedRoutes(pathname)` method. The picker SHALL extract every matched
route parameter whose declared name ends in `Id` or `Slug`, derive the unit
kind by stripping that suffix, and emit one candidate per parameter. The
candidate list SHALL be ordered with the deepest (most specific) match first
and the shallowest (least specific) match last.

#### Scenario: URL with two unit identifiers produces both candidates, chapter first

- **WHEN** the user pastes `https://app.example/book/abc/read/xyz` into the picker
- **THEN** the picker SHALL emit two candidates in this order:
  1. `{ kind: "chapter", identifier: "xyz", identifierType: "id" }`
  2. `{ kind: "book", identifier: "abc", identifierType: "id" }`

#### Scenario: URL with only one unit identifier produces one candidate

- **WHEN** the user pastes `/shelf/s-123`
- **THEN** the picker SHALL emit exactly one candidate `{ kind: "shelf", identifier: "s-123", identifierType: "id" }`

#### Scenario: Slug-bearing URL emits a slug-type candidate

- **WHEN** the user pastes `/unit/some-readable-slug`
- **THEN** the picker SHALL emit one candidate `{ kind: "unit", identifier: "some-readable-slug", identifierType: "slug" }`
- **AND** the picker SHALL resolve the slug to the underlying unit before rendering its title

#### Scenario: Unparseable input is treated as a soft error

- **WHEN** the user pastes a string that fails router matching or `getMatchedRoutes` returns a `parseError`
- **THEN** the picker SHALL NOT throw
- **AND** the picker SHALL display a non-blocking message indicating the input was not recognized as a unit link

### Requirement: Picker exposes a render-prop action slot per candidate

The `UnitPicker` component SHALL accept a `renderItemAction: (candidate) => ReactNode`
prop that the caller uses to render the action control on each candidate row.
The picker SHALL NOT render its own action button. Excerpt callers pass a
"Use this" control that replaces a single value; shelf callers pass an "Add"
control that enqueues an op without dismissing the picker.

#### Scenario: Excerpt shell uses single-select replace action

- **WHEN** an excerpt edit page renders `<UnitPicker renderItemAction={...} />`
- **AND** the user activates the action on a candidate
- **THEN** the parent state SHALL update its `ExcerptSource` to point at that candidate's unit
- **AND** the picker SHALL remain visible so the user can change their choice

#### Scenario: Shelf shell uses multi-add action without closing the picker

- **WHEN** a shelf editor renders `<UnitPicker renderItemAction={...} />`
- **AND** the user activates the action on each candidate in turn
- **THEN** each activation SHALL enqueue an `add` op in the shelf editor's op log
- **AND** the picker input and candidate list SHALL remain visible between activations

### Requirement: Picker provides a sub-unit browse panel

When the picker receives a `workContextUnitId` prop, it SHALL render a
collapsible disclosure that lists the sub-units of that work unit. The
disclosure SHALL fetch sub-units lazily when expanded and SHALL surface each
sub-unit with the same action slot used by URL-derived candidates.

#### Scenario: Browse panel hidden when no work context is given

- **WHEN** the picker is rendered without `workContextUnitId`
- **THEN** the browse panel SHALL NOT appear

#### Scenario: Browse panel lists sub-units of the work

- **WHEN** the picker is rendered with `workContextUnitId="book-abc"`
- **AND** the user expands the browse panel
- **THEN** the picker SHALL fetch the sub-units of `book-abc`
- **AND** display each as a row sharing the candidate row layout and action slot

### Requirement: Picker lives in the `unit` feature with a layered structure

The `UnitPicker` SHALL be exported from a new feature directory
`package/app/src/unit/` whose internal layout follows the project feature
standard. Models SHALL NOT import from hooks or states. The feature's
`index.ts` SHALL be the only entry point for external consumers.

#### Scenario: External imports go through the feature index

- **WHEN** a consumer outside the `unit` feature imports `UnitPicker`, `useUnitCandidates`, or the `Candidate` type
- **THEN** the import path SHALL be `@/unit` (the feature `index.ts`)
- **AND** deep imports into `@/unit/components/UnitPicker/...` SHALL NOT be used

#### Scenario: Models layer has no React dependencies

- **WHEN** `models/parseUrlToUnitCandidates.ts` is imported in a test
- **THEN** it SHALL be importable without rendering React, without `useRouter`, and accept the `getMatchedRoutes` function as a parameter
