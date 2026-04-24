## Why

The seed system today is split across two disjoint entry points and bakes distribution assumptions into the generators themselves, which blocks targeted API debugging.

- `tool/seed/seed.ts` is an interactive Clack CLI but only covers `users` + `infra`.
- `package/server/prisma/seed/mocks/seed.ts` is a non-interactive 13-step orchestrator that produces realistic, power-law-distributed mock data but is configured solely via `SEED_*` env vars.
- Call sites in `mocks/posts.ts`, `mocks/books.ts`, and `mocks/shelves.ts` hardcode `powerLaw(...)` with fixed parameters, plus tree-shape constants (`rootRatio = 0.4`, `depthCap = 4`, random branching). There is no way to request "every book has exactly 5 chapters" or "one book with a tree of known shape" for debugging the post-tree API, the engagement aggregator, or any other behavior whose inputs must be predictable.

We want a single seed CLI where mode selection (realistic / fixed / uniform) drives how counts are drawn from one unified plan, preset bundles make common shapes one-click, and interactive tweaking uses `$EDITOR` so users keep all the editing affordances (find, fold, multi-cursor) they already have in their editor of choice.

## What Changes

- **Add** a single global `SeedPlan` shape: every count is a uniform `CountSpec = { min?, max, target?, alpha? }`. Tree shape is folded into the same plan (`treeShape: { roots, depth, branching }` all `CountSpec`).
- **Add** a `Mode` discriminator (`'realistic' | 'fixed' | 'uniform'`) and a `CountProvider.draw(spec)` that interprets a `CountSpec` according to the active mode:
  - `realistic` → `powerLaw(spec.min ?? 0, spec.max, spec.alpha ?? default)`
  - `fixed` → `spec.target ?? round((min+max)/2)`, clamped to `[min, max]`
  - `uniform` → `randInt(spec.min ?? 0, spec.max)`
- **Add** preset bundles as plain TypeScript objects of type `{ mode: Mode; plan: SeedPlan }` under `tool/seed/presets/`. First release ships `realistic`, `deterministic`, `post-tree-focus`, `minimal`.
- **Add** interactive plan tweaking via `$EDITOR`:
  - Write the resolved plan to a uniquely-named temp file under `node_modules/.cache/rezics-seed/edit-<uuid>/plan.json`.
  - Spawn `$VISUAL || $EDITOR || platform default` on the file and wait for exit.
  - Parse the file back through a Valibot schema; on failure, surface the path + message and offer to re-edit.
  - Clean up the temp dir in `try/finally` and on `SIGINT`/`SIGTERM`. Stale directories from prior crashed runs are swept on next launch.
- **Add** a unified `tool/seed/seed.ts` menu: top-level select for `users` / `infra` / `mock`; under `mock`, pick a preset and optionally enter the `$EDITOR` tweak step before confirming and running.
- **Refactor** `package/server/prisma/seed/mocks/*` so every seeder function is agnostic of mode. Functions receive a `SeedCtx` carrying the bound `CountProvider`, and read parameters from their own slice of the plan. `mocks/seed.ts` becomes a thin caller of a new `runMockSeed(ctx, plan)` orchestrator (invoked by `bun run seed:mock` with the realistic preset so the existing npm script keeps working).
- **BREAKING** Remove the per-call-site `powerLaw(...)` calls with hardcoded literals. All distribution parameters flow through the plan. The `SEED_*` env var surface is dropped in favor of preset files and `$EDITOR`. Users who relied on `SEED_BOOKS=50` or `SEED_PROFILE=fast` now either select the `minimal` preset or use `--preset=<name>` on the CLI.

## Capabilities

### New Capabilities

- `seed-plan-modes`: The unified `SeedPlan` shape, `CountSpec`, `Mode`, and `CountProvider`. Defines how each mode interprets a `CountSpec`, where the active mode is read, and the invariant that every seeder function takes its parameters exclusively through a `CountProvider.draw(spec)` call — no call site uses a raw distribution primitive directly.
- `seed-preset-library`: The preset bundle contract (`{ mode, plan }` of a fixed schema), the first-release preset set (`realistic`, `deterministic`, `post-tree-focus`, `minimal`), and how presets are discovered by the CLI.
- `seed-interactive-editor`: The `$EDITOR`-driven interactive plan-tweak flow, including temp-file location (`node_modules/.cache/rezics-seed/`), cleanup semantics, validation round-trip, and fallback editor selection.

### Modified Capabilities

- `seed-power-law-distribution`: Existing scenarios describe power-law being invoked at specific call sites with hardcoded parameters. They are restated so that those behaviors hold **only when `mode === 'realistic'`**, with parameters supplied by `plan.*` instead of literals, and the assertions that the `fixed` and `uniform` modes produce deterministic / linearly-distributed counts respectively are added.

## Impact

**Affected packages**

- `tool/seed`: new `presets/` directory, new `lib/interactive-plan.ts` (editor spawn + validate + cleanup), new `lib/seed-mock.ts` (caller of `runMockSeed`), rewritten `seed.ts` top-level menu. New dev dependency likely needed: `valibot` (already in repo).
- `package/server/prisma/seed/mocks`: new `strategy.ts` (CountSpec / Mode / CountProvider), new `orchestrator.ts` (the `runMockSeed` function extracted from today's `seed.ts`), rewritten `types.ts` and `config.ts`, updated `posts.ts`, `books.ts`, `shelves.ts`, and any other seeder that currently calls `powerLaw` / `randomInt` for count decisions.
- `package/server/package.json`: `seed:mock` script now delegates to orchestrator with the realistic preset; `SEED_PROFILE=fast` flag removed.
- `openspec/specs`: three new capability specs + one modified (`seed-power-law-distribution`).

**No DB migration.** Schema is unchanged; this is purely a seed-layer refactor.

**Backward compatibility**

- `bun run seed:mock` still exists and produces equivalent realistic data to today.
- **Not preserved**: `SEED_*` env vars (`SEED_USERS`, `SEED_BOOKS`, `SEED_PROFILE=fast`, …). Users migrate to preset selection. Acceptable because env-driven seeding is a developer tool with no production usage.
- `tool/seed/seed.ts` users/infra menu is preserved; a new `mock` top-level option is added alongside.

**Temp-file hygiene**

- All `$EDITOR` temp files live under `node_modules/.cache/rezics-seed/`, which is inside the project tree but already `.gitignore`d via `node_modules`.
- Unique per-invocation subdirs (`fs.mkdtemp`) prevent concurrent collisions.
- Cleanup runs in `try/finally` and signal handlers; a startup sweep removes any leftovers from prior crashes so the directory never grows unbounded.
