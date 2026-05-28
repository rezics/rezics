# seed-presets Specification

## Purpose

Defines the seed plan model and the preset library that ships
with it. Owns the unified `SeedPlan` type whose every count is a
`CountSpec` (with required `max`, optional `min` / `target` /
`alpha`), the `'realistic' | 'fixed' | 'uniform'` mode literal
union, the `CountProvider.draw(spec)` contract that interprets
each spec under the active mode, the `SeedCtx` that threads the
provider into every seeder, and the `treeShape` plan section that
absorbs post-tree shape constants. Also owns the `SeedPreset`
bundle (`{ mode, plan }`), the first-release preset set
(`realistic`, `fast`, `minimal`, `post-tree-focus`), the preset
registry that powers CLI discovery and `--preset=<name>`
resolution, the deep-frozen plan loaded for each run, and the
rule that special edge-case fixtures compose with — not replace —
presets.

## Plan and modes

### Requirement: Unified SeedPlan type

The seed system SHALL expose a single `SeedPlan` type that every factory seeder reads its count parameters from. Every numeric count in `SeedPlan` (entity totals, per-work post counts, chapter counts, tree shape fields, follows-per-user, favorite-items-per-user, and any future count knob) SHALL be typed as a `CountSpec`. No factory seeder function SHALL accept count parameters outside of `SeedPlan`.

#### Scenario: Every count field is a CountSpec

- **WHEN** the `SeedPlan` type is inspected
- **THEN** every leaf that denotes "how many" SHALL have type `CountSpec`
- **AND** no leaf SHALL be a bare `number`, `{ min, max }`, or any other ad-hoc shape

#### Scenario: Seeder functions take SeedPlan slices

- **WHEN** any function in `package/server/prisma/factory/*` that seeds entities is inspected
- **THEN** its count-related parameters SHALL come from a `SeedPlan` slice passed via `SeedCtx`
- **AND** it SHALL NOT call `powerLaw(...)` or `randomInt(...)` directly for count decisions
- **AND** it SHALL obtain every count via `ctx.draw(spec)` where `spec` is a `CountSpec` read from the plan

### Requirement: CountSpec shape

The seed system SHALL define `CountSpec` as an object with the following fields:

- `min?: number` — lower bound, default `0`
- `max: number` — required upper bound, clamped in every mode
- `target?: number` — preferred value under `fixed` mode, defaults to `round((min + max) / 2)`
- `alpha?: number` — skew under `realistic` mode, default supplied by the CountProvider when the field is omitted

No other fields SHALL appear on `CountSpec`.

#### Scenario: Max is required

- **WHEN** a `SeedPlan` omits `max` on any `CountSpec`
- **THEN** validation SHALL reject the plan with an error identifying the offending path

#### Scenario: Target defaults to midpoint

- **WHEN** `fixed` mode draws from a `CountSpec` where `target` is undefined
- **THEN** the drawn value SHALL be `round((min ?? 0 + max) / 2)`

### Requirement: Mode discriminator

The seed system SHALL define `Mode` as the exact literal union `'realistic' | 'fixed' | 'uniform'`. The mode SHALL be read from the active preset and SHALL be global across a single seed run — no seeder function SHALL select or override the mode locally.

#### Scenario: Mode is a fixed literal union

- **WHEN** the `Mode` type is inspected
- **THEN** it SHALL be exactly `'realistic' | 'fixed' | 'uniform'`

#### Scenario: No local mode override

- **WHEN** any seeder function is inspected
- **THEN** it SHALL NOT accept a `mode` parameter
- **AND** it SHALL NOT switch on a mode value

### Requirement: CountProvider draws values by mode

The seed system SHALL provide a `CountProvider` with a single method `draw(spec: CountSpec): number`. The orchestrator SHALL construct exactly one `CountProvider` per seed run from the preset's `mode` and bind it into `SeedCtx`. `draw` SHALL behave as follows:

- `mode === 'realistic'`: returns `powerLaw(spec.min ?? 0, spec.max, spec.alpha ?? providerDefault)`
- `mode === 'fixed'`: returns `clamp(spec.target ?? round((min + max) / 2), min, max)`
- `mode === 'uniform'`: returns `randInt(spec.min ?? 0, spec.max)`

Every returned value SHALL be an integer in `[spec.min ?? 0, spec.max]`.

#### Scenario: Fixed mode is deterministic for a given spec

- **WHEN** `mode = 'fixed'` and a `CountSpec` `{ min: 0, max: 100, target: 5 }` is drawn 1000 times
- **THEN** every returned value SHALL be exactly `5`

#### Scenario: Fixed mode falls back to midpoint when target is missing

- **WHEN** `mode = 'fixed'` and a `CountSpec` `{ min: 2, max: 10 }` is drawn
- **THEN** the returned value SHALL be `6`

#### Scenario: Uniform mode covers the full range

- **WHEN** `mode = 'uniform'` and `{ min: 0, max: 20 }` is drawn 10000 times
- **THEN** every returned value SHALL be an integer in `[0, 20]`
- **AND** at least one draw SHALL be `0`, and at least one SHALL be `20`
- **AND** no integer in `[0, 20]` SHALL be drawn fewer than 100 times

#### Scenario: Realistic mode defers to power-law

- **WHEN** `mode = 'realistic'` and `{ min: 0, max: 50, alpha: 1.8 }` is drawn 10000 times
- **THEN** the returned distribution SHALL match the existing `seed-power-law-distribution` scenarios for these parameters
- **AND** every returned value SHALL be in `[0, 50]`

### Requirement: SeedCtx carries the CountProvider

The seed system SHALL define a `SeedCtx` type carrying at minimum the active `PrismaClient` and a bound `draw(spec)` function. The orchestrator SHALL build `SeedCtx` once at the start of a run and pass it to every seeder function. Seeder functions SHALL obtain counts only via `ctx.draw(...)`.

#### Scenario: Orchestrator instantiates ctx once

- **WHEN** `runFactorySeed(ctx, plan)` executes
- **THEN** the same `ctx` instance SHALL be threaded through every downstream seeder call
- **AND** `ctx.draw` SHALL refer to the same `CountProvider` instance throughout the run

#### Scenario: Seeder functions consume ctx.draw

- **WHEN** a seeder such as `seedPostsForWorks` needs to decide "how many reviews for this work"
- **THEN** it SHALL call `ctx.draw(plan.postsPerWork.review)`
- **AND** SHALL NOT construct its own distribution call

### Requirement: Tree shape is folded into the plan and the mode

The seed system SHALL represent post-tree shape under `plan.treeShape` with three `CountSpec` fields: `roots`, `depth`, and `branching`. `seedTreePostsForTarget` SHALL draw each of these via `ctx.draw(...)`. No constants for root ratio, depth cap, or branching SHALL remain hardcoded in `factory/posts.ts`.

#### Scenario: Fixed mode produces exact tree shape

- **WHEN** `mode = 'fixed'` and `plan.treeShape = { roots: { min:1,max:10,target:1 }, depth: { min:0,max:5,target:2 }, branching: { min:1,max:10,target:3 } }`
- **AND** a tree is seeded for a target unit
- **THEN** the tree SHALL have exactly 1 root
- **AND** every non-leaf node SHALL have exactly 3 direct children
- **AND** the deepest reply SHALL have depth exactly 2

#### Scenario: Realistic mode preserves existing shape behavior

- **WHEN** `mode = 'realistic'` and `plan.treeShape` carries the realistic-preset defaults
- **THEN** the resulting tree shapes SHALL be statistically consistent with today's `seed-power-law-distribution` behavior for tree posts

#### Scenario: No hardcoded shape constants remain

- **WHEN** `factory/posts.ts` is inspected
- **THEN** it SHALL NOT contain a hardcoded `rootRatio`, `depthCap`, or branching literal
- **AND** all such decisions SHALL read from `plan.treeShape` via `ctx.draw(...)`

### Requirement: SeedPlan remains the broad population model
The seed system SHALL keep `SeedPlan` focused on broad population counts and distribution choices. Named edge-case fixture topology SHALL be modeled as special factory scenario configuration rather than as new `SeedPlan` count fields.

#### Scenario: Edge-case topology is outside SeedPlan
- **WHEN** a special fixture needs domain-specific topology such as a large post tree, large history timeline, or complex shelf relation graph
- **THEN** that topology SHALL be configured by the scenario
- **AND** it SHALL NOT require adding scenario-specific count fields to `SeedPlan`

#### Scenario: Base plan validation remains compatible
- **WHEN** an existing plan file validates against `SeedPlanSchema`
- **THEN** it SHALL remain valid without requiring special scenario fields

## Preset library

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
