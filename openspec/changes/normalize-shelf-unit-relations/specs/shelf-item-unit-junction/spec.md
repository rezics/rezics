## ADDED Requirements

### Requirement: ShelfUnitRelation describes shelf-unit attachment edges

The system SHALL provide a `ShelfUnitRelation` model as the authoritative parent-child relation between two `ShelfUnit` rows in the same shelf. `ShelfUnitRelation` SHALL describe attachment only and SHALL NOT carry manual ordering state.

`ShelfUnitRelation` SHALL contain exactly these fields:

- `shelfUnitId: String @db.Uuid` — owning shelf
- `parentUnitId: String @db.Uuid` — parent `ShelfUnit.unitId`
- `childUnitId: String @db.Uuid` — child `ShelfUnit.unitId`
- `role: String @db.VarChar(32)` — relation role discriminator (`review | tag | ...`)

The composite primary key SHALL be `@@id([shelfUnitId, parentUnitId, childUnitId, role])`.

#### Scenario: Schema declares ShelfUnitRelation with composite PK

- **WHEN** reviewing the Prisma schema
- **THEN** a `ShelfUnitRelation` model SHALL exist with the fields listed above
- **AND** the composite PK SHALL be `@@id([shelfUnitId, parentUnitId, childUnitId, role])`
- **AND** no `position` column SHALL exist on `ShelfUnitRelation`

### Requirement: ShelfUnitRelation cascade semantics

`ShelfUnitRelation` SHALL reference both parent and child rows through `(shelfUnitId, unitId)` foreign keys to `ShelfUnit`. Deleting a shelf unit SHALL cascade relation rows where it is either parent or child.

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
- **THEN** the query SHALL target `ShelfUnitRelation` with `WHERE shelfUnitId = S AND parentUnitId = B`
- **AND** a B-tree index SHALL support that lookup

#### Scenario: Detect root units

- **WHEN** the frontend or server computes root shelf units
- **THEN** it SHALL treat units appearing as `childUnitId` in `ShelfUnitRelation` for the same shelf as non-root units

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

## MODIFIED Requirements

### Requirement: No generic UnitEdge table

The system SHALL NOT introduce a generic `UnitEdge(fromUnitId, toUnitId, role)` Unit self-reference junction as an alternative way to express shelf unit relations. Shelf-scoped attachment relationships SHALL live in the domain-specific `ShelfUnitRelation` table only.

#### Scenario: No UnitEdge in the Prisma schema

- **WHEN** reviewing the Prisma schema
- **THEN** no `UnitEdge` or equivalently-named generic Unit self-reference junction SHALL exist
- **AND** all shelf-scoped attachment relationships SHALL be expressed through `ShelfUnitRelation`

## REMOVED Requirements

### Requirement: ShelfItemUnit is the shelf item ↔ unit role junction

**Reason**: The role-junction model conflates containment and attachment.

**Migration**: Move containment into `ShelfUnit` rows and attachment into `ShelfUnitRelation` rows.

### Requirement: ShelfItemUnit relations and cascade semantics

**Reason**: Cascade semantics now reference parent and child `ShelfUnit` rows.

**Migration**: Replace old slot/unit relations with parent/child shelf-unit FKs.

### Requirement: ShelfItemUnit reverse-lookup indexes

**Reason**: Reverse lookup indexes must target `ShelfUnit` containment and `ShelfUnitRelation` edges separately.

**Migration**: Add indexes for `ShelfUnit.unitId` containment and `ShelfUnitRelation` graph reads as needed.

### Requirement: Role vocabulary

**Reason**: `primary` is no longer a relation role.

**Migration**: Replace `ShelfItemUnitRole` with `ShelfUnitRelationRole`.

### Requirement: Dual-write on slot add

**Reason**: Adding a contained unit now writes only `ShelfUnit`; attachment writes are separate relation operations.

**Migration**: Remove `role='primary'` writes.

### Requirement: Attach and detach review via ShelfItemUnit

**Reason**: Review attachment now links two `ShelfUnit` rows with `ShelfUnitRelation`.

**Migration**: Ensure child `ShelfUnit` exists, then create the relation.

### Requirement: Set tags via ShelfItemUnit

**Reason**: Tag attachment now links tag `ShelfUnit` rows with `ShelfUnitRelation`.

**Migration**: Ensure tag child units exist, then reconcile `role='tag'` relations.

### Requirement: Read-time projection to ShelfItemDTO

**Reason**: The API no longer projects `reviewIds` / `tagIds` arrays onto parent rows.

**Migration**: Return `ShelfUnitDTO[]` and `ShelfUnitRelationDTO[]`.
