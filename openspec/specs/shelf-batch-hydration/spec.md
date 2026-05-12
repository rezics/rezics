## ADDED Requirements

### Requirement: Frontend groups shelf items by kind-to-endpoint for batch hydration

The frontend SHALL group returned `ShelfUnit[]` by the list endpoint associated with each unit's `kind` and issue one batch list API call per distinct endpoint to hydrate unit data. The grouping SHALL use existing list endpoints with an `{ ids: [...] }` payload. Kinds that map to the same endpoint SHALL be merged into a single call.

#### Scenario: Shelf with mixed kinds that share endpoints

- **WHEN** a shelf page contains units with kinds `[book, book, review, tag, book, post]`
- **THEN** the frontend SHALL issue exactly 3 parallel API calls:
  - `POST /book/list` with the three book ids
  - `POST /post/list` with the review and post ids combined
  - `POST /tag/list` with the tag id

#### Scenario: Kind without a list endpoint renders a generic card

- **WHEN** a shelf page contains units of a kind for which no list endpoint exists
- **THEN** the frontend SHALL render those units using a generic fallback card based on `kind` and `unitId`
- **AND** SHALL NOT issue a list call for that kind

### Requirement: Attachments hydrate through the same pipeline

Attachment children are represented as `ShelfUnit` rows and relation rows. The frontend SHALL hydrate child units through the same kind-grouped batch-list pipeline used for root units, rather than through projected `reviewIds` or `tagIds` arrays.

#### Scenario: Reviews and tags join the same batch

- **WHEN** a shelf page has book root units with review and tag child units
- **THEN** the review child unit ids SHALL be folded into the `/post/list` batch
- **AND** the tag child unit ids SHALL be folded into the `/tag/list` batch
- **AND** no dedicated attachment-fetch path SHALL be used

### Requirement: Cache seeding from batch hydration

After each batch list call, the frontend SHALL seed individual item entries into the TanStack Query cache using `queryClient.setQueryData` against the corresponding detail query key. This enables cache reuse across shelf views, detail pages, search results, and other features.

#### Scenario: Book list response seeds detail cache

- **WHEN** the book list endpoint returns two books with ids `B1` and `B2`
- **THEN** the frontend SHALL call `queryClient.setQueryData(bookKeys.detail(B1), book1Data)`
- **AND** `queryClient.setQueryData(bookKeys.detail(B2), book2Data)`

#### Scenario: Previously cached unit renders from cache

- **WHEN** a shelf contains unit `B1` that is already present in the TanStack Query detail cache
- **THEN** the UI SHALL render `B1` immediately from the cached data
- **AND** the batch list call MAY still include `B1` for freshness

### Requirement: Frontend-driven sort modes

The frontend SHALL provide three sort modes for shelf units: `manual` (default — `position` order as returned by the API), `addedAt` (`ShelfUnit.createdAt`), and `title` (hydrated unit title via `Intl.Collator(userLocale)`). The backend SHALL NOT accept a display-sort parameter for shelf detail rendering.

#### Scenario: Manual sort uses API order

- **WHEN** the user selects manual sort
- **THEN** units SHALL render in the `position` order returned by the API

#### Scenario: Time sort orders by ShelfUnit createdAt

- **WHEN** the user selects added-time sort
- **THEN** the frontend SHALL sort loaded units by `ShelfUnit.createdAt`

### Requirement: Orphan detection and author-triggered cleanup

The frontend SHALL detect orphaned shelf units whose `unitId` fails hydration and hide them from the rendered list. On the author's next save action of any kind, the frontend SHALL include the list of orphaned `unitId` values in the request, and the backend SHALL delete those `ShelfUnit` rows; cascading FKs SHALL delete related `ShelfUnitRelation` rows.

#### Scenario: Hydration failure hides orphaned unit

- **WHEN** a shelf unit with `unitId = X` fails to hydrate
- **THEN** the frontend SHALL hide that unit from the rendered list
- **AND** SHALL NOT show an error message

#### Scenario: Author save triggers orphan cleanup

- **WHEN** the shelf author saves any change while two orphaned unit ids are tracked
- **THEN** the save request SHALL include both orphaned unit ids
- **AND** the backend SHALL delete the corresponding `ShelfUnit` rows in the same transaction as the save
- **AND** cascading FKs SHALL delete relation rows involving those units

### Requirement: Kind dispatches to domain card with full hydrated DTO

The shelf renderer SHALL switch on `ShelfUnit.kind` and delegate rendering to the existing domain card for that kind, feeding it the full DTO read from the TanStack Query detail cache. The renderer SHALL NOT accept a pre-computed `title` string as a prop.

#### Scenario: Review kind renders full review card

- **WHEN** a shelf contains a unit with `kind = "review"` and the post batch has seeded `postKeys.detail(unitId)` with the review's `PostDTO`
- **THEN** the renderer SHALL output a `ReviewCard` with the full `PostDTO`

#### Scenario: Unsupported kind renders minimal shell without network activity

- **WHEN** a shelf contains a unit with `kind` not in the dispatch table
- **THEN** the renderer SHALL output a generic shell showing the kind plus a shortened `unitId`
- **AND** SHALL NOT issue any list-endpoint request for that unit

### Requirement: Attached reviews render under the primary item

For each root `ShelfUnit`, the renderer SHALL render child units linked by `ShelfUnitRelation(role='review')` under that root in grouped views. Each child review SHALL source its `PostDTO` from the cache seeded by the shared post batch.

#### Scenario: Book unit with two attached reviews in nested mode

- **WHEN** book unit `B` has review child units `R1` and `R2`
- **AND** the shelf is rendered in nested mode
- **THEN** the renderer SHALL output root content for `B`
- **AND** render `R1` and `R2` as attached review content under `B`
- **AND** not render `R1` or `R2` again as roots

### Requirement: Title derivation is a pure sort-only helper

Title derivation for the `title` sort mode SHALL live in a pure helper function separate from the rendering path. The helper SHALL accept a shelf unit and the cached DTO for that unit and SHALL return a string usable by `Intl.Collator`.

#### Scenario: Helper falls back to unitId when no cached DTO

- **WHEN** the helper is called with a unit whose cache entry is empty or whose kind has no detail cache
- **THEN** the helper SHALL return `unit.unitId` as the sort key
- **AND** sorting SHALL remain stable as hydration fills in real titles on subsequent renders
