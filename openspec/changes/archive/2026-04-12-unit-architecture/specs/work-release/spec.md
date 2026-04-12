## ADDED Requirements

### Requirement: A work is a Unit with no parent and a type that supports the work/release pattern

A work Unit SHALL have `workUnitId = null` and a `type` from the set that supports the work/release pattern (`BOOK`, `GAME`, `MEDIA`). The work role is derived from this state -- there is no explicit role enum.

#### Scenario: Create a work unit

- GIVEN an authenticated user
- WHEN the user creates a Unit with `type = BOOK` and `workUnitId = null`
- THEN the Unit SHALL be persisted as a work
- AND querying for works SHALL include this unit

#### Scenario: Non-work/release types cannot be works with releases

- GIVEN a Unit of type `POST` with `workUnitId = null`
- WHEN another Unit attempts to set `workUnitId` to this POST unit's id
- THEN the system SHALL reject the operation because `POST` does not support the work/release pattern

### Requirement: A release is a Unit with workUnitId set to its parent work

A release Unit SHALL have `workUnitId` set to the id of an existing work Unit. The release's `type` MUST match the parent work's `type`. A work MAY have zero or more releases.

#### Scenario: Create a release for a work

- GIVEN a work Unit "work-1" with `type = BOOK` and `workUnitId = null`
- WHEN the user creates a new Unit with `type = BOOK` and `workUnitId = "work-1"`
- THEN the release Unit SHALL be persisted with `workUnitId = "work-1"`
- AND querying releases for "work-1" SHALL include this unit

#### Scenario: Multiple releases under one work

- GIVEN a work Unit "work-1" of type `GAME`
- WHEN three release Units are created with `workUnitId = "work-1"` and `type = GAME`
- THEN all three releases SHALL be associated with "work-1"
- AND querying `Unit WHERE workUnitId = "work-1"` SHALL return all three

### Requirement: Release type MUST match its parent work type

The system SHALL enforce that a release Unit's `type` is identical to the `type` of the Unit referenced by `workUnitId`. This invariant MUST be validated at creation time.

#### Scenario: Matching types accepted

- GIVEN a work Unit "work-1" with `type = MEDIA`
- WHEN a release Unit is created with `type = MEDIA` and `workUnitId = "work-1"`
- THEN the release SHALL be created successfully

#### Scenario: Mismatched types rejected

- GIVEN a work Unit "work-1" with `type = BOOK`
- WHEN a caller attempts to create a release Unit with `type = GAME` and `workUnitId = "work-1"`
- THEN the system SHALL reject the creation with a validation error
- AND no release Unit SHALL be persisted

### Requirement: workUnitId MUST reference an existing unit that is itself a work

The `workUnitId` field, when set, SHALL reference an existing Unit whose own `workUnitId` is null (i.e., a work, not another release). A release cannot be nested under another release.

#### Scenario: workUnitId points to a valid work

- GIVEN a work Unit "work-1" with `workUnitId = null`
- WHEN a release is created with `workUnitId = "work-1"`
- THEN the creation SHALL succeed

#### Scenario: workUnitId points to a release (rejected)

- GIVEN a release Unit "release-1" with `workUnitId = "work-1"`
- WHEN a caller attempts to create a Unit with `workUnitId = "release-1"`
- THEN the system SHALL reject the creation because "release-1" is itself a release, not a work

#### Scenario: workUnitId points to a non-existent unit (rejected)

- GIVEN no Unit exists with `id = "nonexistent"`
- WHEN a caller attempts to create a Unit with `workUnitId = "nonexistent"`
- THEN the system SHALL reject the creation with a not-found or foreign key error

### Requirement: Releases for a work are discovered by querying workUnitId

To find all releases belonging to a work, the system SHALL query `Unit WHERE workUnitId = workId`. There is no separate join table or relationship model for work-release associations.

#### Scenario: Query releases for a work

- GIVEN a work Unit "work-1" with releases "release-a", "release-b", and "release-c"
- WHEN the system queries `Unit WHERE workUnitId = "work-1"`
- THEN the result set SHALL contain exactly "release-a", "release-b", and "release-c"

#### Scenario: Work with no releases

- GIVEN a work Unit "work-2" with no releases
- WHEN the system queries `Unit WHERE workUnitId = "work-2"`
- THEN the result set SHALL be empty

### Requirement: Standalone units are neither works nor releases

A standalone unit is a Unit with `workUnitId = null` that has no other units referencing it via `workUnitId`. Standalone units operate independently without work/release semantics. Any UnitType may exist as a standalone unit.

#### Scenario: Standalone POST unit

- GIVEN a Unit of type `POST` with `workUnitId = null`
- AND no other Unit has `workUnitId` pointing to this unit
- THEN this unit SHALL be treated as a standalone unit
- AND it SHALL not participate in work/release queries

#### Scenario: BOOK unit without releases is standalone

- GIVEN a Unit of type `BOOK` with `workUnitId = null`
- AND no other Unit has `workUnitId` pointing to this unit
- THEN this unit is structurally a standalone unit (it could become a work if releases are later added)

### Requirement: Deleting a work sets releases' workUnitId to null via onDelete SetNull

When a work Unit is deleted (or its record is removed), the database SHALL set `workUnitId = null` on all release Units that referenced it, via Prisma's `onDelete: SetNull` referential action. This converts former releases into standalone units rather than cascade-deleting them.

#### Scenario: Work deletion orphans its releases

- GIVEN a work Unit "work-1" with releases "release-a" and "release-b"
- WHEN "work-1" is deleted (soft-delete to `status = DELETED` or hard-delete)
- THEN "release-a" and "release-b" SHALL have their `workUnitId` set to null
- AND both SHALL continue to exist as standalone units

#### Scenario: Orphaned releases retain their own data

- GIVEN releases "release-a" and "release-b" that were orphaned after their work was deleted
- WHEN querying "release-a" and "release-b"
- THEN all their own fields (type, status, visibility, translations, support languages) SHALL remain intact
- AND only `workUnitId` SHALL have changed to null
