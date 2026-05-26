## ADDED Requirements

### Requirement: UnitWork Defines Hidden Work Membership

The system SHALL introduce `UnitWork` as the canonical relationship that links
a visible Unit to a hidden work Unit. The visible member Unit SHALL remain the
normal user-facing catalog target. The hidden work Unit SHALL provide grouping,
inherited discovery metadata, shared community aggregation, and language-default
resolution.

`UnitWork` rows SHALL at minimum identify `unitId`, `workUnitId`, membership
`role`, optional `language`, `rank`, `displayPolicy`, and timestamps. A visible
release Unit SHALL belong to at most one hidden work Unit in v1.

#### Scenario: Release belongs to hidden work

- **WHEN** release Unit `release-a` is linked to hidden work Unit `work-x`
- **THEN** a `UnitWork(unitId = release-a, workUnitId = work-x)` row SHALL exist
- **AND** `release-a` SHALL remain the visible catalog page target
- **AND** `work-x` SHALL be used for grouping and inherited discovery metadata

#### Scenario: Duplicate work membership rejected

- **WHEN** a caller attempts to attach the same release Unit to two different work Units
- **THEN** the system SHALL reject the second active `UnitWork` membership in v1
- **AND** the release SHALL continue to resolve to exactly one work domain

### Requirement: Hidden Work Units Are Not Ordinary Release Pages

Hidden work Units SHALL NOT be treated as ordinary public release detail pages
for release-aware domains. Public navigation, search result rendering, shelf
item rendering, and reading flows SHALL prefer visible member Units from
`UnitWork`. Hidden work Units MAY have admin/editor surfaces and MAY provide
work-level tags, aliases, attribution, and metadata used by members.

#### Scenario: Public search does not render hidden work as normal book result

- **WHEN** a content search matches a hidden book work Unit through its tags or aliases
- **THEN** the public result SHALL render a visible `UnitWork` member release instead of the hidden work Unit
- **AND** the hidden work Unit MAY be used as the result's grouping key

#### Scenario: Admin can still inspect hidden work

- **WHEN** an authorized editor opens a work-domain maintenance surface
- **THEN** the system MAY display the hidden work Unit and its `UnitWork` members
- **AND** that surface SHALL be distinct from ordinary release reading/detail flows

### Requirement: UnitWork Language Defaults

The system SHALL define work-language default rows that map
`(workUnitId, language)` to the primary visible Unit for that language. Language
defaults SHALL be used by release language switching and grouped search
presentation. The default target Unit MUST be an active `UnitWork` member of the
same `workUnitId`.

#### Scenario: Language default resolves primary release

- **GIVEN** `UnitWork(release-ja, work-x)` and `UnitWork(release-zh, work-x)` exist
- **AND** `UnitWorkLanguageDefault(work-x, zh-hant) = release-zh`
- **WHEN** the user switches the current release to `zh-hant`
- **THEN** the system SHALL resolve `release-zh` as the primary release for that language

#### Scenario: Default outside work rejected

- **WHEN** a caller attempts to set `UnitWorkLanguageDefault(work-x, en) = release-y`
- **AND** `release-y` is not an active `UnitWork` member of `work-x`
- **THEN** the system SHALL reject the write

### Requirement: UnitWork Drives Work-Domain Interaction Targeting

The system SHALL use `UnitWork` to derive work-domain interaction targets.
When a user creates release-specific content that participates in work-domain
community aggregation, the system SHALL derive `targetWorkUnitId` from the
target release's active `UnitWork` membership. The precise target SHALL remain
the visible release Unit.

#### Scenario: Review targets release and aggregates to work

- **GIVEN** `UnitWork(release-a, work-x)` exists
- **WHEN** a user creates a review whose precise target is `release-a`
- **THEN** the review SHALL store or project `targetUnitId = release-a`
- **AND** the review SHALL store or project `targetWorkUnitId = work-x`

#### Scenario: Standalone target has no work domain

- **WHEN** a user creates a post targeting Unit `unit-y` with no active `UnitWork` membership
- **THEN** the post SHALL keep `targetUnitId = unit-y`
- **AND** `targetWorkUnitId` SHALL be null unless another explicit work-domain rule applies

### Requirement: UnitWork Search Repair Is Asynchronous And Bounded

Work-domain search projection changes SHALL be processed through CDC/outbox and
job-runner batch handlers. User-facing mutations that change work tags,
`UnitWork` membership, work aliases, or language defaults SHALL enqueue repair
work and SHALL NOT synchronously rebuild every affected Meilisearch document in
the request path.

#### Scenario: Work tag update enqueues release fan-out

- **GIVEN** hidden work `work-x` has 120 active member releases
- **WHEN** a tag is added to `work-x`
- **THEN** the mutation SHALL enqueue a search projection rebuild for members of `work-x`
- **AND** the request SHALL NOT block on rebuilding all 120 Meilisearch documents

#### Scenario: Release membership change rebuilds one release

- **WHEN** `UnitWork(release-a, work-x)` is inserted or updated
- **THEN** the system SHALL enqueue a rebuild for `release-a`'s search document
- **AND** grouped search metadata for `work-x` SHALL be refreshed by the same job family

#### Scenario: Large work domains are processed in batches

- **WHEN** a work-domain repair job finds more member releases than one batch can process
- **THEN** the job SHALL process members in deterministic pages
- **AND** the job SHALL be resumable and idempotent

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
current canonical work domain. If a Unit belongs to a work, the field SHALL be
the merge-resolved work Unit id. If a Unit has no work domain, the field SHALL
be `null`. The field SHALL NOT be stored in the database.

#### Scenario: Release returns work USWN

- **GIVEN** `UnitWork(release-a, work-x)` exists
- **WHEN** the server returns a library DTO for `release-a`
- **THEN** `metadata.uswn` SHALL equal `work-x`

#### Scenario: No work returns null USWN

- **GIVEN** Unit `unit-y` has no work domain
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

- **GIVEN** source work `work-old` has many releases, posts, reviews, or search
  projections
- **WHEN** an admin starts a merge into `work-new`
- **THEN** the request SHALL create or update a durable merge operation and
  enqueue the required migration/repair jobs
- **AND** the request SHALL NOT synchronously rewrite every affected projection
  before returning

### Requirement: Work Metadata Copy Is Optional And Independent

Admins MAY copy missing metadata from a source work to a target work as an
explicit operation independent from canonical work merge. In v1, metadata copy
SHALL support work tags and aliases. The operation SHALL only create target rows
that do not already exist, SHALL leave source rows unchanged, and SHALL support
dry-run preview and revert for rows it creates.

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
