# seed-engine Specification

## Purpose

Owns the factory seed runtime: the staged interactive CLI flow
that composes a base preset, a Meilisearch mode (`init-and-sync`
or `skip`), and a multi-select of special edge-case scenarios
(`large-post-tree`, `large-content-tree`, `large-history`,
`complex-shelf`, `unit-work-domain`); the stable special-target
report emitted in human and JSON forms; the runtime sync hooks
that replace blanket reindexes (including the entity sync hook
that pushes `eligibleCreditRoles` / `eligibleSubjectRoles` to the
`entities` index); the interactive `$EDITOR` tweak step that
validates the edited plan against the Valibot `SeedPlan` schema
with safe temp-file location and cleanup; and the batch-insert
performance contract that keeps entity, chapter, post, and
attribution seeders fast by preferring two-phase `createMany`
under `chunkedParallel` with a 500-row chunk cap.

## Factory flow and scenarios

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

## Interactive editor

### Requirement: CLI offers an interactive tweak step after preset selection

The unified seed CLI (`bun run seed`, entry: `package/utils/bin/cli.ts`) SHALL offer an interactive tweak step after the user selects the `factory` target and a preset, before seeding begins. The tweak step SHALL be entered on an explicit user confirmation (Clack `confirm` or equivalent) and SHALL be skippable so users who want the preset unchanged can proceed directly.

#### Scenario: User declines tweak and proceeds

- **WHEN** the user selects a preset
- **AND** declines the "tweak plan?" confirmation
- **THEN** the CLI SHALL proceed to seeding with the preset's unmodified plan

#### Scenario: User accepts tweak step

- **WHEN** the user selects a preset
- **AND** accepts the "tweak plan?" confirmation
- **THEN** the CLI SHALL write the plan to a temp JSON file and spawn `$EDITOR` on it

#### Scenario: No-interactive flag bypasses the tweak step

- **WHEN** the CLI is launched with `--no-interactive`
- **THEN** no confirmation SHALL be shown
- **AND** the preset's plan SHALL be used unchanged

### Requirement: Temp file location and cleanup

The tweak step SHALL write its temp file under `node_modules/.cache/rezics-seed/`, in a uniquely-named subdirectory created via `fs.mkdtemp(...)`. The temp file SHALL be named `plan.json` within that subdirectory. The subdirectory SHALL be removed in a `try/finally` around the editor spawn, and also from `SIGINT` and `SIGTERM` handlers registered for the duration of the edit step.

Additionally, on every CLI startup the seed system SHALL sweep `node_modules/.cache/rezics-seed/` and remove any `edit-*` subdirectory older than 1 hour.

#### Scenario: Successful tweak cleans up temp file

- **WHEN** the user edits the plan, saves, and the edit completes successfully
- **THEN** the `node_modules/.cache/rezics-seed/edit-<id>/` directory SHALL no longer exist after the edit step returns

#### Scenario: User cancels mid-edit via Ctrl+C

- **WHEN** the user presses Ctrl+C while the editor is open
- **THEN** the SIGINT handler SHALL remove the `node_modules/.cache/rezics-seed/edit-<id>/` directory
- **AND** the CLI SHALL exit with a non-zero status

#### Scenario: Prior-run leftovers are swept

- **WHEN** a `node_modules/.cache/rezics-seed/edit-<old>/` directory exists with an mtime older than 1 hour
- **AND** the CLI is launched
- **THEN** that directory SHALL be removed during startup
- **AND** directories newer than 1 hour SHALL be left alone

#### Scenario: Temp path stays inside the project

- **WHEN** the temp subdirectory is created
- **THEN** its absolute path SHALL be a descendant of the project root
- **AND** SHALL NOT be a descendant of `os.tmpdir()`

### Requirement: Editor resolution

The tweak step SHALL resolve the editor command in this order: `process.env.VISUAL`, then `process.env.EDITOR`, then a platform default (`notepad` on win32, `vi` on darwin/linux). If the resolved command is not found on `PATH`, the CLI SHALL abort the tweak step with a Clack error naming `VISUAL` / `EDITOR` as the env vars to set.

#### Scenario: VISUAL takes precedence over EDITOR

- **WHEN** both `VISUAL=code` and `EDITOR=vi` are set
- **THEN** the tweak step SHALL spawn `code`

#### Scenario: Missing editor surfaces a clear error

- **WHEN** `VISUAL` and `EDITOR` are unset
- **AND** the platform default (e.g. `vi`) is not installed on `PATH`
- **THEN** the CLI SHALL print a Clack error instructing the user to set `VISUAL` or `EDITOR`
- **AND** SHALL exit the tweak step without attempting to seed

### Requirement: Plan validation round-trip

After the editor exits, the tweak step SHALL read the temp file, parse it as JSON, and validate it against the `SeedPlan` schema implemented with Valibot. On validation failure, the CLI SHALL display the failing path(s) and message(s) via Clack and prompt the user with "edit again?" / "cancel". On "edit again", the CLI SHALL re-open the same temp file, preserving the user's most recent content rather than reverting to the preset defaults.

#### Scenario: Valid plan proceeds to seeding

- **WHEN** the user saves a plan that validates against the schema
- **THEN** the CLI SHALL exit the tweak step and begin seeding with the parsed plan

#### Scenario: Invalid plan offers re-edit

- **WHEN** the user saves a plan that fails validation (e.g. `max` missing on a `CountSpec`)
- **THEN** the CLI SHALL display the validation path and message
- **AND** SHALL prompt "edit again?" with a default of yes
- **AND** on "yes", SHALL re-open the editor on the same file with the user's latest content preserved

#### Scenario: Validation blocks unknown top-level fields

- **WHEN** the user's edited plan contains a top-level field not present in the schema
- **THEN** validation SHALL fail and the user SHALL be re-prompted to edit

#### Scenario: User cancels re-edit prompt

- **WHEN** the user declines the "edit again?" prompt after a validation failure
- **THEN** the CLI SHALL clean up the temp file and exit with a non-zero status
- **AND** SHALL NOT begin seeding

## Performance batch

### Requirement: Entity seed uses batch insert

The person and organization entity seeders SHALL use a two-phase batch insert pattern instead of sequential `prisma.unit.create` loops. Phase 1 creates all Unit rows via `createMany`. Phase 2 creates Entity extension rows and UnitTranslation rows via separate `createMany` calls.

#### Scenario: Person entities created in batch

- **WHEN** 800 person entities are seeded
- **THEN** the seeder SHALL issue no more than 10 `createMany` calls for Unit rows (batched), not 800 individual `create` calls

#### Scenario: Batch insert produces correct data

- **WHEN** entity seed completes via batch insert
- **THEN** every Entity row SHALL have a corresponding Unit row and at least one UnitTranslation row

### Requirement: Chapter seed uses batch insert for mega-books

When a book has more than 50 chapters, the chapter seeder SHALL use `createMany` for Unit and UnitTranslation rows instead of individual creates. Books with 50 or fewer chapters MAY continue using individual creates.

#### Scenario: Mega-book chapters created efficiently

- **WHEN** a book with 500 chapters is seeded
- **THEN** the chapter seeder SHALL use `createMany` batches rather than 500 individual `create` calls

#### Scenario: Small book chapters unchanged

- **WHEN** a book with 20 chapters is seeded
- **THEN** the chapter seeder MAY use individual creates or batch inserts (either is acceptable)

### Requirement: Post seed uses batch insert for high-engagement works

When a work receives more than 20 posts (of any kind), the post seeder SHALL use `createMany` for Unit rows and Post extension rows. The seeder SHALL fall back to individual creates for works with 20 or fewer posts.

#### Scenario: High-engagement work posts batched

- **WHEN** a work with 80 tree posts is seeded
- **THEN** the post seeder SHALL use `createMany` batches for the Unit and Post rows

### Requirement: Chunked parallelism preserved

All batch operations SHALL continue to use `chunkedParallel` or equivalent chunking to avoid overwhelming the database connection pool. Batch sizes for `createMany` SHALL not exceed 500 rows per call.

#### Scenario: Large batch is chunked

- **WHEN** 1000 entity Units are created via batch
- **THEN** the operation SHALL be split into chunks of at most 500 rows each

### Requirement: Attribution batch insert

Attribution records (linking entities to works) SHALL be collected per-chunk and inserted via `createMany` rather than per-work individual creates, when processing works in batch.

#### Scenario: Attributions batched across works

- **WHEN** a chunk of 10 works is processed
- **THEN** all attribution records for those 10 works SHALL be inserted in a single `createMany` call
