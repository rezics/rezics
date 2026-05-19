# content-authority Specification

## Purpose

Defines Unit ownership, the seeded `rezics` and `rezics-wiki` infra users, Unit collaborators, sparse field locks, the field-key vocabulary, and the runtime gate that admits or rejects collaborative Unit edits. `Unit.userId` remains the primary owner/custodian; `UnitCollaborator` rows grant delegated authority; and `UnitFieldLock` rows are the runtime source of truth for which fields are blocked from community edits. Edit admission considers actor permission, primary owner, collaborators, endpoint surface policy, and lock rows — never `UnitType` or owner identity alone.

## Requirements

### Requirement: Infra user identities
The system SHALL seed ordinary `User` + `Unit(type=USER)` records for `rezics` and `rezics-wiki`. These users SHALL have no login credential binding and SHALL be usable anywhere a normal `userId` is required for ownership, history, audit, lock, or collaborator records.

#### Scenario: Seed creates infra users
- **WHEN** the server seed process runs on an empty database
- **THEN** it creates `rezics` and `rezics-wiki` User rows with backing USER Units
- **AND** neither User has an `authUserId`

#### Scenario: Seed is idempotent
- **WHEN** the server seed process runs after `rezics` and `rezics-wiki` already exist
- **THEN** it updates or preserves the existing rows without creating duplicates

### Requirement: Primary owner remains Unit userId
The system SHALL keep `Unit.userId` as the primary owner or custodian of a Unit. Unit collaborators SHALL grant delegated authority but SHALL NOT replace or obscure the primary owner.

#### Scenario: Unit has primary owner and collaborator
- **WHEN** a Unit has `userId = "owner-1"` and a Unit collaborator row for `"editor-1"`
- **THEN** owner checks SHALL still identify `"owner-1"` as the primary owner
- **AND** collaborator checks SHALL identify `"editor-1"` only as delegated authority

### Requirement: Unit collaborators
The system SHALL support `UnitCollaborator` rows that grant per-Unit delegated authority to users. Collaborator rows SHALL include `unitId`, `userId`, `roleKey`, `addedById`, and `createdAt`.

#### Scenario: Collaborator is granted authority
- **WHEN** a primary owner adds user B as `roleKey = "editor"` on Unit A
- **THEN** the system records a `UnitCollaborator` row for Unit A and user B
- **AND** collaborative edit admission can grant user B permissions according to the `editor` role

#### Scenario: Duplicate collaborator is rejected
- **WHEN** a collaborator row already exists for the same `unitId` and `userId`
- **THEN** creating another collaborator row for that pair SHALL fail or update the existing row through an explicit replace operation

### Requirement: Sparse field locks
The system SHALL store protected Unit fields in a sparse `UnitFieldLock` table. A row with `fieldKey = "*"` SHALL lock the entire Unit against community edits. Field keys SHALL be contract-defined semantic keys rather than raw database column names.

#### Scenario: Field lock blocks community edit
- **WHEN** Unit A has a `UnitFieldLock` row for `fieldKey = "identity.title"`
- **AND** a community editor attempts to edit `identity.title`
- **THEN** the edit SHALL be rejected with a 403-style authority error

#### Scenario: Whole-object lock blocks community edit
- **WHEN** Unit A has a `UnitFieldLock` row for `fieldKey = "*"`
- **AND** a community editor attempts to edit any collaborative field on Unit A
- **THEN** the edit SHALL be rejected with a 403-style authority error

#### Scenario: Unlocked field admits community edit
- **WHEN** Unit A has no `UnitFieldLock` rows for `"*"` or the changed field keys
- **AND** the endpoint surface is collaborative
- **THEN** the lock layer SHALL NOT block a community edit

### Requirement: Runtime authority gate
The system SHALL determine collaborative edit admission from actor permission, primary owner, Unit collaborators, endpoint surface policy, and `UnitFieldLock` rows. The system SHALL NOT grant community edit authority merely because a Unit has a wiki-eligible type or because `Unit.userId` equals the seeded `rezics-wiki` User's `unitId`.

#### Scenario: Type alone does not grant community edit
- **WHEN** a BOOK Unit is personal-owned by user A
- **AND** user B is not owner, collaborator, ROOT, or ADMIN
- **THEN** user B SHALL NOT be allowed to edit the Unit merely because the Unit type is BOOK

#### Scenario: Rezics-wiki ownership alone does not bypass locks
- **WHEN** a Unit's `userId` equals the seeded `rezics-wiki` User's `unitId`
- **AND** the changed field is locked by `UnitFieldLock`
- **THEN** a community editor SHALL NOT be allowed to edit that field

#### Scenario: Admin override
- **WHEN** a ROOT or ADMIN actor edits a locked collaborative field
- **THEN** the system SHALL allow the edit
- **AND** the action SHALL be recorded as an override in history or audit metadata

### Requirement: Non-collaborative surfaces skip lock lookup
The system SHALL reject community edits to non-collaborative surfaces before querying `UnitFieldLock`. Ordinary post/review/remark/reply update endpoints SHALL remain author/owner-controlled and SHALL NOT run the community field-lock admission path.

#### Scenario: Ordinary post update rejects non-author
- **WHEN** user B attempts to update an ordinary post authored by user A
- **THEN** the post update endpoint SHALL reject user B by post permission rules
- **AND** it SHALL NOT need to query `UnitFieldLock`

### Requirement: Lock and collaborator mutation authority
The system SHALL restrict lock and collaborator management to the primary owner, sufficiently privileged collaborators, or ROOT/ADMIN actors.

#### Scenario: Owner creates field lock
- **WHEN** a Unit primary owner creates a `UnitFieldLock` row for the Unit
- **THEN** the system SHALL accept the lock change
- **AND** the lock change SHALL be recorded for history/audit

#### Scenario: Community editor cannot manage locks
- **WHEN** a community editor has no owner or lock-management collaborator role
- **THEN** attempts to add or remove a `UnitFieldLock` row SHALL be rejected
