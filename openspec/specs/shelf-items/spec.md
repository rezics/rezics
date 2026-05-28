# shelf-items Specification

## Purpose

Owns the data layer for shelf items: the `ShelfUnit` containment
model with its composite primary key, fractional-index `position`
column, and density-rebalancing window; the `ShelfUnit.kind` render
discriminator computed at write time; the `ShelfUnitRelation`
attachment-only junction with multi-parent support and cascade
semantics; and the frontend hydration pipeline that groups returned
`ShelfUnit[]` by kind-to-endpoint, batches list calls, seeds the
TanStack Query detail cache, and cleans up orphaned references on
the author's next save. Previously split across `shelf-structure`,
`shelf-item-kind`, `shelf-item-unit-junction`, and
`shelf-batch-hydration`.

## Structure

### Requirement: ShelfUnit is a sortable shelf-contained unit

`ShelfUnit` SHALL represent every unit contained by a shelf, including units that are displayed as attached children. `ShelfUnit` SHALL be the single source of truth for shelf containment and manual ordering.

The `ShelfUnit` model SHALL contain exactly these fields:

- `shelfId: String @db.Uuid` — owning shelf (references `Shelf.unitId`)
- `unitId: String @db.Uuid` — contained unit id and render identity
- `kind: String @db.VarChar(32)` — render discriminator
- `position: String @db.VarChar(64)` — fractional index
- `createdAt: DateTime`, `updatedAt: DateTime`

The composite primary key SHALL be `@@id([shelfId, unitId])`. The model SHALL declare an index `@@index([shelfId, position])`.

The owning-shelf column SHALL be named `shelfId`, not `shelfUnitId`, to avoid lexical collision with the model name `ShelfUnit`.

#### Scenario: Schema declares ShelfUnit with composite PK

- **WHEN** reviewing the Prisma schema
- **THEN** a `ShelfUnit` model SHALL exist with the fields listed above
- **AND** the composite PK SHALL be `@@id([shelfId, unitId])`
- **AND** the model SHALL declare `@@index([shelfId, position])`

#### Scenario: Attached review has its own ShelfUnit

- **WHEN** review `R` is attached under book `B` in shelf `S`
- **THEN** shelf `S` SHALL contain a `ShelfUnit` row for `R`
- **AND** that row SHALL have its own `position`

### Requirement: ShelfUnit fractional-index position

Each `ShelfUnit` SHALL have a `position` field of type `String` (max 64 characters) that encodes a fractional index. The system SHALL order units within a shelf by comparing `position` strings lexicographically. Manual sorting SHALL use only `ShelfUnit.position`.

#### Scenario: Append unit to shelf

- **WHEN** a new unit is added to a shelf with existing units
- **THEN** the system SHALL generate a new `position` string lexicographically greater than the current maximum position in that shelf
- **AND** the insert SHALL create one `ShelfUnit` row without modifying other `ShelfUnit` rows

#### Scenario: Drag-drop reorder

- **WHEN** the author reorders an existing unit to a new location between two other units
- **THEN** the system SHALL UPDATE only the moved unit's `position` to a value between the new neighbors' positions
- **AND** no relation row SHALL be consulted for manual ordering

### Requirement: Position-key density rebalancing

When a newly-generated `position` would exceed a configured length threshold (default 16 characters), the system SHALL perform an n-reorder: read a window of surrounding units, redistribute their positions evenly across the lex range, and UPDATE them in a single transaction.

#### Scenario: Rebalance triggered by key growth

- **WHEN** the system attempts to generate a new position and the candidate key length would exceed the threshold
- **THEN** the system SHALL select a window of surrounding units (default 50)
- **AND** SHALL reassign evenly-spaced positions across that window
- **AND** SHALL apply the updates in a single transaction

#### Scenario: Normal insert below threshold

- **WHEN** the candidate position key length is below the threshold
- **THEN** no rebalance SHALL be performed
- **AND** the insert SHALL complete as a single-row INSERT

### Requirement: ShelfUnit unitId without foreign key

`ShelfUnit` SHALL use `unitId: String @db.Uuid` as the contained unit id. The column SHALL NOT declare a foreign key relation to `Unit` so that deleted units can be detected as orphans and cleaned by the shelf domain.

#### Scenario: External Unit deletion leaves an orphan ShelfUnit

- **WHEN** the Unit referenced by a `ShelfUnit.unitId` is deleted externally
- **THEN** the `ShelfUnit` row SHALL remain until shelf orphan cleanup runs
- **AND** the frontend SHALL hide the orphan after hydration fails

### Requirement: ShelfUnit composite primary key prevents duplicates

A given unit SHALL appear at most once per shelf as a `ShelfUnit`.

#### Scenario: Duplicate unit rejected

- **GIVEN** a shelf already contains `ShelfUnit(shelfId = S, unitId = U)`
- **WHEN** the system attempts to insert another `ShelfUnit` with the same `(S, U)`
- **THEN** the PK constraint SHALL reject the insert
- **AND** no second row SHALL be created

### Requirement: Shelf.itemCount tracks ShelfUnit count at write time

`Shelf.itemCount` SHALL equal the number of `ShelfUnit` rows where `shelfId = shelf.unitId`. The counter SHALL be maintained at write time: inserting a `ShelfUnit` row increments it by one, deleting a `ShelfUnit` row decrements it by one. Writing or deleting a `ShelfUnitRelation` row SHALL NOT change `itemCount`. Read paths SHALL NOT issue runtime `COUNT(*)` queries against `ShelfUnit` to populate `itemCount`.

#### Scenario: Adding a unit increments itemCount

- **GIVEN** shelf `S` has `itemCount = 5`
- **WHEN** a new `ShelfUnit(S, U)` row is inserted
- **THEN** `Shelf.itemCount` for `S` SHALL become `6`
- **AND** no `COUNT(*)` query SHALL be issued

#### Scenario: Attaching a child does not change itemCount

- **GIVEN** shelf `S` has `itemCount = 6` and contains `ShelfUnit(S, B)` and `ShelfUnit(S, R)`
- **WHEN** a `ShelfUnitRelation(S, B, R, 'review')` row is inserted
- **THEN** `Shelf.itemCount` SHALL remain `6`

#### Scenario: Creating an attached-only child increments itemCount

- **GIVEN** shelf `S` has `itemCount = 5` and contains `ShelfUnit(S, B)`
- **WHEN** review `R` is attached to `B`, requiring `ShelfUnit(S, R)` to be created
- **THEN** `Shelf.itemCount` SHALL become `6` because one new `ShelfUnit` row was inserted
- **AND** the subsequent `ShelfUnitRelation` insert SHALL NOT further change `itemCount`

### Requirement: Pagination by position

The API SHALL return shelf units ordered by `position ASC` and SHALL support pagination with a default page size of 100.

#### Scenario: Shelf with fewer than 100 units

- **WHEN** a client requests units from a shelf with 50 units and no pagination params
- **THEN** all 50 units SHALL be returned ordered by `position` ASC

#### Scenario: Shelf larger than the page size

- **WHEN** a client requests the next page of a 200-unit shelf
- **THEN** the API SHALL return the next 100 units in `position` ASC order
- **AND** the response SHALL indicate whether more units remain

## Item kinds

### Requirement: ShelfUnit kind render discriminator

Each `ShelfUnit` SHALL have a `kind` field (`String`, max 32 characters) that tells the frontend which component to render without first hydrating the referenced Unit. The system SHALL determine `kind` at write time from the source Unit's type and — for POSTs — the `Post.kind` subtype.

#### Scenario: Book unit stores book kind

- **WHEN** a BOOK Unit is added to a shelf
- **THEN** the `ShelfUnit` SHALL have `kind = "book"`

#### Scenario: Review post unit stores review kind

- **WHEN** a POST Unit with `Post.kind = REVIEW` is added to a shelf
- **THEN** the `ShelfUnit` SHALL have `kind = "review"`

#### Scenario: Tag unit stores tag kind

- **WHEN** a TAG Unit is added to a shelf
- **THEN** the `ShelfUnit` SHALL have `kind = "tag"`

### Requirement: ShelfUnit kind value set

The contract package SHALL export a `ShelfUnitKind` union type covering all supported stored kind values. The initial supported values SHALL match the previous shelf item kind vocabulary unless another spec narrows or widens it.

#### Scenario: Contract exports ShelfUnitKind

- **WHEN** the shared contract package is compiled
- **THEN** it SHALL export `ShelfUnitKind`
- **AND** code SHALL NOT export `ShelfItemKind` as the canonical type for new shelf APIs

### Requirement: ShelfUnit kind is stored at write time

The `kind` value SHALL be computed at the moment a shelf unit is created and stored directly on `ShelfUnit.kind`. The render path SHALL NOT re-derive `kind` from joined `Unit`/`Post` data at read time.

#### Scenario: Create review computes review kind once

- **WHEN** a REVIEW post is attached to a shelf
- **THEN** the service SHALL create or update the child `ShelfUnit` with `kind = "review"`
- **AND** the shelf items response SHALL return that stored kind

## Item-unit junction

### Requirement: ShelfUnitRelation describes shelf-unit attachment edges

The system SHALL provide a `ShelfUnitRelation` model as the authoritative parent-child relation between two `ShelfUnit` rows in the same shelf. `ShelfUnitRelation` SHALL describe attachment only and SHALL NOT carry manual ordering state.

`ShelfUnitRelation` SHALL contain exactly these fields:

- `shelfId: String @db.Uuid` — owning shelf (references `Shelf.unitId`)
- `parentUnitId: String @db.Uuid` — parent `ShelfUnit.unitId`
- `childUnitId: String @db.Uuid` — child `ShelfUnit.unitId`
- `role: String @db.VarChar(32)` — relation role discriminator (`review | tag | ...`)

The composite primary key SHALL be `@@id([shelfId, parentUnitId, childUnitId, role])`. The PK intentionally allows the same `childUnitId` to appear under multiple `parentUnitId` values within one shelf.

#### Scenario: Schema declares ShelfUnitRelation with composite PK

- **WHEN** reviewing the Prisma schema
- **THEN** a `ShelfUnitRelation` model SHALL exist with the fields listed above
- **AND** the composite PK SHALL be `@@id([shelfId, parentUnitId, childUnitId, role])`
- **AND** no `position` column SHALL exist on `ShelfUnitRelation`
- **AND** no additional uniqueness constraint on `(shelfId, childUnitId, role)` SHALL exist that would forbid multi-parent attachment

### Requirement: ShelfUnitRelation cascade semantics

`ShelfUnitRelation` SHALL reference both parent and child rows through `(shelfId, unitId)` foreign keys to `ShelfUnit`. Deleting a shelf unit SHALL cascade relation rows where it is either parent or child.

#### Scenario: Deleting a parent removes its relations

- **GIVEN** shelf `S` has a parent unit `B` with review child `R`
- **WHEN** `ShelfUnit(S, B)` is deleted
- **THEN** every `ShelfUnitRelation` row with `parentUnitId = B` SHALL be cascade-deleted
- **AND** `ShelfUnit(S, R)` SHALL remain unless explicitly deleted

#### Scenario: Deleting a child removes incoming relations

- **GIVEN** shelf `S` has relation `B -> R`
- **WHEN** `ShelfUnit(S, R)` is deleted
- **THEN** the relation `B -> R` SHALL be cascade-deleted

### Requirement: ShelfUnitRelation indexes support graph reads

`ShelfUnitRelation` SHALL declare indexes that support fetching children for a parent, detecting whether a unit is a child, and reverse role lookups.

#### Scenario: Fetch children for parent

- **WHEN** the system queries children of parent `B` in shelf `S`
- **THEN** the query SHALL target `ShelfUnitRelation` with `WHERE shelfId = S AND parentUnitId = B`
- **AND** a B-tree index SHALL support that lookup

#### Scenario: Detect root units

- **WHEN** the frontend or server computes root shelf units
- **THEN** it SHALL treat units appearing as `childUnitId` in `ShelfUnitRelation` for the same shelf as non-root units

### Requirement: Multi-parent attachment is allowed

A `ShelfUnit` MAY be the child of multiple `ShelfUnitRelation` rows in the same shelf, including under different roles and including the same role with different parents. The system SHALL NOT reject inserts on the basis that the child already has another parent in the shelf.

#### Scenario: Same tag attached to two parents

- **GIVEN** shelf `S` contains `ShelfUnit(B1)`, `ShelfUnit(B2)`, and `ShelfUnit(T)`
- **WHEN** `T` is attached to `B1` and then attached to `B2` with `role = 'tag'`
- **THEN** both relation rows SHALL exist: `(S, B1, T, 'tag')` and `(S, B2, T, 'tag')`
- **AND** neither insert SHALL be rejected as duplicate
- **AND** `ShelfUnit(S, T)` SHALL remain a single row

#### Scenario: Same review attached to two parents

- **GIVEN** shelf `S` contains `ShelfUnit(B1)`, `ShelfUnit(B2)`, and `ShelfUnit(R)`
- **WHEN** `R` is attached to `B1` with `role = 'review'` and then attached to `B2` with `role = 'review'`
- **THEN** both relation rows SHALL exist and be retrievable

### Requirement: Self-relation forbidden

The service layer SHALL reject any `ShelfUnitRelation` write where `parentUnitId === childUnitId`. Self-relation has no rendering meaning and would cause infinite recursion in nested-mode expansion.

Multi-step cycles (`A → B → A`) are NOT rejected at write time at this stage; the renderer is responsible for tracking the visited set per traversal so a cycle is rendered at most once.

#### Scenario: Self-relation rejected

- **WHEN** the system attempts to insert `ShelfUnitRelation(S, U, U, role)` for any `role`
- **THEN** the service SHALL reject the write with a validation error
- **AND** no row SHALL be created

#### Scenario: Two-step cycle not rejected

- **WHEN** the system inserts `ShelfUnitRelation(S, A, B, 'review')` followed by `ShelfUnitRelation(S, B, A, 'review')`
- **THEN** both inserts SHALL succeed
- **AND** the nested-mode renderer SHALL render each unit at most once per traversal

### Requirement: Relation role vocabulary

The initial set of `ShelfUnitRelation.role` values SHALL be `review | tag`. Containment itself SHALL NOT be represented by a `primary` relation role; containment is represented by `ShelfUnit`.

#### Scenario: Supported roles at first ship

- **WHEN** the contract package exports the relation role type
- **THEN** `ShelfUnitRelationRole` SHALL be a union of exactly `'review' | 'tag'`
- **AND** it SHALL NOT include `'primary'`

### Requirement: Attach and detach review via ShelfUnitRelation

Attaching review `R` to parent unit `B` in shelf `S` SHALL ensure both `B` and `R` exist as `ShelfUnit` rows and SHALL insert one `ShelfUnitRelation(S, B, R, 'review')` row. Detaching SHALL delete that relation row.

#### Scenario: Attach review creates child ShelfUnit when missing

- **GIVEN** shelf `S` contains book unit `B`
- **WHEN** review `R` is attached to `B`
- **THEN** the system SHALL create `ShelfUnit(S, R)` if it does not already exist
- **AND** it SHALL insert `ShelfUnitRelation(S, B, R, 'review')`

#### Scenario: Detach review keeps child unit

- **GIVEN** shelf `S` contains relation `B -> R`
- **WHEN** review `R` is detached from `B`
- **THEN** the relation row SHALL be deleted
- **AND** `ShelfUnit(S, R)` SHALL remain unless a separate delete operation removes it

### Requirement: No generic UnitEdge table

The system SHALL NOT introduce a generic `UnitEdge(fromUnitId, toUnitId, role)` Unit self-reference junction as an alternative way to express shelf unit relations. Shelf-scoped attachment relationships SHALL live in the domain-specific `ShelfUnitRelation` table only.

#### Scenario: No UnitEdge in the Prisma schema

- **WHEN** reviewing the Prisma schema
- **THEN** no `UnitEdge` or equivalently-named generic Unit self-reference junction SHALL exist
- **AND** all shelf-scoped attachment relationships SHALL be expressed through `ShelfUnitRelation`

## Batch hydration

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
