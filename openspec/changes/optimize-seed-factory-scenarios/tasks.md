## 1. Manifest Foundation

- [x] 1.1 Add `SeedManifestEntry`, `SeedResult`, and sync target types under `package/server/prisma/factory`.
- [x] 1.2 Update `runFactorySeed` to return `SeedResult` while preserving existing aggregate logging.
- [x] 1.3 Add base factory manifest entries for key works, posts, shelves, realms, zones, tags, users, and entities that are useful after normal preset runs.
- [x] 1.4 Add unit tests for manifest construction and duplicate entry handling.

## 2. CLI Flow

- [x] 2.1 Extend `package/utils/src/factory/command.ts` to parse Meili mode, scenario selection, all-scenarios/no-scenarios, and manifest format flags.
- [x] 2.2 Update interactive factory flow to collect Meili mode as a single-select choice.
- [x] 2.3 Update interactive factory flow to keep base preset selection single-select from the preset registry.
- [x] 2.4 Add special scenario multi-select with interactive scenarios selected by default.
- [x] 2.5 Keep non-interactive scenario execution explicit unless a package script passes all-scenarios.
- [x] 2.6 Add tests for CLI flag parsing and interactive option resolution helpers.

## 3. Meili Initialization And Targeted Sync

- [x] 3.1 Move or wrap existing Meili index initialization so factory can call it before database seeding when Meili mode is `init-and-sync`.
- [x] 3.2 Add a manifest-driven targeted sync dispatcher that deduplicates work by sync target and Unit ID.
- [x] 3.3 Wire targeted sync after base and special seeders finish when Meili mode is `init-and-sync`.
- [x] 3.4 Ensure Meili mode `skip` bypasses both initialization and synchronization.
- [x] 3.5 Add tests that verify targeted sync dispatch does not call full reindex functions by default.
- [x] 3.6 Add tests for derived sync targets such as shelf contained Unit metadata.

## 4. Special Scenario Registry

- [x] 4.1 Add a scenario registry under `package/server/prisma/factory` with scenario names, defaults, and runner functions.
- [x] 4.2 Add `large-post-tree` scenario with batched Unit/Post/support-language creation, deterministic sort paths, and root reply counts.
- [x] 4.3 Add `large-content-tree` scenario with a large book/content tree and materialized chapter Units.
- [x] 4.4 Add `large-history` scenario with a named Unit and many revision or structure-event records.
- [x] 4.5 Add `complex-shelf` scenario with mixed item kinds, relation rows, ordering data, and enough item volume for shelf tests.
- [ ] 4.6 Add focused scenario tests that verify topology counts and manifest entries.

## 5. Manifest Output

- [x] 5.1 Add human-readable manifest output with label, scenario, Unit type, and Unit ID.
- [x] 5.2 Add JSON manifest output for test automation.
- [x] 5.3 Add both-format output when requested.
- [x] 5.4 Document manifest examples in the factory seed README or relevant package docs.

## 6. Validation

- [x] 6.1 Run `bun test` for affected `package/utils` factory command tests.
- [x] 6.2 Run `bun test` for affected `package/server` factory tests.
- [x] 6.3 Run targeted `@rezics/search` tests for sync behavior.
- [x] 6.4 Run `bun run check:convention`.
- [ ] 6.5 Run a local smoke command with Meili skip.
- [ ] 6.6 Run a local smoke command with Meili init-and-sync when Meilisearch is available.
