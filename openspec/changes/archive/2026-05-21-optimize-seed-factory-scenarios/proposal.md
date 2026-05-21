## Why

The factory seed flow currently produces broad demo data but does not create named edge-case fixtures, does not initialize and synchronize Meilisearch as part of the same workflow, and does not output stable Unit identifiers for follow-up testing. This makes local verification of large post trees, large content trees, deep history timelines, and complex shelves slow and manual.

## What Changes

- Add a manifest-driven factory result that records important seeded Units with labels, Unit types, Unit IDs, source scenario, and intended search sync targets.
- Add a Meili mode to the factory flow:
  - `init-and-sync`: initialize Meilisearch indexes before database seeding, then targeted-sync seeded manifest entries after all base and special factory data is created.
  - `skip`: skip both Meilisearch initialization and search sync.
- Replace the current interactive factory single-choice flow with a staged flow:
  - base preset remains single-select;
  - Meili mode is single-select;
  - special factory scenarios are multi-select and default to selected in interactive mode.
- Add special factory scenarios that run after the base preset:
  - large post tree;
  - large content tree;
  - large history;
  - complex shelf.
- Add non-interactive CLI flags for Meili mode, scenario selection, and manifest output.
- Add targeted Meili synchronization from the manifest instead of defaulting to full reindex after seeding.
- Preserve full Meili reindex as an explicit drift-repair/admin path outside the default factory workflow.

## Capabilities

### New Capabilities

- `seed-factory-scenarios`: Special factory scenarios, manifest output, Meili mode selection, and targeted post-seed search sync.

### Modified Capabilities

- `seed-preset-library`: Factory preset selection remains the base data shape, but interactive factory selection gains additional staged choices around Meili mode and special scenarios.
- `seed-plan-modes`: The base `SeedPlan` remains focused on broad count distribution; named edge-case fixtures are modeled as post-preset scenarios instead of expanding `SeedPlan`.
- `meili-partial-sync`: Targeted factory sync uses single-unit search sync functions and required derived patch behavior rather than full index rebuilds.

## Impact

- Affected packages:
  - `package/utils`: factory CLI parsing, interactive selection, Meili mode handling, scenario selection, and manifest output.
  - `package/server`: factory orchestrator return shape, scenario seeders, and manifest entry construction.
  - `package/search`: targeted sync dispatcher reuse or small helper additions for manifest-driven sync.
  - `package/contract`: only affected if manifest output types are promoted to shared contracts; otherwise no contract change is required.
- Affected systems:
  - server PostgreSQL seed data;
  - auth/server baseline seed flow;
  - Meilisearch index initialization and targeted document synchronization;
  - history service data only for the large-history scenario.
- Backward compatibility:
  - Existing package scripts such as `seed:factory`, `seed:factory:fast`, and `seed:factory:medium` should continue to work.
  - Existing preset names and plan file validation should remain valid.
  - Interactive defaults may create additional special scenario data unless the user deselects those scenarios.
  - Non-interactive scripts should require explicit scenario flags for special fixtures unless a package script deliberately opts into all scenarios.
- Migration:
  - No durable data migration is required. This is a development seed workflow change.
