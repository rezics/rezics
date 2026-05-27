## Context

The archived `introduce-unit-work-domain` change introduced `UnitWork` as the
canonical relation between visible releases, work-domain content, and hidden
work Units. The follow-up archive-gap change added generic
`ContentStructure(ownerUnitId)` and `ContentStructureNode(contentUnitId)` storage.

The current codebase is partially cut over:

- Prisma has `UnitWork`, but `Unit.workUnitId` is still read, written, exposed,
  synchronized, and used as a search/DTO fallback.
- `work-link` services, contracts, notifications, and route names still describe
  release-work mutation through the old direct-link concept.
- Generic content-structure code persists `contentUnitId`, but generic contracts,
  mappers, history payloads, and app helpers still emit or accept
  `chapterUnitId`.
- Book-specific reader/editor routes and chapter materialization are valid
  product concepts, but their compatibility language leaks into generic
  content-structure and history layers.

Because the project is in active development, the target is a clear internal
cutover rather than a long compatibility period.

## Goals / Non-Goals

**Goals:**

- Make `UnitWork` the only runtime source of work-domain membership.
- Remove `Unit.workUnitId` from Prisma schema and all package code after a
  verified backfill.
- Rename or isolate `work-link` behavior so any surviving claim flow is a
  `UnitWork` membership claim flow.
- Make generic content-structure DTOs, service payloads, history events, API
  clients, and reusable app helpers use `ownerUnitId` and `contentUnitId` only.
- Keep book/chapter product surfaces working while treating `chapterId` route
  params and chapter materialization names as book adapters over generic
  storage.
- Update tests and convention checks so old schema names cannot be reintroduced
  outside approved compatibility adapters.

**Non-Goals:**

- Do not redesign `UnitWork` roles, display policies, or hidden work semantics.
- Do not change the normalized `ContentStructureNode` tree model or LexoRank
  ordering.
- Do not redesign book reading routes in this change; route param names may stay
  for URL compatibility if they are locally documented adapters.
- Do not introduce a generic materialization framework for every content domain.
  Book chapter materialization remains book-specific.

## Decisions

### Drop `Unit.workUnitId` Instead Of Keeping It As A Denormalized Shortcut

`UnitWork(role = RELEASE)` is already indexed for release lookup and carries the
metadata that `Unit.workUnitId` cannot represent: role, language, position, and
display policy. Keeping both fields forces every read to define precedence and
creates drift diagnostics as permanent product code.

The migration path is:

1. Assert every non-null legacy `Unit.workUnitId` has a matching
   `UnitWork(role = RELEASE)` row.
2. Update code to read release membership only from `UnitWork`.
3. Stop writing `Unit.workUnitId` in `unit-work`, book creation, admin merge,
   work membership claims, search sync, and tests.
4. Drop the column and self-relation from Prisma and SQL migrations.
5. Remove drift views, diagnostics, and fallback tests.

Alternative considered: keep `Unit.workUnitId` as a denormalized cache. This was
rejected because the project is not yet carrying external compatibility needs,
and the cache does not cover multi-role membership semantics.

### Replace `work-link` Naming With `UnitWork` Membership Naming

The current work-link services can be preserved behaviorally, but their public
and internal names should no longer describe the canonical model. If a
cross-user approval flow remains, it should be named as a work membership claim
and its approval should create `UnitWork(role = RELEASE)`.

Alternative considered: leave `work-link` as user-facing wording while mapping
internally to `UnitWork`. This was rejected because new code will copy the old
language and accidentally revive the direct-link model.

### Keep Compatibility At Product Adapters, Not Generic Domains

Generic `ContentStructure` services should not emit `chapterUnitId` or
`BookContentStructure*` names. Book-specific adapters may translate legacy route
params or local component prop names where the UI remains explicitly a book
reader/editor surface.

The boundary is:

```txt
Generic layers:
  ContentStructure(ownerUnitId)
  ContentStructureNode(contentUnitId)
  contentStructure.content.batch

Book adapters:
  /book routes
  chapter materialization
  local route param compatibility
```

Alternative considered: keep dual fields in generic DTOs until every frontend
route changes. This was rejected because it makes the canonical contract
ambiguous and shifts compatibility cost into every future domain.

### Use Generic History Events As Canonical

Content-structure history should use `contentStructure.content.batch` and
operation payload fields such as `contentUnitId`, `beforeContentUnitId`, and
`afterContentUnitId`. The history service may read old
`book.contentStructure.batch` rows for existing fixtures or migrated data, but
new writes and DTO docs should be generic.

Alternative considered: keep `book.contentStructure.batch` as an alias in the
contract indefinitely. This was rejected because generic content structure is
intended for series/game/media structures too.

### Enforce The Cutover With Search And Convention Checks

Plain `rg` audits already found old names across packages. The implementation
should add targeted convention checks or existing `check:convention` assertions
for forbidden runtime references:

- `Unit.workUnitId` outside migrations/archive notes.
- `chapterUnitId` outside book/chapter compatibility adapters and legacy
  migration tests.
- `BookContentStructure` outside compatibility adapter names that are scheduled
  for removal.
- `work-link` outside explicit migration notes if the flow is renamed.

## Risks / Trade-offs

- [Risk] Dropping `Unit.workUnitId` before all membership rows are backfilled can
  orphan release grouping. -> Mitigation: add migration parity assertions and
  fail the migration if any non-null legacy work link lacks `UnitWork`.
- [Risk] Removing `chapterUnitId` from generic DTOs breaks app call sites that
  still read the compatibility field. -> Mitigation: migrate app helpers to
  `contentUnitIdForNode` backed by `contentUnitId` only, then remove the alias.
- [Risk] Renaming work-link APIs touches notify, API clients, tests, and route
  docs. -> Mitigation: perform a clear internal cutover and update all call
  sites in one change.
- [Risk] Generated route tree churn can obscure review. -> Mitigation: keep route
  path changes out of scope unless required by type generation.
- [Risk] Existing historical rows may contain `book.contentStructure.batch`. ->
  Mitigation: history readers may continue to display legacy rows, while new
  writes and canonical contracts use generic event names.

## Migration Plan

1. Add verification migrations or scripts that compare legacy
   `Unit.workUnitId` with `UnitWork(role = RELEASE)`.
2. Update server, search, job-runner, API, app, and tests to read `UnitWork`
   only.
3. Rename or retire work membership claim APIs/contracts/notifications.
4. Remove `chapterUnitId` emission/acceptance from generic content-structure and
   history contracts, then migrate app/API call sites.
5. Drop `Unit.workUnitId` and any compatibility views/diagnostics.
6. Run targeted package tests, `bun run check:convention`, `bun run
   format:check`, and `openspec validate cleanup-unit-work-content-structure-schema
   --strict`.

Rollback during development is a git revert plus database reset/migration
replay. No external production migration compatibility is required for this
development-stage cutover.

## Open Questions

- Should the renamed work membership claim endpoint keep an HTTP redirect or
  alias during local development, or should all internal callers move in one
  hard break?
- Should book route params stay named `$chapterId` permanently for URL
  compatibility, or should this change include route-level renames after the
  contract cleanup lands?
