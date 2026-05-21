## 1. Manifest Foundation

- [ ] 1.1 Add `SeedManifestEntry`, `SeedResult`, and sync target types under `package/server/prisma/factory`.
- [ ] 1.2 Update `runFactorySeed` to return `SeedResult` while preserving existing aggregate logging.
- [ ] 1.3 Add base factory manifest entries for key works, posts, shelves, realms, zones, tags, users, and entities that are useful after normal preset runs.
- [ ] 1.4 Add unit tests for manifest construction and duplicate entry handling.

## 2. CLI Flow

- [ ] 2.1 Extend `package/utils/src/factory/command.ts` to parse Meili mode, scenario selection, all-scenarios/no-scenarios, and manifest format flags.
- [ ] 2.2 Update interactive factory flow to collect Meili mode as a single-select choice.
- [ ] 2.3 Update interactive factory flow to keep base preset selection single-select from the preset registry.
- [ ] 2.4 Add special scenario multi-select with interactive scenarios selected by default.
- [ ] 2.5 Keep non-interactive scenario execution explicit unless a package script passes all-scenarios.
- [ ] 2.6 Add tests for CLI flag parsing and interactive option resolution helpers.

## 3. Meili Initialization And Targeted Sync

- [ ] 3.1 Move or wrap existing Meili index initialization so factory can call it before database seeding when Meili mode is `init-and-sync`.
- [ ] 3.2 Add a manifest-driven targeted sync dispatcher that deduplicates work by sync target and Unit ID.
- [ ] 3.3 Wire targeted sync after base and special seeders finish when Meili mode is `init-and-sync`.
- [ ] 3.4 Ensure Meili mode `skip` bypasses both initialization and synchronization.
- [ ] 3.5 Add tests that verify targeted sync dispatch does not call full reindex functions by default.
- [ ] 3.6 Add tests for derived sync targets such as shelf contained Unit metadata.

## 4. Special Scenario Registry

- [ ] 4.1 Add a scenario registry under `package/server/prisma/factory` with scenario names, defaults, and runner functions.
- [ ] 4.2 Add `large-post-tree` scenario with batched Unit/Post/support-language creation, deterministic sort paths, and root reply counts.
- [ ] 4.3 Add `large-content-tree` scenario with a large book/content tree and materialized chapter Units.
- [ ] 4.4 Add `large-history` scenario with a named Unit and many revision or structure-event records.
- [ ] 4.5 Add `complex-shelf` scenario with mixed item kinds, relation rows, ordering data, and enough item volume for shelf tests.
- [ ] 4.6 Add focused scenario tests that verify topology counts and manifest entries.

## 5. Manifest Output

- [ ] 5.1 Add human-readable manifest output with label, scenario, Unit type, and Unit ID.
- [ ] 5.2 Add JSON manifest output for test automation.
- [ ] 5.3 Add both-format output when requested.
- [ ] 5.4 Document manifest examples in the factory seed README or relevant package docs.

## 6. Validation

- [ ] 6.1 Run `bun test` for affected `package/utils` factory command tests.
- [ ] 6.2 Run `bun test` for affected `package/server` factory tests.
- [ ] 6.3 Run targeted `@rezics/search` tests for sync behavior.
- [ ] 6.4 Run `bun run check:convention`.
- [ ] 6.5 Run a local smoke command with Meili skip.
- [ ] 6.6 Run a local smoke command with Meili init-and-sync when Meilisearch is available.
