## Why

The app package currently splits the Entity frontend into several top-level
features even though the Entity page surface is small and tightly coupled.
This creates navigation and import overhead without the clear workflow
separation that justifies the larger Book feature split.

This change consolidates Entity page code into one `entity` feature while
keeping `entity-picker` as a reusable cross-feature picker boundary.

## What Changes

- Move Entity detail, edit, and self-claim page code under
  `package/app/src/entity`.
- Keep `package/app/src/entity-picker` as a separate feature because it is
  reused outside Entity pages, especially attribution editing flows.
- Remove the old `entity-detail`, `entity-edit`, and `entity-self-claim`
  feature entrypoints after internal callsites are updated.
- Preserve existing routes, lazy route behavior where practical, page behavior,
  API contracts, and user-facing functionality.
- Keep app feature layering intact: `models/` remains pure, pages stay route
  entry components, sections compose business UI, and shared identity UI remains
  exported through the feature index.
- No backend, contract, API DTO, or database behavior changes are introduced.

## Capabilities

### New Capabilities

- `app-entity-feature-architecture`: Defines the intended app package feature
  boundary for Entity pages and the separate reusable EntityPicker boundary.

### Modified Capabilities

- None.

## Impact

- Affected packages:
  - `package/app`: Entity feature folders, route lazy imports, internal imports,
    and convention checks.
- Not affected:
  - `package/contract`, `package/api`, `package/server`, `package/search`, and
    `package/admin`.
- Backward compatibility:
  - No user-facing compatibility requirement changes. This is an internal
    development-stage refactor and all internal app callsites should be updated
    in the same change.
- Migration:
  - No data migration is required.
- Validation:
  - Run app/package TypeScript or affected tests if available.
  - Run `bun run check:convention`.
  - Run `bun run format:check`.
