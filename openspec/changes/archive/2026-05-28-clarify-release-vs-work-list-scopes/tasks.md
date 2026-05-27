## 1. Contract And API Shape

- [x] 1.1 Extend `package/contract/src/shelf.ts` list query/body schemas with `containsWorkUnitId`.
- [x] 1.2 Add contract tests asserting `containsUnitId` remains exact and `containsWorkUnitId` is accepted.
- [x] 1.3 Add validation for rejecting shelf list requests that provide both `containsUnitId` and `containsWorkUnitId`.
- [x] 1.4 Audit `package/contract/src/meili/*` and `package/contract/src/search/*` tests to document exact Unit versus work-domain filter naming.

## 2. Shelf Server Semantics

- [x] 2.1 Update `package/server/src/shelf/shelf.service.ts` so `containsUnitId` filters only exact `ShelfUnit.unitId`.
- [x] 2.2 Add `containsWorkUnitId` filtering through `UnitWork(role = SHELF)`.
- [x] 2.3 Update matched-unit hydration so work-domain shelf results can report the actual matched contained release.
- [x] 2.4 Update shelf service and API tests for exact containment, work-domain containment, and ambiguous-filter rejection.

## 3. Search And Federated Scope

- [x] 3.1 Update `package/server/src/meili/search/filters.ts` so book-scoped shelf/post filters can use explicit work-domain scope when provided.
- [x] 3.2 Update `package/server/src/meili/search/federated.service.ts` to carry exact-release versus work-domain scope through grouped, ranked, and single-category searches.
- [x] 3.3 Extend search/federated contract or request shape if needed so clients can request exact-release mode without overloading `scope.unitId`.
- [x] 3.4 Update Meilisearch content/post filter tests for exact release and work-domain shelf/review/remark/excerpt cases.
- [x] 3.5 If index-side shelf work filtering is required, extend `package/search/src/sync.ts` and search schema tests with the minimal shelf work-domain projection fields.

## 4. App Query Helpers

- [x] 4.1 Update `package/api/src/shelf` filter types, query keys, and API helper calls for `containsWorkUnitId`.
- [x] 4.2 Add or reuse a shared app helper that resolves a release page into `{ unitId, workUnitId, scopeMode }`.
- [x] 4.3 Update `package/api/src/post` usage docs/tests to preserve `targetUnitId` exactness and work-domain `byWork` queries.
- [x] 4.4 Ensure query keys differ between exact Unit and work-domain calls.

## 5. App Surfaces

- [x] 5.1 Update book shelf preview, shelf counts, and shelf-by-book page to default to `containsWorkUnitId` when a work id exists.
- [x] 5.2 Add or wire exact-release mode for shelf surfaces that need "This release" behavior.
- [x] 5.3 Update full review-by-book pages so they match work-domain review preview scope by default.
- [x] 5.4 Update remark-by-book pages to use work-domain scope by default when available.
- [x] 5.5 Audit excerpt-by-book and `UnitsPage` target handling; fix ignored target filters and apply work-domain behavior where required by specs.
- [x] 5.6 Update book-scoped search UI to choose default work-domain scope and expose exact-release mode where needed.
- [x] 5.7 Add localized labels for all-releases and this-release toggles introduced by this change.

## 6. Series And Consistency Audit

- [x] 6.1 Verify series app entrypoints use `containsReleaseUnitId` for direct release membership checks.
- [x] 6.2 Verify series app entrypoints use `relatedWorkUnitId` for work-domain related series.
- [x] 6.3 Run a repo-wide search for ambiguous release/work filters (`containsUnitId`, `targetUnitId`, `rootTargetUnitId`, `bookId`) and update or document every release-aware callsite.

## 7. Validation

- [x] 7.1 Run targeted contract tests for shelf, post search, content search, federated search, and series contracts.
- [x] 7.2 Run targeted server tests for shelf service, post service, Meilisearch content/post/federated filters, and search sync if changed.
- [x] 7.3 Run targeted app tests for release scope helpers and updated review/remark/shelf pages.
- [x] 7.4 Run `bun run check:convention` and relevant package type checks or test commands for changed packages.
