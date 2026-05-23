# content-authority Specification

## Purpose

Defines Unit ownership, the seeded `rezics` and `rezics-wiki` infra users, Unit collaborators, sparse field locks (path-based, sharing the editorial PATCH path vocabulary), and the runtime gate that admits or rejects collaborative Unit edits. `Unit.userId` remains the primary owner/custodian; `UnitCollaborator` rows grant delegated authority; and `UnitFieldLock` rows are the runtime source of truth for which paths are blocked from community edits. Edit admission considers actor permission, primary owner, collaborators, endpoint surface policy, and lock rows — never `UnitType` or owner identity alone.

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

The system SHALL store protected Unit fields in a sparse `UnitFieldLock` table. Each row SHALL carry a `path` column that holds a free-form JSON path string describing the protected area. A row with `path = "*"` SHALL lock the entire Unit against community edits within the editorial regime. `path` SHALL NOT be constrained to a closed enum; it is the same path vocabulary used by editorial PATCH submissions.

Lock comparison SHALL use bidirectional prefix matching with path-boundary semantics, as defined in `editorial-patch-protocol`. A PATCH leaf path `P` is blocked by a lock path `L` if and only if `P == L`, `P.startsWith(L + ".")`, or `L.startsWith(P + ".")`.

Lock paths SHALL NOT intersect `EXTERNALLY_GOVERNED_PATHS`. Attempts to create such locks SHALL be rejected at the lock creation API.

#### Scenario: Field lock blocks editorial PATCH on the same path

- **WHEN** Unit A has a `UnitFieldLock` row for `path = "translations.en.title"`
- **AND** a community editor submits PATCH `{ translations: { en: { title: "..." } } }`
- **THEN** the edit SHALL be rejected with a 403-style authority error
- **AND** the error body SHALL identify both the lock path and the offending PATCH path

#### Scenario: Field lock blocks PATCH whose sub-tree covers the lock

- **WHEN** Unit A has a `UnitFieldLock` row for `path = "credits.authors"`
- **AND** a community editor submits PATCH `{ credits: { authors: [...], translators: [...] } }`
- **THEN** the edit SHALL be rejected because the PATCH sub-tree contains the locked path

#### Scenario: Field lock blocks PATCH that lies inside the locked sub-tree

- **WHEN** Unit A has a `UnitFieldLock` row for `path = "credits"`
- **AND** a community editor submits PATCH `{ credits: { translators: [...] } }`
- **THEN** the edit SHALL be rejected because the PATCH path lies inside the locked path

#### Scenario: Whole-object lock blocks every editorial PATCH

- **WHEN** Unit A has a `UnitFieldLock` row for `path = "*"`
- **AND** a community editor attempts an editorial PATCH targeting any non-externally-governed path
- **THEN** the edit SHALL be rejected with a 403-style authority error

#### Scenario: Disjoint PATCH and lock are not blocked

- **WHEN** Unit A has a `UnitFieldLock` row for `path = "credits.authors"`
- **AND** a community editor submits PATCH `{ credits: { translators: [...] } }`
- **THEN** the lock layer SHALL NOT block the edit

#### Scenario: Lock on externally-governed path is rejected at creation

- **WHEN** an operator attempts to create a `UnitFieldLock` row for `path = "tags"` or `path = "realmTagApplications.foo"`
- **THEN** the lock creation API SHALL reject the request
- **AND** the error SHALL explain that the path is externally governed and is not subject to editorial locks

### Requirement: Runtime authority gate

The system SHALL determine collaborative edit admission from actor permission, primary owner, Unit collaborators, endpoint surface policy, and `UnitFieldLock` rows. The system SHALL NOT grant community edit authority merely because a Unit has a wiki-eligible type or because `Unit.userId` equals the seeded `rezics-wiki` User's `unitId`. The authority gate SHALL operate on the submitted PATCH leaf paths and the stored `UnitFieldLock.path` values; it SHALL NOT consult a separate field-key enum.

#### Scenario: Type alone does not grant community edit

- **WHEN** a BOOK Unit is personal-owned by user A
- **AND** user B is not owner, collaborator, ROOT, or ADMIN
- **THEN** user B SHALL NOT be allowed to edit the Unit merely because the Unit type is BOOK

#### Scenario: Rezics-wiki ownership alone does not bypass locks

- **WHEN** a Unit's `userId` equals the seeded `rezics-wiki` User's `unitId`
- **AND** the submitted PATCH intersects a `UnitFieldLock` row
- **THEN** a community editor SHALL NOT be allowed to commit that PATCH

#### Scenario: Admin override

- **WHEN** a ROOT or ADMIN actor submits a PATCH that intersects a `UnitFieldLock` row
- **THEN** the system SHALL allow the PATCH
- **AND** the action SHALL be recorded as an override in history or audit metadata

#### Scenario: Externally-governed paths bypass the editorial gate

- **WHEN** a tag PATCH is submitted through the dedicated tag governance API
- **THEN** the editorial authority gate SHALL NOT run
- **AND** the tag governance system SHALL apply its own admission rules

### Requirement: Non-collaborative surfaces skip lock lookup
The system SHALL reject community edits to non-collaborative surfaces before querying `UnitFieldLock`. Ordinary post/review/remark/reply update endpoints SHALL remain author/owner-controlled and SHALL NOT run the community field-lock admission path.

#### Scenario: Ordinary post update rejects non-author
- **WHEN** user B attempts to update an ordinary post authored by user A
- **THEN** the post update endpoint SHALL reject user B by post permission rules
- **AND** it SHALL NOT need to query `UnitFieldLock`

### Requirement: Lock and collaborator mutation authority

The system SHALL restrict lock and collaborator management to the primary owner, sufficiently privileged collaborators, or ROOT/ADMIN actors. Lock creation requests SHALL include a `path` string; the API SHALL reject requests whose `path` intersects `EXTERNALLY_GOVERNED_PATHS`.

#### Scenario: Owner creates field lock with a path

- **WHEN** a Unit primary owner creates a `UnitFieldLock` row with `path = "translations.en.title"` for the Unit
- **THEN** the system SHALL accept the lock change
- **AND** the lock change SHALL be recorded for history/audit

#### Scenario: Community editor cannot manage locks

- **WHEN** a community editor has no owner or lock-management collaborator role
- **THEN** attempts to add or remove a `UnitFieldLock` row SHALL be rejected

#### Scenario: Lock creation rejects externally-governed paths

- **WHEN** any actor (including ADMIN) attempts to create a `UnitFieldLock` row whose `path` intersects `EXTERNALLY_GOVERNED_PATHS`
- **THEN** the lock creation API SHALL reject the request
- **AND** the error SHALL name the offending path and explain that it is externally governed

### Requirement: Public history visibility follows Unit visibility

History visibility SHALL follow the current Unit visibility gate. A viewer who can access the current Unit MAY access its public history metadata; a viewer who cannot access the Unit SHALL NOT access its history timeline, revision detail, or compare view.

#### Scenario: Public Unit history is visible

- **WHEN** a viewer can access a public Unit
- **THEN** the viewer SHALL be able to request the Unit's revision timeline metadata

#### Scenario: Private Unit history is hidden from non-owner

- **WHEN** a viewer cannot access a private Unit
- **THEN** history requests for that Unit SHALL be rejected or hidden consistently with the Unit resolver visibility rules

### Requirement: Raw history payload visibility is privileged

Raw revision content and raw structure-event payloads SHALL be visible only to actors with maintainer, owner, admin, or an explicit history-debug permission. Public viewers SHALL receive product-safe display data, not raw JSON payloads.

#### Scenario: Public viewer cannot inspect raw payload

- **WHEN** a public viewer opens a revision detail
- **THEN** the UI SHALL NOT expose raw JSON payload controls
- **AND** API responses SHALL NOT require raw payload visibility for basic timeline display

#### Scenario: Admin can inspect raw payload

- **WHEN** an admin opens a revision detail
- **THEN** the UI MAY expose a raw payload panel
- **AND** the API SHALL allow the raw payload when the admin is authorized

### Requirement: Restore obeys normal edit authority

Editorial restore SHALL be executed as a normal editorial PATCH with optional descriptive restore metadata and SHALL obey the same owner, collaborator, admin, and field-lock authority rules as any other PATCH. Restore metadata SHALL NOT authorize writes, bypass locks, or instruct the server to fetch/apply a historical revision. Restore SHALL create a new history revision rather than modifying or deleting prior revisions.

#### Scenario: Locked path blocks restore

- **WHEN** a non-admin actor submits a restore PATCH whose submitted paths intersect a current `UnitFieldLock` path
- **THEN** the restore SHALL be rejected by the normal editorial PATCH authority gate
- **AND** no new revision SHALL be created for the failed restore

#### Scenario: Restore metadata is audited

- **WHEN** an actor submits a PATCH with restore metadata identifying a source revision and restored paths
- **THEN** the resulting revision SHALL record the actor, submitted PATCH, message, source revision, and restored paths
- **AND** any submitted paths not listed in restore metadata SHALL be treated as ordinary same-save edits

### Requirement: Restore source metadata

When a revision is restored, the resulting save SHALL include product metadata indicating the source revision sequence so the timeline can display that the new revision was restored from an earlier version.

#### Scenario: Restore message references source sequence

- **WHEN** a maintainer saves content restored from revision `12`
- **THEN** the resulting history entry SHALL allow the UI to display that it was restored from revision `12`
- **AND** the source revision SHALL remain unchanged
