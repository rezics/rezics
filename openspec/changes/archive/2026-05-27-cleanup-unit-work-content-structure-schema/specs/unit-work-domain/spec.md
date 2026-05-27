## MODIFIED Requirements

### Requirement: UnitWork Defines Unit-Based Work-Domain Membership

The system SHALL use `UnitWork` as the canonical Unit-based relationship that
links any work-domain-participating Unit to a hidden work Unit. Visible release
Units SHALL remain the normal user-facing catalog targets. Hidden work Units
SHALL provide grouping, inherited discovery metadata, shared community
aggregation, and work-domain content membership.

`UnitWork` rows SHALL at minimum identify `unitId`, `workUnitId`, membership
`role`, optional `language`, optional fractional-index `position`,
`displayPolicy`, and timestamps.

For `role = RELEASE`, a visible release Unit SHALL belong to at most one
canonical hidden work Unit in v1. For content roles such as `POST`, `REVIEW`,
`SHELF`, `WIKI`, or `GUIDE`, the same Unit MAY belong to multiple work domains
when its precise targets or contained Units span multiple works.

The system SHALL NOT read or write legacy `Unit.workUnitId` as a runtime source
of membership after this cutover. Search, DTO mapping, creation flows, admin
merge, and repair jobs SHALL resolve work-domain membership through `UnitWork`.

#### Scenario: Release belongs to hidden work

- **WHEN** release Unit `release-a` is linked to hidden work Unit `work-x`
- **THEN** a `UnitWork(unitId = release-a, workUnitId = work-x, role = RELEASE)` row SHALL exist
- **AND** `release-a` SHALL remain the visible catalog page target
- **AND** `work-x` SHALL be used for grouping and inherited discovery metadata

#### Scenario: Duplicate release work membership rejected

- **WHEN** a caller attempts to attach the same release Unit to two different work Units
- **THEN** the system SHALL reject the second active `role = RELEASE` `UnitWork` membership in v1
- **AND** the release SHALL continue to resolve to exactly one work domain

#### Scenario: Content belongs to multiple work domains

- **GIVEN** post Unit `post-p` is published under release contexts from `work-a`
  and `work-b`
- **WHEN** work-domain membership is registered
- **THEN** `UnitWork(post-p, work-a, role = POST)` SHALL exist
- **AND** `UnitWork(post-p, work-b, role = POST)` SHALL also exist
- **AND** this SHALL NOT violate the release-only uniqueness invariant

#### Scenario: Legacy workUnitId is not used after cutover

- **GIVEN** release Unit `release-a` has `UnitWork(release-a, work-x, role = RELEASE)`
- **WHEN** search documents, library DTOs, release lists, or content creation flows resolve its work domain
- **THEN** they SHALL read `work-x` from `UnitWork`
- **AND** they SHALL NOT fall back to a `Unit.workUnitId` column

### Requirement: Library Metadata USWN Resolves From Canonical Work

For library content DTOs, the server SHALL derive `metadata.uswn` from the
current canonical work domain. If a release Unit belongs to a work, the field
SHALL be the merge-resolved `UnitWork(role = RELEASE).workUnitId`. If a Unit has
no release work domain, the field SHALL be `null`. The field SHALL NOT be stored
in the database.

#### Scenario: Release returns work USWN

- **GIVEN** `UnitWork(release-a, work-x, role = RELEASE)` exists
- **WHEN** the server returns a library DTO for `release-a`
- **THEN** `metadata.uswn` SHALL equal `work-x`

#### Scenario: No work returns null USWN

- **GIVEN** Unit `unit-y` has no release work domain
- **WHEN** the server returns a library DTO for `unit-y`
- **THEN** `metadata.uswn` SHALL be `null`

#### Scenario: Legacy workUnitId does not determine USWN

- **WHEN** the server maps a library DTO after the cutover
- **THEN** `metadata.uswn` SHALL be computed from `UnitWork`
- **AND** the mapper SHALL NOT read a legacy `Unit.workUnitId` fallback

## ADDED Requirements

### Requirement: UnitWork Cutover Removes Legacy Drift Surface

The system SHALL remove runtime drift diagnostics and synchronization code that
exist only to compare `Unit.workUnitId` with `UnitWork`. Before removing those
surfaces, migrations or verification scripts SHALL prove that release
membership has been backfilled into `UnitWork`.

#### Scenario: Backfill parity is required before drop

- **WHEN** the migration removes legacy work-link storage
- **THEN** it SHALL verify that every release previously linked to a work has an
  equivalent `UnitWork(role = RELEASE)` row
- **AND** the migration SHALL fail or report a blocking error if parity is not met

#### Scenario: Drift endpoint removed after cutover

- **WHEN** the cutover is complete
- **THEN** diagnostic APIs that list `Unit.workUnitId` versus `UnitWork` drift
  SHALL be removed
- **AND** new diagnostics SHALL inspect `UnitWork` consistency directly
