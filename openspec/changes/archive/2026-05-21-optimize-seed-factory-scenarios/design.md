## Context

The current factory seed flow is centered on a single base preset and a `SeedPlan` count model. `package/utils/src/factory/index.ts` resets the auth and server databases, seeds baseline data, constructs a factory context, then calls `runFactorySeed(ctx, plan)`. `runFactorySeed` currently returns `void` and only prints aggregate counts.

Search synchronization already has single-index and single-unit primitives in `@rezics/search`, plus full reindex functions for content, posts, realms, entities, and users. The factory workflow does not currently initialize Meilisearch before seeding or synchronize the Units it creates afterward. The result is a manual post-seed search setup step and unnecessary full-index sync work for local factory runs.

The existing `SeedPlan` is a good fit for broad population shape. It is not a good fit for named edge-case fixtures such as "the large post tree to test thread pagination" or "the complex shelf to test relation rendering." Those fixtures need stable labels and output Unit IDs more than they need to participate in the broad count distribution.

Target flow:

```txt
factory CLI
  ├─ choose Meili mode: init-and-sync | skip
  ├─ choose base preset
  ├─ choose special scenarios
  │
  ├─ if init-and-sync: initialize Meili indexes
  ├─ seed baseline
  ├─ run base factory preset -> manifest entries
  ├─ run selected special scenarios -> manifest entries
  ├─ if init-and-sync: targeted-sync manifest entries
  └─ print manifest
```

## Goals / Non-Goals

**Goals:**

- Keep base preset selection as the broad factory data source.
- Add special scenarios as independent post-preset seeders.
- Make special scenarios selectable through interactive multi-select and non-interactive flags.
- Initialize Meili before database seeding when Meili mode is enabled.
- Always targeted-sync seeded manifest entries after all seeding when Meili mode is enabled.
- Output a human-readable and machine-readable manifest of important fixture Units.
- Preserve full Meili reindex as an explicit drift-repair operation, not the default factory path.

**Non-Goals:**

- Do not make special scenario topology part of `SeedPlan`.
- Do not introduce a new search queue or CDC system.
- Do not replace existing full reindex admin functions.
- Do not require Meilisearch for users who explicitly choose the skip mode.
- Do not guarantee production-grade volume benchmarking from factory scenarios; they are deterministic development fixtures.

## Decisions

### Decision: Meili mode is init-and-sync or skip

The factory CLI will expose a single Meili mode, not separate init and sync toggles.

Modes:

- `init-and-sync`: initialize Meili index settings before database seeding, then targeted-sync the final manifest after base and special seeders complete.
- `skip`: skip both index initialization and sync.

Rationale:

- The user-visible seed output must be searchable when Meili is enabled.
- Meili settings must exist before post-seed targeted sync.
- Separate init/sync toggles would create invalid combinations such as "sync without init" or "init but silently leave seeded data unsynced."

Alternatives considered:

- Separate `--meili-init` and `--sync` flags: rejected because it exposes invalid states.
- Full reindex after seed: rejected for the default path because the factory already knows exactly which Units it created.

### Decision: Manifest is the boundary between seeders and sync

Base factory and special scenario seeders will append `SeedManifestEntry` records to a `SeedResult`. The manifest is both the user-facing output and the input to targeted sync.

Conceptual shape:

```ts
interface SeedManifestEntry {
  label: string;
  scenario?: string;
  unitType: UnitType;
  unitId: string;
  syncTargets: Array<"content" | "post" | "realm" | "user" | "entity">;
  notes?: string;
}
```

Rationale:

- The same data answers "what did seed create?" and "what should sync touch?"
- Special fixtures become easy to copy into manual test URLs or automated smoke tests.
- The factory can remain package-local without immediately promoting manifest types to `@rezics/contract`.

Alternatives considered:

- Print IDs directly from each seeder: rejected because sync needs structured data and test automation needs stable output.
- Infer sync targets by re-querying all Units after seed: rejected because it loses fixture labels and recreates a full-sync shape.

### Decision: Special scenarios run after the base preset

Special factory scenarios will be separate seeders invoked after `runFactorySeed` completes. Interactive mode will show them as a multi-select with scenarios selected by default. Non-interactive mode will run only explicitly requested scenarios unless a script passes an all-scenarios flag.

Rationale:

- Base presets stay compatible with existing seed profiles.
- Scenarios can depend on the base world, such as users, works, tags, and realms.
- Edge-case fixtures get stable labels without distorting regular demo data.

Alternatives considered:

- Add many more `SeedPlan` fields: rejected because the plan would mix broad count distribution with named topology fixtures.
- Create each edge case as a full preset: rejected because special fixtures should compose with `fast`, `medium`, and `realistic`.

### Decision: Targeted sync dispatches from manifest sync targets

The post-seed sync step will deduplicate manifest entries by index target and Unit ID, then call existing single-unit sync functions such as `syncSingleContent`, `syncSinglePost`, `syncSingleRealm`, `syncSingleEntity`, and user sync equivalents where available.

Derived patches are part of the target list when needed. For example, a complex shelf should sync the shelf content document and patch its contained unit ids; a post tree should sync post documents and any content documents explicitly listed in the manifest.

Rationale:

- The workflow avoids scanning the whole database.
- The manifest makes sync cost proportional to the seed fixture surface.
- Existing idempotent single-unit sync functions already model "sync current projection from DB."

Alternatives considered:

- Call `syncAllContent`, `syncAllPosts`, and related full sync functions: rejected for the default factory flow due to avoidable latency.
- Update Meili inline during each insert: rejected because seeders should finish DB writes first and sync final current state.

### Decision: Scenario seeders own their fixture topology

Each special scenario will own a small typed config, default values, and manifest labels:

- `large-post-tree`: creates one target work/thread with many posts, controlled depth, branching, sort paths, and root reply counts.
- `large-content-tree`: creates one book/content tree with many nodes and materialized chapter Units.
- `large-history`: creates one Unit with many revision and/or structure event rows, targeting history timeline pagination.
- `complex-shelf`: creates one shelf with mixed work/review items, relation rows, ordering boundaries, and enough item volume for shelf UI and query tests.

Rationale:

- Each edge case has domain-specific invariants.
- The scenario name becomes the stable grouping key in the manifest.
- Scenario tests can verify concrete topology instead of broad counts.

## Risks / Trade-offs

- [Risk] Targeted sync misses derived documents affected by a scenario. -> Mitigation: require scenario seeders to declare explicit `syncTargets` and add tests for each scenario's expected search documents.
- [Risk] Interactive defaults create more data than users expect. -> Mitigation: show a multi-select summary before execution and keep non-interactive special scenarios explicit.
- [Risk] Meili unavailable blocks factory runs by default. -> Mitigation: provide `--meili=skip` and a clear error when `init-and-sync` cannot initialize indexes.
- [Risk] Large scenario seeders become slow if implemented with row-by-row creates. -> Mitigation: use existing batch patterns and cap createMany batches to the seed performance rules.
- [Risk] History scenario spans server and history databases. -> Mitigation: model direct history fixture writes separately from outbox backlog tests and document env requirements.

## Migration Plan

1. Introduce manifest types and return `SeedResult` from the factory orchestrator while keeping existing aggregate logging.
2. Add CLI parsing for Meili mode, scenario selection, and manifest format.
3. Add interactive staged selection: Meili mode, preset, scenarios, optional plan tweak, confirmation.
4. Add special scenario registry and initial scenario seeders.
5. Add targeted sync dispatcher and wire it after all seeding when Meili mode is `init-and-sync`.
6. Add manifest output in human and JSON formats.
7. Update package scripts only where explicit all-scenario behavior is desired.

Rollback strategy:

- Revert factory CLI to call `runFactorySeed(ctx, plan)` and ignore manifest output.
- Scenario seeders create development data only, so no durable migration rollback is required.

## Open Questions

- Should package scripts such as `seed:factory` opt into all special scenarios, or should they remain base-only in non-interactive mode?
- Should the history scenario write directly to the history database, create main DB outbox backlog rows, or support both via sub-mode?
- Should the manifest type remain local to `package/server/prisma/factory`, or should a small output schema live in `package/contract` for external tooling?
