## 1. Schema And Contracts

- [x] 1.1 Add contract literals and DTO schemas for `UnitWork`, `UnitWorkRole`, `UnitWorkDisplayPolicy`, and work-domain search metadata in `package/contract`.
- [x] 1.2 Add Prisma model for `UnitWork` in `package/server/prisma/schema.prisma`.
- [x] 1.3 Add indexes for `UnitWork(workUnitId, role, position, unitId)`, `UnitWork(workUnitId, role, createdAt, unitId)`, `UnitWork(unitId, role, workUnitId)`, and role-specific release uniqueness.
- [x] 1.4 Add migration SQL to create `UnitWork`.
- [x] 1.5 Backfill `UnitWork` from existing `Unit.workUnitId` values with idempotent conflict handling.
- [x] 1.6 Add consistency checks that detect drift between `Unit.workUnitId` and canonical `UnitWork` during the migration period.
- [x] 1.7 Rename `UnitTranslation.sourceReleaseUnitId` contract fields to `sourceUnitId`.
- [x] 1.8 Add migration/backfill for `UnitTranslation.sourceReleaseUnitId -> sourceUnitId`.
- [x] 1.9 Run `rg "sourceReleaseUnitId"` and migrate all server, contract, api, app, search, notify, and test call sites.

## 2. UnitWork Server Domain

- [x] 2.1 Create `package/server/src/unit-work/` with `.api.ts`, `.service.ts`, `.mapper.ts`, and `.types.ts` following backend domain conventions.
- [x] 2.2 Implement create/update/delete/list service methods for `UnitWork` memberships with role validation, release-only canonical uniqueness, and no release-to-release nesting.
- [x] 2.3 Implement work-domain membership reconciliation helpers for content Units that may belong to multiple works.
- [x] 2.4 Mount the UnitWork API from `package/server/src/index.ts`.
- [x] 2.5 Update existing work-link services so new writes create/update `UnitWork` and keep `Unit.workUnitId` synchronized during migration.
- [x] 2.6 Update release listing reads to use `UnitWork` and expose role, language, position, and display policy.
- [x] 2.7 Add unit tests for membership creation, duplicate release membership rejection, multi-work content membership, invalid work target rejection, and position ordering.

## 3. RealmUnit Rename

- [x] 3.1 Rename Prisma model and generated references from `RealmUnit` to `UnitRealm`.
- [x] 3.2 Rename server service/API/mapper/type references from `realmUnit`/`RealmUnit` to `unitRealm`/`UnitRealm` without changing realm behavior.
- [x] 3.3 Rename contract DTOs and request/response fields that explicitly name the relationship.
- [x] 3.4 Rename `package/api` query keys, clients, and hooks that reference `RealmUnit`.
- [x] 3.5 Rename frontend/admin call sites and tests that reference `RealmUnit`.
- [x] 3.6 Run `rg "RealmUnit|realmUnit"` and remove or intentionally document any remaining compatibility references.
- [x] 3.7 Add focused regression tests proving realm feed membership and cross-posting behavior did not change.

## 4. Interaction Target Projection

- [x] 4.1 Add post/review contract DTOs and list/search options for work-domain feed queries backed by `UnitWork` membership.
- [x] 4.2 Add service support for registering post/review Units in `UnitWork` when they target release-aware Units.
- [x] 4.3 Update post creation/update services to derive `UnitWork` content memberships from the target Unit's active release work membership.
- [x] 4.4 Update post list APIs to support work-domain feed queries through `UnitWork(workUnitId, role)`.
- [x] 4.5 Preserve exact-release post/review queries by `targetUnitId`.
- [x] 4.6 Add tests for work-domain feed, exact-release feed, and standalone targets with no work domain.

## 5. Search Contracts And Index Settings

- [x] 5.1 Extend `ContentSearchDocument` with `workUnitId`, `searchGroupId`, `ownTagIds`, `workTagIds`, `allTagIds`, `ownTagLabels`, `workTagLabels`, `allTagLabels`, `position`, and `displayPolicy`.
- [x] 5.2 Extend post/content search metadata with generic work-domain membership fields derived from `UnitWork` where needed.
- [x] 5.3 Update Meilisearch filterable attributes for content and post indexes to include work-domain fields.
- [x] 5.4 Update search option schemas for grouped vs expanded release result presentation.
- [x] 5.5 Add contract tests for the new search document fields.

## 6. Search Projection And Grouping

- [x] 6.1 Update `package/search/src/sync.ts` content document building to load `UnitWork` membership and inherited work tags.
- [x] 6.2 Populate `ownTagIds`, `workTagIds`, and `allTagIds` separately for release-aware documents.
- [x] 6.3 Populate `searchGroupId = workUnitId ?? unitId` for all content documents.
- [x] 6.4 Populate `position` and `displayPolicy` from `UnitWork`.
- [x] 6.5 Update content search service filtering so tag filters use `allTagIds`.
- [x] 6.6 Implement grouped result assembly that returns one default visible release per `searchGroupId` plus collapsed alternatives.
- [x] 6.7 Implement expanded release search mode for release-specific filters.
- [x] 6.8 Update post search sync and work-domain feed search to use `UnitWork` membership.
- [x] 6.9 Add search tests covering inherited work tag matches, grouped same-work releases, expanded release mode, and exact-release post filtering.

## 7. CDC And Job-Runner Batch Repair

- [x] 7.1 Update CDC routing so `UnitWork` changes enqueue search projection jobs.
- [x] 7.2 Update `UnitTag` change handling so work-level tag changes enqueue rebuilds for all active `UnitWork` members.
- [x] 7.3 Update work translation/alias/searchable metadata change handling so affected release documents are rebuilt.
- [x] 7.4 Implement idempotent batch handlers for rebuilding all release documents under one work.
- [x] 7.5 Add batching limits and cursor/resume state for work domains with many releases.
- [x] 7.6 Add admin/diagnostic repair entry points for rebuilding a single release, one work domain, and all work-domain projections.
- [x] 7.7 Add job-runner tests for fan-out from work tag changes, single-release rebuild from `UnitWork` changes, and resumable batch processing.

## 8. Book Detail And Language UX

- [x] 8.1 Update book detail route resolution so visible release Units are the ordinary public detail/read targets.
- [x] 8.2 Update the book language switcher to remain scoped to the current release's `UnitTranslation` rows and show a missing-language Releases tab affordance.
- [x] 8.3 Update the Releases tab to list `UnitWork(role = RELEASE)` members with multi-select language filtering, an All option, and `position` ordering.
- [x] 8.4 Add UI affordances for secondary and hidden-by-default releases without making them dominant.
- [x] 8.5 Update book content loading so the active visible release controls the content structure.
- [x] 8.6 Add frontend tests for release-local language switching, missing-language Releases tab navigation, language filtering, position ordering, and hidden-by-default release display.

## 9. Community Feed UX

- [x] 9.1 Update release community tabs to show work-domain content by default when `UnitWork` membership exists.
- [x] 9.2 Add an exact-release filter that switches the feed to `targetUnitId = currentReleaseId`.
- [x] 9.3 Display precise target release context on work-domain feed items whenever the target release differs from the current release.
- [x] 9.4 Add tests for default work-domain feed rendering and exact-release filtering.

## 10. Shelf UX And Hydration

- [ ] 10.1 Update shelf collection flows so release-aware collection stores the visible release Unit.
- [ ] 10.2 Add shelf membership reconciliation that registers shelf Units in `UnitWork(role = SHELF)` for every work represented by contained releases.
- [ ] 10.3 Update work-domain shelf surfaces to render precise contained release context when it differs from the current release.
- [ ] 10.4 Add release move/work merge repair for shelf work memberships.
- [ ] 10.5 Add tests for collecting releases, multi-work shelf membership, membership recalculation, and work-domain shelf card target context.

## 11. Admin And Diagnostics

- [ ] 11.1 Add admin visibility into hidden work Units, their `UnitWork` members, roles, positions, and repair state.
- [x] 11.2 Add diagnostics for `UnitWork`/`Unit.workUnitId` drift during migration.
- [ ] 11.3 Add diagnostics for search projection drift between work tags and release documents.
- [ ] 11.4 Add warnings for unusually large work domains based on the configured release-count threshold.

## 12. Verification

- [x] 12.1 Run `bun --filter=@rezics/contract test` or the package's targeted contract test command.
- [ ] 12.2 Run `bun --filter=@rezics/server test` for unit-work, post, shelf, tag, and realm rename coverage.
- [ ] 12.3 Run `bun --filter=@rezics/search test` for inherited tag and grouped search behavior.
- [ ] 12.4 Run `bun --filter=@rezics/api test` for API clients and query keys.
- [ ] 12.5 Run targeted app tests for book detail, release selector, language switcher, community feed, and shelf rendering.
- [x] 12.6 Run `bun run check:convention`.
- [x] 12.7 Run `bun run format:check`.
- [x] 12.8 Run `openspec validate introduce-unit-work-domain --strict`.

## 13. Creation Work Matching UX

- [ ] 13.1 Add contract/API support for creation-time work matching using ordinary content search results with canonical work metadata.
- [ ] 13.2 Update public catalog creation UI to prominently prompt users to search for existing works/releases before creating new release-aware content.
- [ ] 13.3 Update personal creation UI to show quieter work-matching guidance through the work row help affordance.
- [ ] 13.4 When a matched release already belongs to a work, bind the new release to the matched release's canonical work.
- [ ] 13.5 When a matched release is standalone, support creating/reusing a hidden work domain for the matched release plus the new release.
- [ ] 13.6 Show selected work context with same-work releases and work tag summary before or after binding confirmation.
- [ ] 13.7 Add tests for public guidance, personal guidance, matched-work binding, standalone matched-release work creation, and work-context disambiguation.

## 14. Library Metadata And USWN

- [ ] 14.1 Extend library content DTO schemas to include derived `metadata.uswn`.
- [ ] 14.2 Populate `metadata.uswn` from merge-resolved canonical work Unit id for release-aware Units.
- [ ] 14.3 Return `metadata.uswn = null` for Units with no work domain.
- [ ] 14.4 Ensure frontend metadata panels render server-provided USWN and do not compute merge resolution client-side.
- [ ] 14.5 Add contract/API/app tests for USWN on release, standalone content, and merged work scenarios.

## 15. Content Structure Terminology

- [ ] 15.1 Add or update contract types so content structure DTOs expose `contentStructure` terminology where the concept is generic.
- [ ] 15.2 Replace new/public `chapterId` usage with `contentUnitId` for materialized content node identity.
- [ ] 15.3 Keep `targetUnitId` reserved for interactions and avoid using it as content-structure node identity.
- [ ] 15.4 Audit `BookContentStructure` public contract names and either migrate them or document them as transitional implementation compatibility.
- [ ] 15.5 Update frontend reader/editor call sites and tests to prefer `contentUnitId`.

## 16. Admin Work Merge And Metadata Copy

- [ ] 16.1 Add durable admin work merge operation schema or equivalent operation log with source work, target work, status, actor, reason, timestamps, and item-level progress.
- [ ] 16.2 Add admin merge dry-run endpoint that previews release membership moves, work-domain membership repair scope, projection repair scope, and affected DTO/search/shelf behavior.
- [ ] 16.3 Implement admin-only merge start/status/revert APIs.
- [ ] 16.4 Migrate canonical release/content membership from source work to target work without deleting the source work Unit.
- [ ] 16.5 Preserve source work non-membership metadata by default, including tags, aliases, external references, attribution, and history.
- [ ] 16.6 Queue merge repair for active work domains, including content search, post search, `UnitWork` content membership, shelf membership, and USWN DTO projection.
- [ ] 16.7 Add optional metadata-copy operations for copying missing tags and aliases from source work to target work.
- [ ] 16.8 Ensure metadata copy is independent from canonical merge, creates only missing target rows, leaves source rows unchanged, supports dry-run, and can be reverted for rows it created.
- [ ] 16.9 Add admin UI for merge preview, conflict handling, progress, revert, and optional metadata-copy actions.
- [ ] 16.10 Add tests for merge authorization, queued merge, source preservation, canonical resolution, revert, tag copy, alias copy, and duplicate suppression.

## 17. Work-Domain Seed Fixtures

- [ ] 17.1 Add `unit-work-domain` special factory scenario.
- [ ] 17.2 Seed at least one hidden BOOK work with primary, translation, secondary, and hidden-by-default releases.
- [ ] 17.3 Seed work-level tags, release-local tags, and inherited-tag search sync hooks for the fixture.
- [ ] 17.4 Seed release-local `UnitTranslation` rows and same-work releases in multiple languages for language switcher and Releases tab coverage.
- [ ] 17.5 Seed reviews targeting different releases under the same work so work-domain feed aggregation can be verified.
- [ ] 17.6 Seed a shelf containing multiple releases under the same work for grouped and expanded shelf rendering.
- [ ] 17.7 Attach ISBN/source-site external reference fixtures to visible releases rather than hidden works.
- [ ] 17.8 Emit special target report entries for the hidden work, primary release, translation release, hidden-by-default release, and shelf fixture.
