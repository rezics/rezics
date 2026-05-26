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
