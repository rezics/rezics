# seed-preset-library Specification

## Purpose
TBD - created by archiving change seed-unified-plan-modes. Update Purpose after archive.
## Requirements
### Requirement: Preset bundle shape

The seed system SHALL define `SeedPreset` as `{ mode: Mode; plan: SeedPlan }`. Every preset SHALL be a single value of this type, declared in its own file under `package/utils/src/factory/presets/<name>.ts` and exported as the module's default or as a named export matching the file stem.

#### Scenario: Preset files export a SeedPreset value

- **WHEN** any file under `package/utils/src/factory/presets/` (excluding `index.ts`) is inspected
- **THEN** it SHALL export exactly one `SeedPreset` value
- **AND** the value SHALL type-check against `{ mode: Mode; plan: SeedPlan }`

#### Scenario: No preset mutates shared state at import time

- **WHEN** a preset module is imported
- **THEN** it SHALL NOT perform any side effects (no DB access, no env reads beyond `NODE_ENV` for defaults)

### Requirement: First-release preset set

The seed system SHALL ship the following presets in the first release, each in its own file under `package/utils/src/factory/presets/`:

- `realistic` — `mode: 'realistic'`, with a plan whose counts reproduce the pre-change seed output envelope (users, books, games, media, etc. at today's `DEFAULT_COUNTS` values; `postsPerWork` and `chapter` at today's power-law parameters).
- `fast` — `mode: 'realistic'`, with the plan scaled down to match today's `SEED_PROFILE=fast` overrides (30 users, 50 works per type, etc.).
- `minimal` — `mode: 'fixed'`, small counts suitable for smoke-testing the 13 orchestration steps without producing meaningful volume.
- `post-tree-focus` — `mode: 'fixed'`, exactly one work per type, one review per work, and a `treeShape` with precisely specified `roots`, `depth`, and `branching` targets for post-tree API debugging.

#### Scenario: Realistic preset reproduces current output shape

- **WHEN** `bun run seed factory --preset=realistic --no-interactive` is invoked
- **AND** the database is reset beforehand
- **THEN** the final counts of users, books, games, media, tags, realms, and shelves SHALL match the counts produced by `bun run seed:factory` immediately prior to this change
- **AND** per-work review / excerpt / remark / tree post counts SHALL follow the same power-law distribution

#### Scenario: Post-tree-focus preset is deterministic

- **WHEN** `bun run seed factory --preset=post-tree-focus --no-interactive` is run twice against a freshly reset database
- **THEN** both runs SHALL produce the same number of books, the same number of reviews per book, and trees with the same `roots`, `depth`, and `branching` counts
- **AND** the tree shape SHALL match the values declared in `post-tree-focus.plan.treeShape`

#### Scenario: Minimal preset completes quickly

- **WHEN** `bun run seed factory --preset=minimal --no-interactive` is run on a freshly reset database
- **THEN** the orchestration SHALL complete all 13 steps without error
- **AND** the total row count across seeded Prisma models SHALL be strictly smaller than the `fast` preset's output

### Requirement: Preset registry for CLI discovery

The seed system SHALL provide `package/utils/src/factory/presets/index.ts` that exports a record keyed by preset name. The interactive CLI SHALL use this registry to populate its preset-selection menu, and the `--preset=<name>` flag SHALL resolve against this registry.

#### Scenario: Adding a preset requires no CLI edit

- **WHEN** a new file `package/utils/src/factory/presets/<name>.ts` is added and re-exported from `package/utils/src/factory/presets/index.ts`
- **THEN** the interactive CLI preset-selection list SHALL include `<name>` without any edit to the CLI runner

#### Scenario: Unknown preset name fails loudly

- **WHEN** `bun run seed factory --preset=nonexistent --no-interactive` is run
- **THEN** the CLI SHALL print an error listing the available preset names
- **AND** SHALL exit with a non-zero status
- **AND** SHALL NOT begin seeding

### Requirement: Preset plan is frozen at load time

When a preset is loaded, its `plan` SHALL be deep-frozen (or shape-validated and treated as immutable) by the loader before being passed to `runFactorySeed`. The interactive `$EDITOR` tweak step SHALL operate on a deep clone, never on the preset value itself. The preset's `mode` SHALL NOT be modifiable by the tweak step.

#### Scenario: Tweak step does not mutate the preset module

- **WHEN** the user enters the `$EDITOR` tweak step and saves a modified plan
- **AND** a second seed run is started in the same process
- **THEN** the second run's starting plan SHALL be the original preset's plan, not the previously tweaked plan

#### Scenario: Tweak step cannot change the mode

- **WHEN** the user edits the JSON plan and attempts to change the top-level `mode` field
- **THEN** the validation SHALL reject the edit with an error message stating that mode is preset-controlled
- **AND** the user SHALL be re-prompted to edit

### Requirement: Factory preset selection is one stage of a larger interactive flow
The interactive factory CLI SHALL keep preset selection backed by the preset registry, but preset selection SHALL be only the base data stage. The same interactive flow SHALL also collect Meili mode and special scenario selections before executing the factory seed.

#### Scenario: Preset menu still comes from registry
- **WHEN** the interactive factory flow asks for a base preset
- **THEN** it SHALL list presets from the preset registry
- **AND** the selected preset SHALL determine the base `SeedPlan` and mode

#### Scenario: Additional stages follow preset selection
- **WHEN** a user selects a base preset interactively
- **THEN** the flow SHALL continue to collect Meili mode and special scenario selections before seeding begins

### Requirement: Special scenarios are not presets
The factory system SHALL NOT require a special edge-case fixture to be modeled as a preset. Special scenarios SHALL compose with any compatible base preset.

#### Scenario: Scenario composes with fast preset
- **WHEN** a user selects the `fast` preset and the `complex-shelf` scenario
- **THEN** the factory flow SHALL run the `fast` base preset
- **AND** it SHALL run the `complex-shelf` scenario afterward

