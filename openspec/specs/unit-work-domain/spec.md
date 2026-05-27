# unit-work-domain Specification

## Purpose

Defines `UnitWork`, the canonical Unit-based relationship that links any work-domain-participating Unit to a hidden work Unit. Visible release Units remain the normal user-facing catalog targets, while hidden work Units provide grouping, inherited discovery metadata, shared community aggregation, and work-domain content membership. This capability also governs release-led creation, hidden-work admin operations, async search repair, release-move/work-merge recalculation, work-merge canonicalization, optional metadata copy, and derived USWN library metadata.

## Requirements

### Requirement: UnitWork Defines Unit-Based Work-Domain Membership

The system SHALL introduce `UnitWork` as the canonical Unit-based relationship that links any work-domain-participating Unit to a hidden work Unit. Visible release Units SHALL remain the normal user-facing catalog targets. Hidden work Units SHALL provide grouping, inherited discovery metadata, shared community aggregation, and work-domain content membership.

`UnitWork` rows SHALL at minimum identify `unitId`, `workUnitId`, membership
`role`, optional `language`, optional fractional-index `position`,
`displayPolicy`, and timestamps.

For `role = RELEASE`, a visible release Unit SHALL belong to at most one
canonical hidden work Unit in v1. For content roles such as `POST`, `REVIEW`,
`SHELF`, `WIKI`, or `GUIDE`, the same Unit MAY belong to multiple work domains
when its precise targets or contained Units span multiple works.

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

### Requirement: Hidden Work Units Are Not Ordinary Release Pages

Hidden work Units SHALL NOT be treated as ordinary public release detail pages
for release-aware domains. Public navigation, search result rendering, shelf
item rendering, and reading flows SHALL prefer visible member Units from
`UnitWork`. Hidden work Units MAY have admin/editor surfaces and MAY provide
work-level tags, aliases, attribution, and metadata used by members.

#### Scenario: Public search does not render hidden work as normal book result

- **WHEN** a content search matches a hidden book work Unit through its tags or aliases
- **THEN** the public result SHALL render a visible `role = RELEASE` `UnitWork`
  member instead of the hidden work Unit
- **AND** the hidden work Unit MAY be used as the result's grouping key

#### Scenario: Admin can still inspect hidden work

- **WHEN** an authorized editor opens a work-domain maintenance surface
- **THEN** the system MAY display the hidden work Unit and its `UnitWork` members
- **AND** that surface SHALL be distinct from ordinary release reading/detail flows

### Requirement: UnitWork Drives Work-Domain Content Membership

The system SHALL register work-domain content through `UnitWork`. When a user
creates or attaches content that participates in work-domain aggregation, the
system SHALL derive one or more `UnitWork` memberships from the content's
precise target Units or contained Units. The precise target SHALL remain on the
feature-specific field such as `Post.targetUnitId`.

#### Scenario: Review targets release and enters work domain

- **GIVEN** `UnitWork(release-a, work-x, role = RELEASE)` exists
- **WHEN** a user creates a review whose precise target is `release-a`
- **THEN** the review SHALL store or project `targetUnitId = release-a`
- **AND** the review Unit SHALL have `UnitWork(reviewUnitId, work-x, role = REVIEW)`

#### Scenario: Standalone target has no work domain

- **WHEN** a user creates a post targeting Unit `unit-y` with no active `UnitWork` membership
- **THEN** the post SHALL keep `targetUnitId = unit-y`
- **AND** the post SHALL NOT receive a work-domain `UnitWork` row unless another
  explicit work-domain rule applies

#### Scenario: Work-domain feed queries UnitWork

- **GIVEN** releases `release-a` and `release-b` both have `role = RELEASE`
  membership in `work-x`
- **AND** `post-p` has `UnitWork(post-p, work-x, role = POST)`
- **WHEN** a user opens the default community tab on `release-b`
- **THEN** the feed SHALL query content registered under `work-x`
- **AND** it SHALL include `post-p` without querying `release-a` directly

#### Scenario: Feed card renders precise target release

- **GIVEN** the current page is `release-b`
- **AND** feed item `post-p` has `targetUnitId = release-a`
- **WHEN** the card renders in the work-domain feed
- **THEN** it SHALL display identifying metadata for `release-a`
- **AND** it SHALL NOT imply that `post-p` precisely targets `release-b`

### Requirement: UnitWork Search Repair Is Asynchronous And Bounded

Work-domain search projection changes SHALL be processed through CDC/outbox and
job-runner batch handlers. User-facing mutations that change work tags,
`UnitWork` membership, or work aliases SHALL enqueue repair work when needed and
SHALL NOT synchronously rebuild every affected Meilisearch document in the
request path.

#### Scenario: Work tag update enqueues release fan-out

- **GIVEN** hidden work `work-x` has 120 active member releases
- **WHEN** a tag is added to `work-x`
- **THEN** the mutation SHALL enqueue a search projection rebuild for release
  members of `work-x`
- **AND** the request SHALL NOT block on rebuilding all 120 Meilisearch documents

#### Scenario: Membership change rebuilds affected unit

- **WHEN** `UnitWork(release-a, work-x, role = RELEASE)` is inserted or updated
- **THEN** the system SHALL enqueue a rebuild for `release-a`'s search document
- **AND** grouped search metadata for `work-x` SHALL be refreshed by the same job family

#### Scenario: Large work domains are processed in batches

- **WHEN** a work-domain repair job finds more member Units than one batch can process
- **THEN** the job SHALL process members in deterministic pages
- **AND** the job SHALL be resumable and idempotent

### Requirement: Release Move And Work Merge Recalculate Work Membership

Release move and work merge operations SHALL be treated as high-risk admin
operations because they can invalidate historical work-domain memberships for
posts, reviews, shelves, and other content derived from affected releases. These
operations SHALL run through previewable, durable, resumable repair flows that
recalculate affected `UnitWork` memberships.

#### Scenario: Release move repairs derived content membership

- **GIVEN** `release-a` moves from `work-old` to `work-new`
- **AND** post `post-p` targets `release-a`
- **WHEN** release-move repair completes
- **THEN** `post-p` SHALL no longer be registered under `work-old` solely because
  of `release-a`
- **AND** `UnitWork(post-p, work-new, role = POST)` SHALL exist
- **AND** `post-p.targetUnitId` SHALL remain `release-a`

#### Scenario: Shelf membership is recalculated rather than blindly removed

- **GIVEN** shelf `shelf-s` contains `release-a` and `release-b`
- **AND** both releases belonged to `work-old`
- **WHEN** `release-a` moves to `work-new`
- **THEN** repair SHALL keep `UnitWork(shelf-s, work-old, role = SHELF)` if
  `release-b` still belongs to `work-old`
- **AND** repair SHALL add `UnitWork(shelf-s, work-new, role = SHELF)` for
  `release-a`

### Requirement: Hidden Work Creation Is Admin-Only Outside Release-Led Flows

Ordinary user-facing creation flows SHALL NOT expose standalone hidden work
creation as a primary action. They SHALL create visible releases and resolve or
create work membership through the release-led creation flow. Authorized admin
maintenance surfaces MAY create hidden work Units directly for repair,
moderation, import cleanup, or merge preparation.

#### Scenario: Ordinary user cannot create standalone work

- **WHEN** an ordinary user creates a book from a public or personal creation
  page
- **THEN** the created user-facing Unit SHALL be a visible release
- **AND** standalone hidden work creation SHALL NOT be offered as the ordinary
  path

#### Scenario: Admin creates work for repair

- **WHEN** an authorized admin creates a hidden work through a maintenance
  surface
- **THEN** the system SHALL allow the work Unit to exist before releases are
  attached
- **AND** the work Unit SHALL remain distinct from ordinary release detail pages

### Requirement: Hidden Work Labels Come From Release Context

Hidden work Units SHALL NOT require user-facing titles for ordinary product
display. Public and creation UI SHALL derive work labels from the selected
primary release, release list context, aliases, or admin-only maintenance
metadata instead of asking ordinary users to author a separate work title.

#### Scenario: Work context displays release-derived label

- **GIVEN** work `work-x` has primary release `release-a`
- **WHEN** ordinary UI needs to label the work context
- **THEN** it SHALL prefer display text from `release-a` or the release list
  context
- **AND** it SHALL NOT require a separate public title stored on `work-x`

### Requirement: Library Metadata USWN Resolves From Canonical Work

For library content DTOs, the server SHALL derive `metadata.uswn` from the
current canonical work domain. If a release Unit belongs to a work, the field
SHALL be the merge-resolved work Unit id. If a Unit has no release work domain,
the field SHALL be `null`. The field SHALL NOT be stored in the database.

#### Scenario: Release returns work USWN

- **GIVEN** `UnitWork(release-a, work-x, role = RELEASE)` exists
- **WHEN** the server returns a library DTO for `release-a`
- **THEN** `metadata.uswn` SHALL equal `work-x`

#### Scenario: No work returns null USWN

- **GIVEN** Unit `unit-y` has no release work domain
- **WHEN** the server returns a library DTO for `unit-y`
- **THEN** `metadata.uswn` SHALL be `null`

### Requirement: Admin Work Merge Migrates Canonical Membership

The system SHALL provide an admin-only work merge operation that migrates
canonical release/content membership from a source hidden work to a target
hidden work. The source work Unit SHALL be preserved. Merge SHALL NOT
destructively delete source work metadata such as tags, aliases, external
references, attribution, or history.

For active work domains, merge SHALL run as a durable async operation with
dry-run preview, item-level progress, resumability, and enough before-state to
support revert.

#### Scenario: Merge moves release membership to target

- **GIVEN** releases `release-a` and `release-b` belong to source work
  `work-old`
- **WHEN** an admin merges `work-old` into target work `work-new`
- **THEN** canonical membership for `release-a` and `release-b` SHALL resolve to
  `work-new`
- **AND** source work `work-old` SHALL remain in the database
- **AND** ordinary DTOs for those releases SHALL expose
  `metadata.uswn = work-new`

#### Scenario: Source work metadata is preserved

- **GIVEN** source work `work-old` has tags and aliases
- **WHEN** `work-old` is merged into `work-new`
- **THEN** the merge SHALL NOT delete `work-old`'s tags or aliases
- **AND** copying those tags or aliases to `work-new` SHALL require a separate
  explicit metadata-copy operation

#### Scenario: Active work merge is queued

- **GIVEN** source work `work-old` has many releases, posts, reviews, shelves,
  or search projections
- **WHEN** an admin starts a merge into `work-new`
- **THEN** the request SHALL create or update a durable merge operation and
  enqueue the required migration/repair jobs
- **AND** the request SHALL NOT synchronously rewrite every affected projection
  before returning

### Requirement: Work Metadata Copy Is Optional And Independent

The system SHALL support optional metadata copy as an explicit operation
independent from canonical work merge. Admins MAY copy missing metadata from a
source work to a target work. In v1, metadata copy SHALL support work tags and
aliases. The operation SHALL only create target rows that do not already exist,
SHALL leave source rows unchanged, and SHALL support dry-run preview and revert
for rows it creates.

#### Scenario: Copy missing tags only

- **GIVEN** source work `work-old` has tags `tag-a` and `tag-b`
- **AND** target work `work-new` already has `tag-a`
- **WHEN** an admin runs metadata copy for tags from `work-old` to `work-new`
- **THEN** the operation SHALL create `tag-b` on `work-new`
- **AND** it SHALL NOT create a duplicate `tag-a`
- **AND** it SHALL NOT remove tags from `work-old`

#### Scenario: Metadata copy can run separately from merge

- **GIVEN** source work `work-old` has already been merged into `work-new`
- **WHEN** an admin later chooses to copy missing aliases
- **THEN** the alias copy operation SHALL be allowed without re-running
  canonical membership migration
