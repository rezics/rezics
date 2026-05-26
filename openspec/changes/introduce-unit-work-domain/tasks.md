## 1. Schema And Contracts

- [ ] 1.1 Add contract literals and DTO schemas for `UnitWork`, `UnitWorkRole`, `UnitWorkDisplayPolicy`, `UnitWorkLanguageDefault`, and work-domain search metadata in `package/contract`.
- [ ] 1.2 Add Prisma models for `UnitWork` and `UnitWorkLanguageDefault` in `package/server/prisma/schema.prisma`.
- [ ] 1.3 Add indexes for `UnitWork(workUnitId, rank)`, `UnitWork(unitId)`, `UnitWork(workUnitId, language)`, and `UnitWorkLanguageDefault(workUnitId, language)`.
- [ ] 1.4 Add migration SQL to create `UnitWork` and `UnitWorkLanguageDefault`.
- [ ] 1.5 Backfill `UnitWork` from existing `Unit.workUnitId` values with idempotent conflict handling.
- [ ] 1.6 Add consistency checks that detect drift between `Unit.workUnitId` and canonical `UnitWork` during the migration period.
- [ ] 1.7 Rename `UnitTranslation.sourceReleaseUnitId` contract fields to `sourceUnitId`.
- [ ] 1.8 Add migration/backfill for `UnitTranslation.sourceReleaseUnitId -> sourceUnitId`.
- [ ] 1.9 Run `rg "sourceReleaseUnitId"` and migrate all server, contract, api, app, search, notify, and test call sites.

## 2. UnitWork Server Domain

- [ ] 2.1 Create `package/server/src/unit-work/` with `.api.ts`, `.service.ts`, `.mapper.ts`, and `.types.ts` following backend domain conventions.
- [ ] 2.2 Implement create/update/delete/list service methods for `UnitWork` memberships with same-type validation and no release-to-release nesting.
- [ ] 2.3 Implement `UnitWorkLanguageDefault` read/write service methods with validation that defaults point to active members of the same work.
- [ ] 2.4 Mount the UnitWork API from `package/server/src/index.ts`.
- [ ] 2.5 Update existing work-link services so new writes create/update `UnitWork` and keep `Unit.workUnitId` synchronized during migration.
- [ ] 2.6 Update release listing reads to use `UnitWork` and expose role, language, rank, and display policy.
- [ ] 2.7 Add unit tests for membership creation, duplicate membership rejection, invalid work target rejection, and language default validation.

## 3. RealmUnit Rename

- [ ] 3.1 Rename Prisma model and generated references from `RealmUnit` to `UnitRealm`.
- [ ] 3.2 Rename server service/API/mapper/type references from `realmUnit`/`RealmUnit` to `unitRealm`/`UnitRealm` without changing realm behavior.
- [ ] 3.3 Rename contract DTOs and request/response fields that explicitly name the relationship.
- [ ] 3.4 Rename `package/api` query keys, clients, and hooks that reference `RealmUnit`.
- [ ] 3.5 Rename frontend/admin call sites and tests that reference `RealmUnit`.
- [ ] 3.6 Run `rg "RealmUnit|realmUnit"` and remove or intentionally document any remaining compatibility references.
- [ ] 3.7 Add focused regression tests proving realm feed membership and cross-posting behavior did not change.

## 4. Interaction Target Projection

- [ ] 4.1 Add `targetWorkUnitId` to post/review contract DTOs and list/search options where needed.
- [ ] 4.2 Add database support or deterministic projection logic for `Post.targetWorkUnitId`.
- [ ] 4.3 Update post creation/update services to derive `targetWorkUnitId` from the target Unit's active `UnitWork` membership.
- [ ] 4.4 Update post list APIs to support work-domain feed queries by `targetWorkUnitId`.
- [ ] 4.5 Preserve exact-release post/review queries by `targetUnitId`.
- [ ] 4.6 Add tests for work-domain feed, exact-release feed, and standalone targets with no work domain.

## 5. Search Contracts And Index Settings

- [ ] 5.1 Extend `ContentSearchDocument` with `workUnitId`, `searchGroupId`, `ownTagIds`, `workTagIds`, `allTagIds`, `ownTagLabels`, `workTagLabels`, `allTagLabels`, `releaseRank`, `displayPolicy`, and `primaryForLanguages`.
- [ ] 5.2 Extend `PostSearchDocument` with `targetWorkUnitId`.
- [ ] 5.3 Update Meilisearch filterable attributes for content and post indexes to include work-domain fields.
- [ ] 5.4 Update search option schemas for grouped vs expanded release result presentation.
- [ ] 5.5 Add contract tests for the new search document fields.

## 6. Search Projection And Grouping

- [ ] 6.1 Update `package/search/src/sync.ts` content document building to load `UnitWork` membership and inherited work tags.
- [ ] 6.2 Populate `ownTagIds`, `workTagIds`, and `allTagIds` separately for release-aware documents.
- [ ] 6.3 Populate `searchGroupId = workUnitId ?? unitId` for all content documents.
- [ ] 6.4 Populate `releaseRank`, `displayPolicy`, and `primaryForLanguages` from `UnitWork` and `UnitWorkLanguageDefault`.
- [ ] 6.5 Update content search service filtering so tag filters use `allTagIds`.
- [ ] 6.6 Implement grouped result assembly that returns one default visible release per `searchGroupId` plus collapsed alternatives.
- [ ] 6.7 Implement expanded release search mode for release-specific filters.
- [ ] 6.8 Update post search sync to populate `targetWorkUnitId`.
- [ ] 6.9 Add search tests covering inherited work tag matches, grouped same-work releases, expanded release mode, and exact-release post filtering.

## 7. CDC And Job-Runner Batch Repair

- [ ] 7.1 Update CDC routing so `UnitWork` and `UnitWorkLanguageDefault` changes enqueue search projection jobs.
- [ ] 7.2 Update `UnitTag` change handling so work-level tag changes enqueue rebuilds for all active `UnitWork` members.
- [ ] 7.3 Update work translation/alias/searchable metadata change handling so affected release documents are rebuilt.
- [ ] 7.4 Implement idempotent batch handlers for rebuilding all release documents under one work.
- [ ] 7.5 Add batching limits and cursor/resume state for work domains with many releases.
- [ ] 7.6 Add admin/diagnostic repair entry points for rebuilding a single release, one work domain, and all work-domain projections.
- [ ] 7.7 Add job-runner tests for fan-out from work tag changes, single-release rebuild from `UnitWork` changes, and resumable batch processing.

## 8. Book Detail And Language UX

- [ ] 8.1 Update book detail route resolution so visible release Units are the ordinary public detail/read targets.
- [ ] 8.2 Update the book language switcher to resolve through `UnitWorkLanguageDefault` with documented fallbacks.
- [ ] 8.3 Update the release selector to list `UnitWork` members ordered by primary language defaults, rank, and display policy.
- [ ] 8.4 Add UI affordances for secondary and hidden-by-default releases without making them dominant.
- [ ] 8.5 Update book content loading so the active visible release controls the content structure.
- [ ] 8.6 Add frontend tests for language switching, missing language defaults, primary release ordering, and hidden-by-default release display.

## 9. Community Feed UX

- [ ] 9.1 Update release community tabs to show work-domain content by default when `UnitWork` membership exists.
- [ ] 9.2 Add an exact-release filter that switches the feed to `targetUnitId = currentReleaseId`.
- [ ] 9.3 Display precise target release context on work-domain feed items.
- [ ] 9.4 Add tests for default work-domain feed rendering and exact-release filtering.

## 10. Shelf UX And Hydration

- [ ] 10.1 Update shelf collection flows so release-aware collection stores the visible release Unit.
- [ ] 10.2 Add shelf hydration support for resolving `UnitWork` grouping metadata.
- [ ] 10.3 Update shelf rendering to group same-work releases by default.
- [ ] 10.4 Add release-expanded shelf display mode.
- [ ] 10.5 Add tests for collecting releases, grouped same-work rendering, and expanded release rendering.

## 11. Admin And Diagnostics

- [ ] 11.1 Add admin visibility into hidden work Units, their `UnitWork` members, and language defaults.
- [ ] 11.2 Add diagnostics for `UnitWork`/`Unit.workUnitId` drift during migration.
- [ ] 11.3 Add diagnostics for search projection drift between work tags and release documents.
- [ ] 11.4 Add warnings for unusually large work domains based on the configured release-count threshold.

## 12. Verification

- [ ] 12.1 Run `bun --filter=@rezics/contract test` or the package's targeted contract test command.
- [ ] 12.2 Run `bun --filter=@rezics/server test` for unit-work, post, shelf, tag, and realm rename coverage.
- [ ] 12.3 Run `bun --filter=@rezics/search test` for inherited tag and grouped search behavior.
- [ ] 12.4 Run `bun --filter=@rezics/api test` for API clients and query keys.
- [ ] 12.5 Run targeted app tests for book detail, release selector, language switcher, community feed, and shelf rendering.
- [ ] 12.6 Run `bun run check:convention`.
- [ ] 12.7 Run `bun run format:check`.
- [ ] 12.8 Run `openspec validate introduce-unit-work-domain --strict`.
