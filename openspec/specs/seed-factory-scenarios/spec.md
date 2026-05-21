# seed-factory-scenarios Specification

## Purpose
Defines the factory seed flow extensions that produce named edge-case fixtures, expose Meilisearch lifecycle control, and emit a stable seed manifest. Special factory scenarios run after the base preset to seed large post trees, large content trees, deep history timelines, and complex shelves, with targeted Meilisearch synchronization driven from the manifest instead of full reindex.

## Requirements

### Requirement: Factory flow supports Meili mode selection
The factory seed flow SHALL expose a Meili mode with exactly two choices: `init-and-sync` and `skip`. When the mode is `init-and-sync`, factory seeding SHALL initialize Meilisearch indexes before database seeding begins and SHALL targeted-sync seeded manifest entries after all base and special seeders finish. When the mode is `skip`, factory seeding SHALL skip both Meilisearch initialization and Meilisearch synchronization.

#### Scenario: Init mode initializes before seed
- **WHEN** the factory flow runs with Meili mode `init-and-sync`
- **THEN** Meilisearch index initialization SHALL complete before baseline or factory database rows are seeded
- **AND** targeted Meilisearch synchronization SHALL run after base and special seeders complete

#### Scenario: Skip mode disables all Meili work
- **WHEN** the factory flow runs with Meili mode `skip`
- **THEN** it SHALL NOT initialize Meilisearch indexes
- **AND** it SHALL NOT synchronize seeded Units to Meilisearch

### Requirement: Factory returns a seed manifest
The factory seed flow SHALL produce a seed manifest containing stable entries for important seeded Units. Each manifest entry SHALL include a label, Unit type, Unit ID, sync targets, and, when applicable, the scenario that created it.

#### Scenario: Human output includes fixture identifiers
- **WHEN** factory seeding completes
- **THEN** the CLI SHALL print each manifest entry with its label, Unit type, and Unit ID

#### Scenario: JSON output is machine-readable
- **WHEN** factory seeding is requested with JSON manifest output
- **THEN** the CLI SHALL emit a JSON document containing all manifest entries
- **AND** each entry SHALL preserve its label, scenario, Unit type, Unit ID, and sync targets

### Requirement: Special factory scenarios run after base factory seed
The factory flow SHALL support named special scenarios that run after the base preset seed completes. Special scenarios SHALL append their key fixture Units to the seed manifest.

#### Scenario: Scenario receives base seed context
- **WHEN** a special scenario is selected
- **THEN** it SHALL run after the base factory preset has created users, works, and supporting data
- **AND** it MAY reuse base seed data as scenario inputs

#### Scenario: Scenario appends manifest entries
- **WHEN** a special scenario creates a key fixture Unit
- **THEN** it SHALL append a manifest entry identifying that Unit and the scenario that created it

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

#### Scenario: Large post tree manifest is emitted
- **WHEN** the `large-post-tree` scenario completes
- **THEN** the manifest SHALL include the target Unit and at least one root post Unit
- **AND** those entries SHALL include sync targets for the relevant content and post indexes

### Requirement: Large content tree scenario
The `large-content-tree` scenario SHALL create a named content tree fixture with enough nodes and materialized chapter Units to test content tree rendering, traversal, and search projection behavior.

#### Scenario: Large content tree manifest is emitted
- **WHEN** the `large-content-tree` scenario completes
- **THEN** the manifest SHALL include the root content Unit
- **AND** it SHALL include sync targets for indexes affected by that Unit and its materialized content

### Requirement: Large history scenario
The `large-history` scenario SHALL create a named Unit with many history timeline records suitable for revision and structure-event pagination tests.

#### Scenario: Large history manifest is emitted
- **WHEN** the `large-history` scenario completes
- **THEN** the manifest SHALL include the Unit whose history was seeded
- **AND** the scenario SHALL document whether it wrote direct history records, main database outbox records, or both

### Requirement: Complex shelf scenario
The `complex-shelf` scenario SHALL create a named shelf fixture with mixed item kinds, relation rows, ordering data, and enough items to test complex shelf display and mutation behavior.

#### Scenario: Complex shelf manifest is emitted
- **WHEN** the `complex-shelf` scenario completes
- **THEN** the manifest SHALL include the shelf Unit
- **AND** the shelf entry SHALL include content sync targets needed to update searchable contained Unit metadata

### Requirement: Factory targeted sync uses manifest entries
When Meili mode is `init-and-sync`, the factory flow SHALL synchronize Meilisearch from the seed manifest rather than running a full reindex by default. The targeted sync step SHALL deduplicate sync work by sync target and Unit ID.

#### Scenario: Duplicate manifest entries sync once per target
- **WHEN** multiple manifest entries reference the same Unit ID and sync target
- **THEN** targeted sync SHALL call that sync target at most once for that Unit ID

#### Scenario: Full reindex is not default factory sync
- **WHEN** a factory run completes with Meili mode `init-and-sync`
- **THEN** it SHALL NOT call full reindex functions as the default synchronization strategy
