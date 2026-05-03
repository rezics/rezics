## 1. Core types and CountProvider

- [x] 1.1 Add `package/server/prisma/seed/mocks/strategy.ts` exporting `Mode`, `CountSpec`, `CountProvider`, and `makeCountProvider(mode)` per design Decision 2.
- [x] 1.2 Implement `draw` for each mode (`realistic` → `powerLaw`, `fixed` → clamped `target`, `uniform` → `randInt`), including the default-midpoint fallback for missing `target`.
- [x] 1.3 Add `SeedCtx` type in `mocks/strategy.ts` (`prisma`, `draw`) and a `makeSeedCtx(prisma, mode)` factory.
- [x] 1.4 Add a Valibot schema for `CountSpec` (used by the `$EDITOR` round-trip); put it alongside the type definition so plan schema composition stays co-located.
- [x] 1.5 Unit test `makeCountProvider`: fixed mode deterministic, uniform mode covers range, realistic mode stays bounded (mirrors scenarios in `seed-plan-modes/spec.md`).

## 2. SeedPlan type and Valibot schema

- [x] 2.1 Rewrite `package/server/prisma/seed/mocks/types.ts` so every count field is typed as `CountSpec`. Add `plan.treeShape: { roots, depth, branching }`, `plan.chapter.count`, `plan.postsPerWork.{review,excerpt,remark,tree}`, `plan.shelfItemCount`, and counterparts for all existing numeric knobs.
- [x] 2.2 Add a Valibot schema `SeedPlanSchema` covering the whole plan, with explicit `max` requirement on every `CountSpec` and `strict` object validation (unknown keys rejected).
- [x] 2.3 Add a unit test that `SeedPlanSchema.parse(realisticPresetPlan)` succeeds and that a plan missing `max` on any leaf fails with a path in the error.

## 3. Orchestrator extraction

- [x] 3.1 Create `package/server/prisma/seed/mocks/orchestrator.ts` exporting `runMockSeed(ctx, plan)`. Move the 13-step body from `mocks/seed.ts` into it verbatim, still using the old `powerLaw`/`randomInt` calls at this stage.
- [x] 3.2 Rewrite `mocks/seed.ts` so it becomes a thin entry: resolve the realistic preset, build `SeedCtx`, call `runMockSeed`. Leaves `bun run seed:mock` functionally unchanged.
- [x] 3.3 Smoke-run `bun run seed:mock` against a scratch DB to confirm the orchestrator extraction produced identical output row counts.

## 4. Convert seeders to `ctx.draw(...)` (one commit per file for bisect)

- [x] 4.1 `mocks/posts.ts`: replace every `powerLaw(0, caps.*, …)` with `ctx.draw(plan.postsPerWork.*)`. Replace the `rootRatio = 0.4`, `depthCap = 4`, and random-branching literals in `seedTreePostsForTarget` with `ctx.draw(plan.treeShape.roots|depth|branching)`. Remove the `powerLaw`/`randomInt` imports from this file.
- [x] 4.2 `mocks/books.ts` (`seedChaptersForBook`): replace chapter-count `powerLaw` with `ctx.draw(plan.chapter.count)`. Route the `unitProbability` and any other numeric knob through the plan.
- [x] 4.3 `mocks/shelves.ts`: replace shelf-item-count `powerLaw` with `ctx.draw(plan.shelfItemCount)`.
- [x] 4.4 Grep-sweep remaining `mocks/` files for direct `powerLaw(` / `randomInt(` count decisions and convert. Leave usages that are *not* counts (e.g. random date selection) untouched.
- [x] 4.5 Add an ESLint or `rg` pre-commit check: `package/server/prisma/seed/mocks/**` may not import `powerLaw` except from `strategy.ts` and `utils.ts`.

## 5. Retire `DEFAULT_COUNTS` and `SEED_*` env vars

- [x] 5.1 Delete `DEFAULT_COUNTS`, `envInt`, `envFloat`, `PROFILE`, and `FAST_OVERRIDES` from `mocks/config.ts`.
- [x] 5.2 Grep-sweep for `SEED_PROFILE`, `SEED_USERS`, `SEED_BOOKS`, `SEED_GAMES`, `SEED_MEDIA`, `SEED_SHELVES`, `SEED_REALMS`, `SEED_ZONES`, `SEED_PERSON_ENTITIES`, `SEED_ORGANIZATION_ENTITIES`, `SEED_FOLLOWS_PER_USER`, `SEED_FAVORITE_ITEMS_PER_USER`, `SEED_REVIEWS_PER_WORK_MAX`, `SEED_EXCERPTS_PER_WORK_MAX`, `SEED_REMARKS_PER_WORK_MAX`, `SEED_TREE_POSTS_PER_WORK_MAX`, `SEED_CHAPTERS_PER_BOOK_MIN`, `SEED_CHAPTERS_PER_BOOK_MAX`, `SEED_CHAPTER_UNIT_PROBABILITY` across the repo and remove references.
- [x] 5.3 Update any docs or `package.json` scripts mentioning `SEED_PROFILE=fast`; replace with `--preset=fast`.

## 6. Preset library

- [x] 6.1 Create `tool/seed/presets/realistic.ts` exporting a `SeedPreset` with `mode: 'realistic'` and a plan whose values reproduce the pre-change `DEFAULT_COUNTS` envelope (users 200, books/games/media 1000, tags 400, shelves 500, realms 20, zones 40, person 800, organization 200, follows 5, favorites 8; `postsPerWork.{review,excerpt,remark,tree}` with `{min, max, alpha}` matching today's call-site literals; `chapter.count` with `{min:5, max:1200, alpha:2.0}`).
- [x] 6.2 Create `tool/seed/presets/fast.ts` mirroring today's `FAST_OVERRIDES` (users 30, 50 works per type, shelves 30, reviewMax 5, etc.).
- [x] 6.3 Create `tool/seed/presets/minimal.ts` with `mode: 'fixed'` and tiny counts (e.g. users 5, books 3, games 3, media 3, tags 10, shelves 3, realms 2, zones 2, review target 1, chapter target 3, tree roots/depth/branching all target 1).
- [x] 6.4 Create `tool/seed/presets/post-tree-focus.ts` with `mode: 'fixed'`: 1 book, 1 game, 1 media; `postsPerWork.review.target = 1`, excerpt/remark 0; `treeShape = { roots: {…target:1}, depth: {…target:2}, branching: {…target:3} }`. Document the exact shape produced in a header comment.
- [x] 6.5 Create `tool/seed/presets/index.ts` exporting `PRESETS: Record<string, SeedPreset>` keyed by preset name.
- [x] 6.6 Add a unit test that every preset type-checks against `{mode, plan}` and its `plan` parses through `SeedPlanSchema`.

## 7. `$EDITOR` interactive tweak step

- [x] 7.1 Create `tool/seed/lib/cache-dir.ts` resolving `node_modules/.cache/rezics-seed/` relative to project root (use `bun.import.meta.dir` or walk up to the repo root via `package.json` detection).
- [x] 7.2 Create `tool/seed/lib/startup-sweep.ts`: on every CLI entry, remove `edit-*` subdirs older than 1 hour from the cache dir; ignore errors.
- [x] 7.3 Create `tool/seed/lib/interactive-plan.ts` implementing `tweakPlan(preset): Promise<SeedPlan>`:
  - `fs.mkdtempSync` a unique `edit-…/` subdir under the cache dir
  - Write pretty-printed JSON of `preset.plan` to `plan.json`
  - Resolve `$VISUAL || $EDITOR || platformDefault` (notepad/vi/nano) and error-out clearly if absent
  - Spawn editor inheriting stdio; `await` child exit
  - Read file back, `JSON.parse`, run `SafeParse` via Valibot
  - On failure: show Clack error with path, prompt "edit again?"; on re-edit, re-open the same file
  - `try/finally` cleans the temp subdir; register `SIGINT`/`SIGTERM` handlers that do the same
  - Reject edits that attempt to change top-level `mode`
- [x] 7.4 Unit test the editor-resolution helper: `$VISUAL` wins over `$EDITOR`; platform default chosen when both unset; missing executable raises the expected error.
- [x] 7.5 Unit test the cleanup helper: after a happy-path call, the temp dir is gone; after a forced throw in the editor-spawn step, the temp dir is gone.

## 8. Unified CLI entry

- [x] 8.1 Extend `tool/seed/seed.ts` top-level `multiselect` to include a `mock` option alongside `users` and `infra`.
- [x] 8.2 When `mock` is selected, show a Clack `select` populated from `PRESETS`.
- [x] 8.3 After preset pick, show Clack `confirm`: "tweak plan?"; on yes call `tweakPlan`, on no use `preset.plan` unchanged.
- [x] 8.4 Summarize the resolved plan (counts overview) and ask final confirmation before running `runMockSeed`.
- [x] 8.5 Add flags: `--preset=<name>` selects a preset without prompting; `--no-interactive` skips every confirmation and tweak step; unknown preset name prints available names and exits non-zero.
- [x] 8.6 Update `tool/seed/seed.ts` startup to call the startup-sweep before any other work.

## 9. Wire `bun run seed:mock`

- [x] 9.1 Update `package/server/package.json` `seed:mock` script to invoke `tool/seed/seed.ts --preset=realistic --no-interactive`.
- [x] 9.2 Smoke-run `bun run seed:mock` against a scratch DB and verify it completes all 13 steps.
- [x] 9.3 Add a `seed:mock:fast` convenience script pointing at `--preset=fast --no-interactive` (replacement for the retired `SEED_PROFILE=fast`).

## 10. Validation and docs

- [x] 10.1 Run `openspec validate seed-unified-plan-modes --strict`.
- [x] 10.2 Run `bun run check:convention` if it covers `tool/` or `package/server/prisma/seed/`; fix any new violations.
- [x] 10.3 Run `bun test` in `package/server` and in `tool` (if test harness exists) to confirm new unit tests pass.
- [x] 10.4 Update the seed section of `CONTRIBUTING.md` (or create a `tool/seed/README.md`) describing the preset list, the `$EDITOR` tweak flow, and the `--preset` / `--no-interactive` flags.
- [x] 10.5 Update `CLAUDE.md` "Mock convention" paragraph or add a short sibling section pointing at the new seed CLI.

## 11. Behavioral equivalence check for realistic preset

- [ ] 11.1 On a fresh DB, run `bun run seed:mock` with the pre-change code and snapshot per-Prisma-model row counts (users, books, games, media, posts by kind, chapters, shelves, realms, zones, translations).
- [ ] 11.2 On a fresh DB, run the post-change `bun run seed:mock` (realistic preset) and take the same snapshot.
- [ ] 11.3 Compare: aggregate row counts per model SHALL match within ±5%; per-work post-count distributions SHALL satisfy the `seed-power-law-distribution` realistic-mode scenarios. Document any intentional divergences in the PR description.
