## ADDED Requirements

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
