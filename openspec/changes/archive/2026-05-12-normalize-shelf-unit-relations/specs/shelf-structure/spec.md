## ADDED Requirements

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

## REMOVED Requirements

### Requirement: ShelfItem is a utilitarian render-only slot

**Reason**: The slot-only model prevents attached children from being first-class sortable shelf entries.

**Migration**: Replace with `ShelfUnit is a sortable shelf-contained unit`.

### Requirement: ShelfItem fractional-index position

**Reason**: Manual ordering moves from `ShelfItem.position` to `ShelfUnit.position`.

**Migration**: Copy existing positions onto migrated `ShelfUnit` rows and generate deterministic positions for migrated attached children.

### Requirement: ShelfItem itemRef without foreign key

**Reason**: `itemRef` is replaced by the clearer `ShelfUnit.unitId` field.

**Migration**: Rename or copy `itemRef` values into `unitId`.

### Requirement: ShelfItem composite primary key on itemRef

**Reason**: The composite key is renamed from `(shelfUnitId, itemRef)` to `(shelfId, unitId)`.

**Migration**: Preserve uniqueness while moving to the new key.
