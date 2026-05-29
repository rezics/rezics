# work-release Specification

## Purpose

Defines the work / release pattern for `{BOOK, GAME, MEDIA, POST}`
Unit types. A work is a hidden Unit with `workUnitId = null`;
visible releases live in `UnitWork(role = RELEASE)`. Owns the
type-match invariant between release and work, the release-first
catalog and reading destination, the migration from
`Unit.workUnitId` to `UnitWork` as canonical membership, the rule
that releases cannot be works for other releases, release-led
creation, admin merge that canonicalizes releases without
deleting the source work, and the release-granularity policy (the
reviewable-thing test and the rule that store/distribution SKUs do not
define release boundaries).

## Requirements

### Requirement: A work is a Unit with no parent and a type that supports the work/release pattern

A work Unit SHALL have `workUnitId = null` and a `type` from the set that supports the work/release pattern. The supported set SHALL be `{BOOK, GAME, MEDIA, POST}`. The work role is derived from this state — there is no explicit role enum.

#### Scenario: Create a work unit (BOOK)

- GIVEN an authenticated user
- WHEN the user creates a Unit with `type = BOOK` and `workUnitId = null`
- THEN the Unit SHALL be persisted as a work
- AND querying for works SHALL include this unit

#### Scenario: Create a work unit (POST)

- GIVEN an authenticated user
- WHEN the user creates a Unit with `type = POST` and `workUnitId = null`
- THEN the Unit SHALL be persisted as a standalone POST that MAY later become a work by having releases linked to it
- AND any subsequent Unit with `workUnitId` referencing this POST SHALL be accepted (subject to release-side type-match and authorization rules)

#### Scenario: Unsupported types cannot be works with releases

- GIVEN a Unit of a type that is not in `{BOOK, GAME, MEDIA, POST}` (e.g., `TAG` or `SHELF`)
- WHEN another Unit attempts to set `workUnitId` to this unit's id
- THEN the system SHALL reject the operation because that type does not support the work/release pattern

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

### Requirement: Standalone units are neither works nor releases

A standalone unit is a Unit with `workUnitId = null` that has no other units referencing it via `workUnitId`. Standalone units SHALL operate independently without work/release semantics. Any UnitType may exist as a standalone unit.

#### Scenario: Standalone POST unit

- GIVEN a Unit of type `POST` with `workUnitId = null`
- AND no other Unit has `workUnitId` pointing to this unit
- THEN this unit SHALL be treated as a standalone unit
- AND it SHALL not participate in work/release queries

#### Scenario: BOOK unit without releases is standalone

- GIVEN a Unit of type `BOOK` with `workUnitId = null`
- AND no other Unit has `workUnitId` pointing to this unit
- THEN this unit is structurally a standalone unit (it could become a work if releases are later added)

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
release pages, search grouping, work-domain content membership, and library DTO
metadata use the target work after merge completion.

#### Scenario: Source work redirects to target for public resolution

- **GIVEN** source work `work-old` has been merged into target work `work-new`
- **WHEN** public or library DTO resolution encounters `work-old`
- **THEN** it SHALL resolve the canonical work as `work-new`
- **AND** it SHALL not expose `work-old` as the current work for ordinary
  release display

### Requirement: Release Granularity Follows The Reviewable-Thing Test

A variation of a work SHALL be modeled as a distinct `role = RELEASE` Unit only
when a meaningful population of users would treat it as a separately
**reviewable, trackable, or shelvable** thing — that is, when users would write
distinct reviews for it, track separate progress/completion against it, or shelf
it as a distinct item. Variations that do not meet this test SHALL be
represented as release attributes (such as platform or edition label),
`UnitTranslation` records, or content-structure metadata, and SHALL NOT spawn a
separate release. The presence or absence of content differences SHALL be
treated as one signal feeding this test, not as the deciding criterion.

#### Scenario: Distinct experience warrants a release even without content differences

- **GIVEN** a platform version whose content is effectively identical to an
  existing release
- **AND** a distinct population of users reviews, rates, or tracks that version
  separately because its experience diverges materially
- **WHEN** the system decides how to represent it
- **THEN** it SHALL be eligible to become a separate `role = RELEASE` Unit
- **AND** the decision SHALL NOT be blocked by the absence of content
  differences

#### Scenario: Minor content difference does not warrant a release

- **GIVEN** a regional variant that omits a small amount of content
- **AND** users do not review, track, or shelf that variant as a distinct thing
- **WHEN** the system decides how to represent it
- **THEN** it SHALL be represented as a release attribute or note
- **AND** it SHALL NOT become a separate release solely because its content
  differs

### Requirement: Store And Distribution SKUs Do Not Define Release Boundaries

Release boundaries SHALL model a work's actual versions/editions, not the way a
storefront or distribution platform lists products. The count of store
listings, application IDs, or per-platform SKUs SHALL NOT by itself create or
merge releases.

#### Scenario: Two store listings of one edition remain one release

- **GIVEN** a storefront lists the same edition as two platform-specific
  products
- **WHEN** the work is cataloged
- **THEN** the system SHALL represent one release carrying multiple platform
  attributes
- **AND** it SHALL NOT create two releases solely because two listings exist

#### Scenario: Two listings that are different editions are two releases

- **GIVEN** a storefront lists a "Legacy" edition and an "Enhanced" edition as
  separate products
- **WHEN** the work is cataloged
- **THEN** they SHALL be two releases because they are different editions
- **AND** the decision SHALL follow the edition difference, not the fact that
  the storefront lists them separately
