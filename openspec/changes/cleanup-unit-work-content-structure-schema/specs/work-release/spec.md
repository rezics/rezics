## MODIFIED Requirements

### Requirement: UnitWork Supersedes Direct Work-Link Semantics

The existing direct work-link behavior SHALL be migrated so that `UnitWork` is
the canonical membership model. Work/release queries, search projection,
creation flows, admin merge, DTO mapping, and new features SHALL resolve
membership through `UnitWork`. The system SHALL NOT retain `Unit.workUnitId` as
a runtime shortcut after this cutover.

Any surviving user-facing approval flow for attaching a release to a hidden work
Unit SHALL be expressed as a `UnitWork` membership claim flow. Approval SHALL
create or update `UnitWork(role = RELEASE)`; rejection or withdrawal SHALL NOT
write legacy direct-link fields.

#### Scenario: Existing work link is backfilled

- **GIVEN** release Unit `release-a` currently has legacy work membership
  pointing at `work-x`
- **WHEN** the migration/backfill runs
- **THEN** `UnitWork(unitId = release-a, workUnitId = work-x, role = RELEASE)` SHALL be created
- **AND** repeated backfill runs SHALL NOT create duplicate membership rows

#### Scenario: Work query reads UnitWork

- **WHEN** the system lists releases for hidden work Unit `work-x`
- **THEN** it SHALL read active `UnitWork` rows for `work-x`
- **AND** it SHALL include `position`, role, display policy, and language metadata from `UnitWork`
- **AND** it SHALL NOT read a `Unit.workUnitId` fallback

#### Scenario: Membership claim approval writes UnitWork

- **WHEN** an authorized actor approves a release-to-work membership claim
- **THEN** the system SHALL create or update
  `UnitWork(unitId = release-a, workUnitId = work-x, role = RELEASE)`
- **AND** it SHALL NOT set a legacy `Unit.workUnitId` field

## REMOVED Requirements

### Requirement: A release is a Unit with workUnitId set to its parent work

**Reason**: `UnitWork(role = RELEASE)` is the canonical release-to-work
membership model and carries required metadata that `Unit.workUnitId` cannot
represent.

**Migration**: Backfill equivalent `UnitWork` rows for every legacy direct work
link, update all call sites to query `UnitWork`, then drop `Unit.workUnitId`.

### Requirement: workUnitId MUST reference an existing unit that is itself a work

**Reason**: The invariant now applies to `UnitWork.workUnitId`, not a column on
`Unit`.

**Migration**: Enforce hidden-work validation in `UnitWork` membership writes
and remove validation paths tied to `Unit.workUnitId`.

### Requirement: Releases for a work are discovered by querying workUnitId

**Reason**: Release discovery must use `UnitWork(workUnitId, role = RELEASE)` so
it can include membership metadata and avoid legacy drift.

**Migration**: Replace release-list queries with `UnitWork` joins or relation
includes ordered by membership position and creation metadata.

### Requirement: Deleting a work sets releases' workUnitId to null via onDelete SetNull

**Reason**: Work membership cleanup is owned by `UnitWork` foreign keys and
repair flows after the direct column is removed.

**Migration**: Use `UnitWork` cascade/delete semantics and explicit repair jobs
for derived content memberships when hidden work Units are deleted or merged.

### Requirement: PATCH /units/:releaseId/work-link sets or clears workUnitId

**Reason**: Public mutation semantics must no longer describe direct
`workUnitId` writes.

**Migration**: Replace or rename the endpoint as a `UnitWork` membership
mutation/claim endpoint. Any temporary route alias SHALL delegate to the new
service and SHALL NOT write `Unit.workUnitId`.

### Requirement: work-link authorization requires release-side authority

**Reason**: The direct work-link operation is removed. Authorization belongs to
the replacement `UnitWork` membership mutation or claim flow.

**Migration**: Carry the release-side authority rule into the replacement
membership flow tests.

### Requirement: work-link grants immediate set when caller has work-side authority

**Reason**: The direct work-link operation is removed. Immediate approval, when
allowed, should create `UnitWork(role = RELEASE)`.

**Migration**: Carry the work-side authority short-circuit into the replacement
membership flow.

### Requirement: work-link grants immediate set when target work type is in WIKI_TYPES

**Reason**: The direct work-link operation is removed. Any wiki-specific
short-circuit must be expressed in the replacement `UnitWork` membership flow.

**Migration**: Revalidate whether this exception is still required, then port it
to the replacement membership flow or remove it with tests.

### Requirement: work-link defers to a claim when neither short-circuit applies

**Reason**: The direct work-link operation is removed. Deferred approval should
use `UnitWork` membership claim naming and semantics.

**Migration**: Rename work-link claims to work membership claims and make claim
approval create `UnitWork(role = RELEASE)`.

### Requirement: work-link clear cascades pending claims to WITHDRAWN

**Reason**: The direct work-link operation is removed. Clearing membership now
means deleting or replacing a `UnitWork(role = RELEASE)` row.

**Migration**: Port pending-claim withdrawal behavior to the replacement
membership clear operation.
