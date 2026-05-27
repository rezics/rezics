# seed-factory-scenarios Specification

## Purpose
Defines the factory seed flow extensions that produce named edge-case fixtures, expose Meilisearch lifecycle control, and emit stable special target output. Special factory scenarios run after the base preset to seed large post trees, large content trees, deep history timelines, and complex shelves. Targeted Meilisearch synchronization is driven by seed runtime hooks, while special scenario output is maintained as a separate report list.

## Requirements

### Requirement: Factory flow supports Meili mode selection
The factory seed flow SHALL expose a Meili mode with exactly two choices: `init-and-sync` and `skip`. When the mode is `init-and-sync`, factory seeding SHALL initialize Meilisearch indexes before database seeding begins and SHALL enable targeted seed sync hooks for seeders. When the mode is `skip`, factory seeding SHALL skip both Meilisearch initialization and Meilisearch synchronization.

#### Scenario: Init mode initializes before seed
- **WHEN** the factory flow runs with Meili mode `init-and-sync`
- **THEN** Meilisearch index initialization SHALL complete before baseline or factory database rows are seeded
- **AND** targeted Meilisearch synchronization hooks SHALL run as seeders create complete indexable Units

#### Scenario: Skip mode disables all Meili work
- **WHEN** the factory flow runs with Meili mode `skip`
- **THEN** it SHALL NOT initialize Meilisearch indexes
- **AND** it SHALL NOT synchronize seeded Units to Meilisearch

### Requirement: Factory returns special seed targets
The factory seed flow SHALL produce a special target report containing stable entries for Units created by selected special scenarios. Each special target entry SHALL include a label, scenario, Unit type, Unit ID, and optional notes.

#### Scenario: Human output includes fixture identifiers
- **WHEN** factory seeding completes
- **THEN** the CLI SHALL print each special target entry with its label, scenario, Unit type, and Unit ID
- **AND** base preset Units SHALL NOT be printed as special targets

#### Scenario: JSON output is machine-readable
- **WHEN** factory seeding is requested with JSON target output
- **THEN** the CLI SHALL emit a JSON document containing all special target entries
- **AND** each entry SHALL preserve its label, scenario, Unit type, Unit ID, and notes when present

### Requirement: Special factory scenarios run after base factory seed
The factory flow SHALL support named special scenarios that run after the base preset seed completes. Special scenarios SHALL append their key fixture Units to the special target report.

#### Scenario: Scenario receives base seed context
- **WHEN** a special scenario is selected
- **THEN** it SHALL run after the base factory preset has created users, works, and supporting data
- **AND** it MAY reuse base seed data as scenario inputs

#### Scenario: Scenario appends special target entries
- **WHEN** a special scenario creates a key fixture Unit
- **THEN** it SHALL append a special target entry identifying that Unit and the scenario that created it

### Requirement: Interactive factory uses staged selection
The interactive factory CLI SHALL keep base preset selection as a single-select choice, SHALL expose Meili mode as a single-select choice, and SHALL expose special scenarios as a multi-select choice. Interactive special scenarios SHALL default to selected.

#### Scenario: User can deselect special scenarios
- **WHEN** the interactive factory flow shows special scenarios
- **THEN** the scenarios SHALL be presented as a multi-select list
- **AND** the user SHALL be able to deselect any scenario before seeding starts

### Requirement: Non-interactive scenario selection is explicit
Non-interactive factory runs SHALL NOT silently run special scenarios unless the command explicitly requests named scenarios or all scenarios.

#### Scenario: Base non-interactive seed remains base-only
- **WHEN** a non-interactive factory command runs without a scenario flag
- **THEN** it SHALL run the selected base preset
- **AND** it SHALL NOT run special scenarios

#### Scenario: All scenarios flag selects every scenario
- **WHEN** a non-interactive factory command requests all scenarios
- **THEN** it SHALL run every registered special scenario after the base preset

### Requirement: Large post tree scenario
The `large-post-tree` scenario SHALL create a named target Unit and a large post tree fixture with deterministic root, depth, branching, sort path, and reply count semantics sufficient for post tree pagination and rendering tests.

#### Scenario: Large post tree targets are emitted
- **WHEN** the `large-post-tree` scenario completes
- **THEN** the special target report SHALL include the target Unit and at least one root post Unit

### Requirement: Large content tree scenario
The `large-content-tree` scenario SHALL create a named content tree fixture with enough nodes and materialized chapter Units to test content tree rendering, traversal, and search projection behavior.

#### Scenario: Large content tree target is emitted
- **WHEN** the `large-content-tree` scenario completes
- **THEN** the special target report SHALL include the root content Unit

### Requirement: Large history scenario
The `large-history` scenario SHALL create a named Unit with many history timeline records suitable for revision and structure-event pagination tests.

#### Scenario: Large history target is emitted
- **WHEN** the `large-history` scenario completes
- **THEN** the special target report SHALL include the Unit whose history was seeded
- **AND** the scenario SHALL document whether it wrote direct history records, main database outbox records, or both

### Requirement: Complex shelf scenario
The `complex-shelf` scenario SHALL create a named shelf fixture with mixed item kinds, relation rows, ordering data, and enough items to test complex shelf display and mutation behavior.

#### Scenario: Complex shelf target is emitted
- **WHEN** the `complex-shelf` scenario completes
- **THEN** the special target report SHALL include the shelf Unit

### Requirement: Factory targeted sync uses runtime hooks
When Meili mode is `init-and-sync`, the factory flow SHALL synchronize Meilisearch through seed runtime hooks rather than running a full reindex by default. Seeders SHALL call the appropriate hook after creating or mutating a complete indexable projection. Seeders that produce Entity Units SHALL invoke the entity search sync hook so seeded Entities are synchronized to the `entities` index.

#### Scenario: Runtime hooks respect Meili mode
- **WHEN** the runtime is configured with Meili mode `skip`
- **THEN** all seed sync hooks SHALL be no-ops
- **WHEN** the runtime is configured with Meili mode `init-and-sync`
- **THEN** each sync hook SHALL synchronize the requested Unit to its target index

#### Scenario: Full reindex is not default factory sync
- **WHEN** a factory run completes with Meili mode `init-and-sync`
- **THEN** it SHALL NOT call full reindex functions as the default synchronization strategy

#### Scenario: Entity seeders sync entity documents
- **WHEN** a factory run completes with Meili mode `init-and-sync`
- **AND** the seed pipeline created Entity Units
- **THEN** targeted sync SHALL synchronize those Entity documents to the `entities` index
- **AND** the synchronized documents SHALL include `eligibleCreditRoles` and `eligibleSubjectRoles`

### Requirement: Factory Provides Unit Work Domain Scenario

The factory seed system SHALL provide a special scenario that creates a
multi-release work-domain fixture for release-aware books. The scenario SHALL
produce stable special target output for the hidden work, primary release,
translation release, secondary release, hidden-by-default release, and any key
admin merge target created by the scenario.

#### Scenario: Work domain targets are emitted

- **WHEN** the `unit-work-domain` special scenario completes
- **THEN** the special target report SHALL include the hidden work Unit id
- **AND** it SHALL include at least the primary release Unit id and one
  translation release Unit id

### Requirement: Work Domain Scenario Covers Inheritance And Grouping

The `unit-work-domain` scenario SHALL seed data sufficient to exercise inherited
work tags, release-local tags, release-local translations, grouped content
search, release-specific reviews aggregated by work, and shelf work-domain
membership.

#### Scenario: Inherited and local tags exist

- **WHEN** the scenario creates a hidden work and release members
- **THEN** at least one tag SHALL be attached to the hidden work
- **AND** at least one different tag SHALL be attached directly to a release

#### Scenario: Release-local translations exist

- **WHEN** the scenario creates releases in multiple languages
- **THEN** at least one release SHALL have multiple `UnitTranslation` rows for
  language-switcher verification
- **AND** at least one same-work release in another language SHALL exist for
  Releases tab filtering verification

#### Scenario: Work-domain reviews exist

- **WHEN** the scenario creates reviews
- **THEN** at least two reviews SHALL target different releases under the same
  work
- **AND** their work-domain projection SHALL allow a release page to show both
  in the same work feed

#### Scenario: Shelf contains same-work releases

- **WHEN** the scenario creates a shelf fixture
- **THEN** the shelf SHALL contain at least two releases belonging to the same
  hidden work
- **AND** the shelf Unit SHALL have `UnitWork(..., role = SHELF)` membership in
  that work domain

### Requirement: Work Domain Scenario Covers Source Identity

The `unit-work-domain` scenario SHALL cover source identity by attaching source
identity data to visible releases. It SHOULD attach at least one ISBN and one
source site external reference to a visible release. ISBN and source references
in this scenario SHALL identify releases, not hidden works.

#### Scenario: External reference attaches to release

- **WHEN** the scenario creates a source-site reference for a book fixture
- **THEN** the `UnitExternalRef.unitId` SHALL reference a visible release Unit
- **AND** it SHALL NOT use the hidden work Unit as the external book identity by
  default
