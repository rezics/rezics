## Why

`introduce-unit-work-domain` and the follow-up archive-gap work moved the system
toward generic `ContentStructure` and canonical `UnitWork`, but live code still
keeps several legacy schema paths active. Because the project is still in
development, this change should complete the cutover now instead of preserving
long-lived compatibility layers that will keep new work aligned to old book-only
and work-link semantics.

## What Changes

- Make `UnitWork` the only canonical source for work-domain membership by
  removing live reads, writes, DTO fallback, diagnostics, and search projection
  fallback based on legacy `Unit.workUnitId`.
- **BREAKING**: Drop the legacy `Unit.workUnitId` migration column after
  backfill/parity checks confirm `UnitWork(role = RELEASE)` is complete.
- Rename or retire public/internal `work-link` naming so release-to-work changes
  are expressed as `UnitWork` membership or membership claims. Any retained
  endpoint must be explicitly marked as a temporary compatibility wrapper over
  `UnitWork`.
- Make the generic `ContentStructure` contract and server domain output only
  `contentUnitId` for content-node identity. `chapterUnitId` may remain only in
  book/chapter compatibility adapters during the migration window.
- **BREAKING**: Remove `chapterUnitId`, `beforeChapterUnitId`,
  `afterChapterUnitId`, and `BookContentStructure*` names from canonical
  content-structure and history payloads.
- Move app/API call sites that do not require book-specific adapter behavior to
  generic `contentStructure` query keys, clients, and types.
- Keep book reader/editor routes and chapter materialization behavior as
  book-specific product surfaces, but ensure they consume canonical
  `contentUnitId` and generic content-structure storage internally.
- Update tests, seeds, factories, Storybook fixtures, generated route references
  where needed, and conventions so new code cannot reintroduce old schema names.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `unit-work-domain`: Completes the cutover from legacy `Unit.workUnitId` and
  work-link semantics to canonical `UnitWork` membership.
- `content-structure`: Removes canonical `chapterUnitId`/`BookContentStructure`
  compatibility from generic contracts, service payloads, and internal call
  sites.
- `content-history-service`: Requires generic content-structure history event
  names and `contentUnitId` payload fields as the canonical history shape.
- `work-release`: Clarifies that release/work resolution reads `UnitWork` only,
  with hidden work Units remaining non-public aggregation domains.

## Impact

- `package/server`: Prisma schema and migrations, `unit-work`, `unit`,
  `book`, `chapter`, `content-structure`, history outbox writing, search enqueue
  callers, factories, and seed helpers.
- `package/contract`: `unit-work`, `unit/work-link`, `book`,
  `content-structure`, `chapter`, `content-history`, progress, Meilisearch, and
  notification schemas/types.
- `package/api`: work-domain clients/query keys, content-structure clients,
  book compatibility wrappers, chapter materialization clients, and affected
  invalidation keys.
- `package/app`: book reader/editor, chapter list/tree/progress components,
  book history rendering, review/excerpt/remark call sites, fixtures, and route
  param adapters.
- `package/search`: content/post document builders and filter options that still
  use legacy `Unit.workUnitId` fallback.
- `package/job-runner`: CDC/search repair handlers and admin work merge handlers
  that must read/write only `UnitWork`.
- `package/notify`: work membership claim email/system notification naming if
  the claim flow remains.
- Migrations: backfill assertions must run before dropping compatibility columns
  or fields. Since this is a development-stage project, internal API and DTO
  breakage is acceptable when all internal call sites are updated in the same
  change.
