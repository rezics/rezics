## 1. Contract And Capability Types

- [x] 1.1 Add `SeriesKind` contract literals for `book_series`, `game_series`, `film_series`, `media_series`, `franchise`, and `universe` with documentation comments defining franchise, universe, and excluded internal grouping kinds.
- [x] 1.2 Add Series DTO, create/update input, list/filter option, and detail schemas in `package/contract`.
- [x] 1.3 Add contract schema/types for release-first Series content nodes and direct `SeriesContentIndex` rows, documenting direct release membership and non-transitive nested Series references.
- [x] 1.4 Extend contract `UnitWorkRole` vocabulary with `SERIES` and document that Series work-domain projection is derived from direct release nodes only.
- [x] 1.5 Add representative-release selection DTOs and reason literals for explicit selection, primary/canonical release, translation coverage, source quality, display completeness, and deterministic fallback.
- [x] 1.6 Add content-structure eligibility hints for Series content nodes, including counted release member nodes and any allowed nested Series reference nodes.
- [x] 1.7 Add contract tests for Series kind validation, release-first member validation, nested Series non-transitivity, Series content index serialization, representative-release DTOs, and `SERIES` work role validation.

## 2. Database And Migrations

- [x] 2.1 Add Prisma model and migration SQL for the Series extension row linked to `Unit(type = SERIES)`.
- [x] 2.2 Add Prisma model and migration SQL for `SeriesContentIndex(seriesUnitId, releaseUnitId, contentNodeId)` with indexes for series-to-release and release-to-series lookups.
- [x] 2.3 Add constraints or service-level validation that `SeriesContentIndex` stores no path, depth, ordering, hierarchy, Work Unit, or work-domain source fields.
- [x] 2.4 Extend `UnitWork` role storage/validation to allow `SERIES` after the `introduce-unit-work-domain` dependency is available.
- [x] 2.5 Generalize content-structure storage if the physical schema is still book-specific and Series cannot attach generic release member nodes.
- [x] 2.6 Add migration or seed-factory verification for Series extension rows, direct release nodes, direct index rows, representative-release examples, and `UnitWork(role = SERIES)` projection.

## 3. Server Series Domain

- [x] 3.1 Add Series service, mapper, types, and API modules under `package/server/src` following existing domain naming conventions.
- [x] 3.2 Implement Series create/update/read/list flows that create `Unit(type = SERIES)` plus the Series extension row.
- [x] 3.3 Implement Series content-structure write paths for counted release member nodes and allowed nested Series reference nodes.
- [x] 3.4 Implement Series content-structure history writes for add, remove, move, label, metadata, and representative-release replacement operations.
- [x] 3.5 Implement direct `SeriesContentIndex` reconciliation from counted release member nodes only.
- [x] 3.6 Implement server validation that Work Units are not stored as direct counted Series member nodes.
- [x] 3.7 Implement server validation that nested Series references do not recursively expand into Series content index rows.
- [x] 3.8 Implement `UnitWork(role = SERIES)` reconciliation from direct release nodes through each release's canonical `UnitWork(role = RELEASE)` work.
- [x] 3.9 Implement work merge/move repair hooks for Series content index rows and Series work-domain projection rows.
- [x] 3.10 Mount Series APIs from `package/server/src/index.ts`.
- [x] 3.11 Add targeted server tests for Series creation, release member nodes, nested Series non-transitivity, history writes, direct index repair, representative-release writes, and work-domain projection.

## 4. Representative Release And Work Maintenance

- [x] 4.1 Implement representative-release selection service logic using explicit editor selection, primary/canonical release, translation coverage, source quality, display completeness, and deterministic fallback.
- [x] 4.2 Add API endpoint or service method that explains representative-release suggestions and alternatives for a work domain.
- [x] 4.3 Add or update Work maintenance DTO contracts so Work Units can expose abstract title/identity metadata, including Work `UnitTranslation` where appropriate, without becoming ordinary search results or valid direct Series members.
- [x] 4.4 Add server read/write support for Work maintenance title/identity metadata and verify Work `UnitTranslation` is handled as abstract Work identity rather than ordinary release display metadata.
- [x] 4.5 Add tests that work-level Series add flows store representative release nodes and never store hidden Work Units as Series member nodes.
- [x] 4.6 Add guardrail tests or convention checks that direct Work-targeted interactions and relationships require explicit human-confirmed design before implementation.

## 5. Search And Projection

- [x] 5.1 Update search document builders so release documents can project direct Series metadata derived from release member nodes.
- [x] 5.2 Ensure ordinary library search does not emit Work Units as result cards.
- [x] 5.3 Add search projection support for direct Series release lookup fields without using nested Series recursive expansion.
- [x] 5.4 Update Meilisearch filterable/searchable attributes if Series filters or labels are added to release documents.
- [x] 5.5 Add search tests for direct Series metadata, representative release projection, nested Series non-transitivity, and Work result exclusion.

## 6. Job Runner And Repair

- [x] 6.1 Add job-runner repair task for rebuilding `SeriesContentIndex` from counted direct release member nodes.
- [x] 6.2 Add job-runner repair task for rebuilding `UnitWork(role = SERIES)` from direct release nodes that resolve to work domains.
- [x] 6.3 Add CDC/outbox routing so Series content-structure changes enqueue index repair, work-domain projection repair, and search rebuilds.
- [x] 6.4 Add repair handling for work merge/move so stale Series work-domain projection rows are removed or redirected.
- [x] 6.5 Add diagnostics for parent Series that reference nested Series but do not directly contain expected representative releases.
- [x] 6.6 Add diagnostics for Series member releases with weak display quality, missing translation coverage, or better representative release candidates.
- [x] 6.7 Add job-runner tests for repair idempotency, nested Series non-recursion, representative-release drift, and work merge projection cleanup.

## 7. API Client, Admin, And Frontend Readiness

- [x] 7.1 Add `package/api` clients, query keys, and mutation helpers for Series detail, Series content edits, direct release lookup, representative-release selection, and related Series by work domain.
- [x] 7.2 Add admin-facing endpoints or service methods for Series diagnostics, content index drift, work-domain projection drift, and representative-release review.
- [x] 7.3 Add frontend data integration placeholders for the library content edit layout's dedicated Series management page.
- [x] 7.4 Add frontend data integration placeholders for `work/:unitId` abstract pages that show Work maintenance context and release-list resolution without Work slug lookup.
- [x] 7.5 Add frontend data integration placeholders for Work maintenance editing of abstract title/identity metadata, including Work `UnitTranslation` editing with Work-specific handling.
- [x] 7.6 Add frontend data integration placeholders for release edit flows that add the current release to Series.
- [x] 7.7 Add frontend data integration placeholders for release edit flows that add the current release's work through representative-release selection.
- [x] 7.8 Document that season groups, episode groups, arcs, discs, tracks, and source-specific orderings are content-structure metadata, not Series kinds.
- [x] 7.9 Document that any new direct Work-targeted relation or interaction must stop for explicit design review and human confirmation.

## 8. Verification

- [x] 8.1 Run targeted contract tests for Series kinds, Series DTOs, release-first Series content nodes, Series content index DTOs, representative-release DTOs, and `SERIES` work role.
- [x] 8.2 Run targeted server tests for Series services, content-structure writes, history, index reconciliation, representative-release selection, Work maintenance writes with Work-specific `UnitTranslation` handling, Work interaction guardrails, and work-domain projection.
- [x] 8.3 Run targeted search tests for Series metadata projection and Work result exclusion.
- [x] 8.4 Run targeted job-runner tests for Series index and projection repair.
- [x] 8.5 Run `bun run check:convention` and fix repo convention violations introduced by the change.
- [x] 8.6 Run `bun run format:check` or format changed files with Biome.
- [x] 8.7 Search for public `series` and `work` contract exports and migrate internal callsites intentionally if this change renames or replaces any existing public types.
