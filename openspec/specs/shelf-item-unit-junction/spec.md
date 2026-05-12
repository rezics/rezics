## ADDED Requirements

### Requirement: ShelfItemUnit is the shelf item ↔ unit role junction

The system SHALL provide a `ShelfItemUnit` model as the authoritative role-scoped junction between a `ShelfItem` slot and its referenced `Unit` rows. `ShelfItemUnit` SHALL be the single source of truth for shelf item ↔ unit membership across every role. `ShelfItem` SHALL NOT duplicate this information by carrying per-role unit-id arrays.

`ShelfItemUnit` SHALL contain exactly these fields:

- `shelfUnitId: String @db.Uuid` — owning shelf
- `itemRef: String @db.Uuid` — slot binding (matches `ShelfItem.itemRef` within the same shelf)
- `unitId: String @db.Uuid` — the referenced unit
- `role: String @db.VarChar(32)` — role discriminator (`primary | review | tag | ...`)

The composite primary key SHALL be `@@id([shelfUnitId, itemRef, unitId, role])`.

#### Scenario: Schema declares ShelfItemUnit with composite PK

- **WHEN** reviewing the Prisma schema
- **THEN** a `ShelfItemUnit` model SHALL exist with the fields listed above
- **AND** the composite PK SHALL be `@@id([shelfUnitId, itemRef, unitId, role])`

### Requirement: ShelfItemUnit relations and cascade semantics

`ShelfItemUnit` SHALL declare three relations with the following cascade behavior:

- `shelf Shelf @relation(fields: [shelfUnitId], references: [unitId], onDelete: Cascade)` — deleting the shelf cascades.
- `slot ShelfItem @relation(fields: [shelfUnitId, itemRef], references: [shelfUnitId, itemRef], onDelete: Cascade)` — deleting the slot cascades to every `ShelfItemUnit` row bound to it (all roles).
- `unit Unit @relation(fields: [unitId], references: [id], onDelete: Cascade)` — deleting the unit cascades.

`Shelf` SHALL declare a back-reference `shelfItemUnits ShelfItemUnit[]`. `Unit` SHALL declare a back-reference `shelfItemUnits ShelfItemUnit[]`. `ShelfItem` SHALL declare a back-reference `shelfItemUnits ShelfItemUnit[]`.

#### Scenario: Deleting a shelf cascades to all ShelfItemUnit rows

- **GIVEN** a shelf `S` with `ShelfItem` slots and `ShelfItemUnit` rows of various roles
- **WHEN** the shelf `S` is deleted
- **THEN** all `ShelfItem` rows for `S` SHALL be cascade-deleted
- **AND** all `ShelfItemUnit` rows for `S` SHALL be cascade-deleted

#### Scenario: Deleting a slot cascades to its ShelfItemUnit rows

- **GIVEN** a `ShelfItem` slot with `role='primary'`, two `role='review'`, and three `role='tag'` rows in `ShelfItemUnit`
- **WHEN** the `ShelfItem` row is deleted
- **THEN** all six `ShelfItemUnit` rows bound to that slot SHALL be cascade-deleted
- **AND** `ShelfItemUnit` rows for other slots in the same shelf SHALL be unaffected

#### Scenario: Deleting a unit cascades to ShelfItemUnit but not ShelfItem

- **GIVEN** a Unit `U` is referenced by `ShelfItemUnit` rows (as primary in shelf A, as review attachment in shelf B)
- **WHEN** Unit `U` is deleted
- **THEN** every `ShelfItemUnit` row with `unitId = U` SHALL be cascade-deleted
- **AND** any `ShelfItem` with `itemRef = U` SHALL remain (because `ShelfItem.itemRef` has no FK)
- **AND** those `ShelfItem` rows SHALL be treated as orphans (their `role='primary'` attachment has been removed)

#### Scenario: Navigable from both Shelf and Unit

- **WHEN** Prisma generates the client from the schema
- **THEN** `Shelf.shelfItemUnits: ShelfItemUnit[]` SHALL be a queryable relation
- **AND** `Unit.shelfItemUnits: ShelfItemUnit[]` SHALL be a queryable relation
- **AND** `ShelfItem.shelfItemUnits: ShelfItemUnit[]` SHALL be a queryable relation

### Requirement: ShelfItemUnit reverse-lookup indexes

`ShelfItemUnit` SHALL declare the following indexes to support reverse lookups without GIN:

- `@@index([unitId])` — "which shelves contain unit U (any role)"
- `@@index([unitId, role])` — "which shelves contain unit U as role R"
- `@@index([shelfUnitId, role])` — "within shelf S, all rows of role R"

#### Scenario: Reverse lookup of a unit across shelves

- **WHEN** the system queries "which shelves contain unit U"
- **THEN** the query SHALL target `ShelfItemUnit` with `WHERE unitId = U`
- **AND** SHALL use the `@@index([unitId])` B-tree index
- **AND** SHALL NOT use any GIN index

#### Scenario: Typed reverse lookup by role

- **WHEN** the system queries "which shelves attach review R"
- **THEN** the query SHALL target `ShelfItemUnit` with `WHERE unitId = R AND role = 'review'`
- **AND** SHALL use the `@@index([unitId, role])` B-tree index

#### Scenario: In-shelf filter by role

- **WHEN** the system queries "all review attachments in shelf S"
- **THEN** the query SHALL target `ShelfItemUnit` with `WHERE shelfUnitId = S AND role = 'review'`
- **AND** SHALL use the `@@index([shelfUnitId, role])` B-tree index

### Requirement: Role vocabulary

The initial set of `ShelfItemUnit.role` values SHALL be `primary | review | tag`. The system SHALL allow new role values to be introduced by string literal without requiring a schema migration, a new column, or a new index. The contract package SHALL export a `ShelfItemUnitRole` union type enumerating all supported roles at any given release.

#### Scenario: Supported roles at first ship

- **WHEN** the contract package is consumed at the release of this change
- **THEN** `ShelfItemUnitRole` SHALL be a union of exactly `'primary' | 'review' | 'tag'`

#### Scenario: Adding a new role later requires no migration

- **WHEN** a future change introduces a new role (e.g. `contributor`)
- **THEN** the addition SHALL be a contract-layer widening of the `ShelfItemUnitRole` union
- **AND** SHALL NOT require altering the `ShelfItemUnit` Prisma schema or its indexes

### Requirement: Dual-write on slot add

When a unit `U` is added to a shelf `S` as a new slot, the system SHALL write both a `ShelfItem` row and a `ShelfItemUnit` row with `role='primary'` in a single transaction.

- `ShelfItem`: `(shelfUnitId = S, itemRef = U, kind, position, createdAt)`
- `ShelfItemUnit`: `(shelfUnitId = S, itemRef = U, unitId = U, role = 'primary')`

#### Scenario: Add a unit to a shelf creates both rows

- **WHEN** a user adds Unit `U` to Shelf `S`
- **THEN** the insert SHALL create one `ShelfItem` row and one `ShelfItemUnit` row with `role='primary'` (`unitId = U`, `itemRef = U`) atomically
- **AND** if either insert fails, the transaction SHALL roll back and no row SHALL be created

#### Scenario: Re-adding an existing slot is a no-op

- **GIVEN** a slot with `(shelfUnitId = S, itemRef = U)` already exists
- **WHEN** the user attempts to add Unit `U` to Shelf `S` again
- **THEN** the composite PK on `ShelfItem` SHALL reject the insert
- **AND** no duplicate `ShelfItemUnit` rows SHALL be created

### Requirement: Attach and detach review via ShelfItemUnit

Attaching a review `R` to an existing slot `(S, U)` SHALL insert one `ShelfItemUnit(shelfUnitId=S, itemRef=U, unitId=R, role='review')` row. Detaching SHALL delete the same row.

#### Scenario: Attach a review to a slot with no existing reviews

- **GIVEN** Shelf `S` contains slot `(itemRef = U)` with no review attachments
- **WHEN** review `R` is attached to that slot
- **THEN** one new `ShelfItemUnit` row SHALL be inserted with `(S, U, R, 'review')`
- **AND** no `ShelfItem` row SHALL be modified

#### Scenario: Detach a review

- **GIVEN** a slot `(S, U)` with review `R` attached
- **WHEN** review `R` is detached
- **THEN** the `ShelfItemUnit` row `(S, U, R, 'review')` SHALL be deleted
- **AND** the `ShelfItem` row for that slot SHALL remain
- **AND** other review attachments on the slot SHALL be unaffected

#### Scenario: Duplicate attach is a no-op

- **GIVEN** a slot `(S, U)` already has review `R` attached
- **WHEN** the system attempts to attach `R` to the same slot again
- **THEN** the composite PK SHALL reject the second insert
- **AND** exactly one `ShelfItemUnit` row for `(S, U, R, 'review')` SHALL remain

### Requirement: Set tags via ShelfItemUnit

Setting per-item tags for a slot `(S, U)` to a target set `T = [t1, t2, ...]` SHALL result in the `ShelfItemUnit` rows with `(shelfUnitId=S, itemRef=U, role='tag')` exactly matching `T` after the operation. Values SHALL be unit ids — free-text strings SHALL NOT be accepted.

#### Scenario: Set tags replaces the existing tag set

- **GIVEN** a slot `(S, U)` has `role='tag'` rows for unit ids `[A, B, C]`
- **WHEN** `setItemTags(S, U, [B, D])` is called
- **THEN** after the operation the `role='tag'` rows for that slot SHALL be exactly `[B, D]`
- **AND** rows for `A` and `C` SHALL be deleted
- **AND** a new row for `D` SHALL be inserted

#### Scenario: Set tags to empty clears attachments

- **GIVEN** a slot `(S, U)` has two `role='tag'` rows
- **WHEN** `setItemTags(S, U, [])` is called
- **THEN** all `role='tag'` rows for that slot SHALL be deleted
- **AND** no `role='tag'` row for that slot SHALL exist after the operation

#### Scenario: Setting tags does not affect reviews or primary

- **GIVEN** a slot `(S, U)` with `role='primary'`, two `role='review'`, and one `role='tag'` row
- **WHEN** `setItemTags(S, U, [X])` is called
- **THEN** the `role='primary'` and `role='review'` rows SHALL be unaffected
- **AND** only `role='tag'` rows SHALL change

### Requirement: Read-time projection to ShelfItemDTO

The shelf items endpoint SHALL return each `ShelfItem` together with per-slot `reviewIds: string[]` and `tagIds: string[]` arrays derived from `ShelfItemUnit` rows. The projection SHALL be computed server-side via a single fan-out read over `ShelfItemUnit` filtered by the page's `itemRef` set, grouped by `(itemRef, role)`.

#### Scenario: Response includes projected arrays

- **WHEN** a client requests items from shelf `S`
- **THEN** each returned `ShelfItemDTO` SHALL include `reviewIds: string[]` and `tagIds: string[]`
- **AND** the values SHALL equal the `unitId` values from `ShelfItemUnit` rows with matching `itemRef` and `role='review'` / `role='tag'` respectively
- **AND** the projection SHALL NOT require the frontend to issue a second request against `ShelfItemUnit`

#### Scenario: Slot with no attachments

- **WHEN** a slot has no `role='review'` or `role='tag'` rows in `ShelfItemUnit`
- **THEN** the returned DTO SHALL have `reviewIds: []` and `tagIds: []`

### Requirement: No generic UnitEdge table

The system SHALL NOT introduce a generic `UnitEdge(fromUnitId, toUnitId, role)` Unit self-reference junction as an alternative way to express shelf item ↔ unit membership. Shelf item role membership SHALL live in the domain-specific `ShelfItemUnit` table only.

#### Scenario: No UnitEdge in the Prisma schema

- **WHEN** reviewing the Prisma schema
- **THEN** no `UnitEdge` or equivalently-named generic Unit self-reference junction SHALL exist
- **AND** all shelf item ↔ unit role relationships SHALL be expressed through `ShelfItemUnit`
