## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Field-key vocabulary (the closed `UnitFieldKey` enum)

**Reason:** Replaced by free-form JSON path strings shared with the editorial PATCH protocol. Field-key constants (`UnitCommonFieldKey`, `BookFieldKey`, `EntityFieldKey`, `GameFieldKey`, `MediaFieldKey`, `AttributionFieldKey`, `WikiPostFieldKey`) and `UNIT_FIELD_KEYS` are removed from `@rezics/contract`. Lock paths are now whatever PATCH paths the API submits.

**Migration:** Existing `UnitFieldLock` rows are mapped to path strings by a hand-curated migration script (see this change's `tasks.md` 3.3 and `design.md` Migration Plan). Tags-related lock rows are dropped because `tags` is now externally governed; operators are notified by log.
