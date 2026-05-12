## ADDED Requirements

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
