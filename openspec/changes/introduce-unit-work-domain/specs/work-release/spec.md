## ADDED Requirements

### Requirement: Work/Release Semantics Are Release-First

For release-aware domains, the system SHALL treat visible releases as the normal
user-facing catalog and interaction targets. Hidden work Units SHALL provide
grouping and inherited semantics through `UnitWork`; they SHALL NOT be the
ordinary book detail or reading destination.

#### Scenario: User opens release page

- **WHEN** a user opens a book release Unit
- **THEN** the page SHALL render release-specific metadata and content controls
- **AND** the page MAY show work-domain tags and community content inherited through `UnitWork`

#### Scenario: Work unit is not the default reading page

- **WHEN** a user-facing route receives a hidden work Unit id for a release-aware book
- **THEN** the route SHALL resolve an appropriate visible release or render a work-domain maintenance/selection surface
- **AND** it SHALL NOT pretend that the hidden work Unit itself has release content

### Requirement: UnitWork Supersedes Direct Work-Link Semantics

The existing direct work-link behavior SHALL be migrated so that `UnitWork` is
the canonical membership model. `Unit.workUnitId` MAY remain as a denormalized
shortcut during migration, but work/release queries and new features SHALL
resolve membership through `UnitWork`.

#### Scenario: Existing work link is backfilled

- **GIVEN** release Unit `release-a` currently has `workUnitId = work-x`
- **WHEN** the migration/backfill runs
- **THEN** `UnitWork(unitId = release-a, workUnitId = work-x)` SHALL be created
- **AND** repeated backfill runs SHALL NOT create duplicate membership rows

#### Scenario: Work query reads UnitWork

- **WHEN** the system lists releases for hidden work Unit `work-x`
- **THEN** it SHALL read active `UnitWork` rows for `work-x`
- **AND** it SHALL include rank, role, display policy, and language metadata from `UnitWork`

### Requirement: Release Nesting Remains Forbidden For Work Membership

`UnitWork.workUnitId` SHALL reference a hidden work Unit, not another visible
release member. A release SHALL NOT become the work domain for another release
through `UnitWork`.

#### Scenario: UnitWork points to visible member rejected

- **GIVEN** `UnitWork(unitId = release-a, workUnitId = work-x)` exists
- **WHEN** a caller attempts to create `UnitWork(unitId = release-b, workUnitId = release-a)`
- **THEN** the system SHALL reject the membership because `release-a` is a visible member, not a hidden work Unit

### Requirement: Work Creation Is Release-Led For Ordinary Users

For release-aware domains, ordinary creation flows SHALL create visible release
Units and attach them to work domains. They SHALL NOT treat hidden work Units as
ordinary content users create directly. A new work domain MAY be created as part
of creating the first visible release for a work.

#### Scenario: First release creates hidden work domain

- **WHEN** a user confirms they are adding the first release/original version of
  a work
- **THEN** the system MAY create a hidden work Unit for grouping
- **AND** it SHALL also create or attach the visible release Unit in the same
  release-led flow

#### Scenario: Translation attaches to existing work

- **GIVEN** an existing release belongs to work `work-x`
- **WHEN** a user creates a translation release and selects that existing
  release as the match
- **THEN** the new translation release SHALL be attached to `work-x`
- **AND** the flow SHALL NOT create a separate standalone work for the
  translation

### Requirement: Admin Work Merge Canonicalizes Releases Without Deleting Source Work

Admin work merge SHALL canonicalize source-work releases under a target work
without deleting the source work Unit. The operation SHALL preserve source-work
non-membership metadata by default and SHALL update canonical work resolution so
release pages, search grouping, language defaults, and library DTO metadata use
the target work after merge completion.

#### Scenario: Source work redirects to target for public resolution

- **GIVEN** source work `work-old` has been merged into target work `work-new`
- **WHEN** public or library DTO resolution encounters `work-old`
- **THEN** it SHALL resolve the canonical work as `work-new`
- **AND** it SHALL not expose `work-old` as the current work for ordinary
  release display
