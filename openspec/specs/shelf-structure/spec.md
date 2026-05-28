# shelf-structure Specification

## Purpose

Defines the `ShelfUnit` model that owns shelf containment and manual
ordering: the exact field set, the composite primary key
`(shelfId, unitId)`, the fractional-index `position` column that
backs append/drag-drop reorder, and the density-rebalancing window
that fires when a generated key would grow past the length
threshold. Also enforces the `shelfId` column naming so the model
name and column name don't collide.

## Requirements

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
