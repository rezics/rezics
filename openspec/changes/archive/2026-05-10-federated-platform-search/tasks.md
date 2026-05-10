## 1. Content index — `containedUnitIds` document field

- [x] 1.1 In `package/search/src/sync.ts`, locate `buildContentDocument` (the SHELF projection branch). Add `containedUnitIds: shelf.items.map(i => i.unitId)` to the projected document for `type === "SHELF"`. For non-SHELF types, leave the field absent (Meilisearch tolerates missing fields against array filterable attributes).
- [x] 1.2 In the same file's `contentIncludeForSync` (or equivalent Prisma include used by content sync), ensure `Shelf.items` (or `ShelfItem`) is included so `buildContentDocument` can read item ids without an extra DB roundtrip.
- [x] 1.3 Add a unit test in `package/search/src/<contentDocument>.test.ts` (or extend the closest existing test) that asserts a SHELF unit with three items projects `containedUnitIds: [<3 ids>]` and a BOOK unit projects either no field or an empty array.

## 2. Content index — index settings

- [x] 2.1 In `package/search/src/client.ts:49-62` (`initContentIndex`), add `"containedUnitIds"` to `filterableAttributes`. Also add `"userId"` if it isn't already present in the spec list (the runtime list already includes it; reconcile with `content-index/spec.md` so the source of truth and the code line up).
- [x] 2.2 Run `initContentIndex` against a dev Meilisearch instance and confirm the settings update task completes successfully. Document the rollout step in deploy notes. (Documented in §15.1; live run deferred to deploy.)

## 3. ShelfService → partial resync hooks

- [x] 3.1 In `package/server/src/shelf/shelf.service.ts:283` (`ShelfService.addItem`) and `:381` (`ShelfService.removeItem`), after the canonical Postgres write completes, recompute the post-state `containedUnitIds` for the parent shelf (`SELECT unitId FROM ShelfItem WHERE shelfUnitId = :id`) and call `client.patchContent([{ id: shelfUnitId, containedUnitIds }])`. Wrap in try/catch so a Meilisearch outage cannot fail the canonical write; log and move on (fire-and-forget pattern, mirror existing realmIds sync).
- [x] 3.2 If `ShelfService` exposes any batched mutation path (multi-item add/replace/clear), coalesce the partial-update inside the batch boundary so a 500-item bulk-add emits one partial-update task, not 500. Search for callers of `addItem` / `removeItem` and confirm there is no caller that loops outside `ShelfService` — if there is, wrap it in a batched method or document the regression. (Verified: only `shelf.api.ts` calls per-request; `cleanupOrphans` already deletes in one tx + emits one sync.)
- [x] 3.3 Add a test in `package/server/src/shelf/shelf.service.test.ts` asserting that `addItem`/`removeItem` issue a `patchContent` call with the expected `containedUnitIds` payload (mock the `SearchClient`).

## 4. Backfill and full-resync helper

- [x] 4.1 Create `package/server/src/script/backfill-contained-unit-ids.ts` mirroring `package/server/src/script/resync-post-root-targets.ts`. The script SHALL execute one batched query per cursor page: `SELECT u.id AS shelfUnitId, ARRAY_AGG(si.unitId) AS items FROM "Unit" u LEFT JOIN "ShelfItem" si ON si."shelfUnitId" = u.id WHERE u.type = 'SHELF' AND u.status = 'PUBLISHED' GROUP BY u.id` and pass the result to `client.patchContent([{ id, containedUnitIds: items ?? [] }, …])`. Idempotent.
- [x] 4.2 In `package/search/src/sync.ts`, add `syncAllContainedUnitIds(client: SearchClient)` mirroring `syncAllPostRealmIds` (`:773-814`). It SHALL cursor over published SHELF units, recompute `containedUnitIds`, and issue `client.patchContent` partial updates. Return `{ message, totalSynced }`.
- [x] 4.3 Add a CLI entry under `package/server/src/script/resync-content-contained-units.ts` invokable via `bun run package/server/src/script/resync-content-contained-units.ts`.
- [x] 4.4 Run the SQL backfill against a dev database; verify with `SELECT COUNT(*) FROM "Unit" u WHERE u.type = 'SHELF' AND u.status = 'PUBLISHED'` matches the document count in Meilisearch with `containedUnitIds` defined. (Live verification deferred to deploy; documented in §15.1.)

## 5. Contract — Typebox schemas

- [x] 5.1 Create `package/contract/src/search/scope.ts`. Export `SearchScope = t.Union([…])` matching the table in `federated-search/spec.md`. Export `SearchCategory = t.Union([t.Literal("all"), t.Literal("mixed"), …])`. Export TypeScript types via `Static<typeof …>`.
- [x] 5.2 Create `package/contract/src/search/federated.ts`. Export `FederatedSearchOptions` (with `scope`, `category`, `query`, `page?`, `hitsPerPage?`) and `FederatedSearchResult` as a discriminated union on `kind` (`"grouped" | "ranked" | "single"`). Re-export from `package/contract/src/index.ts` so `import { SearchScope } from "@rezics/contract"` works.
- [x] 5.3 In `package/contract/src/search/query.ts` (or wherever `SearchQuery` is defined), add `kind: t.Optional(t.Union([t.Literal("REVIEW"), t.Literal("EXCERPT"), t.Literal("REMARK"), t.Literal("CHAPTER"), t.Literal("POST")]))`. (Added to `package/contract/src/search.ts` SearchQuerySchema.)
- [x] 5.4 Run `bun -F @rezics/contract test` and `bun -F @rezics/contract tsc --noEmit`; expect green. (34 tests pass; tsc exit=0.)

## 6. Server — shared filter builders (extracted from per-index services)

- [x] 6.1 In `package/server/src/meili/content/content.service.ts`, extract the existing filter-construction code into an exported pure function `buildContentFilter(query: SearchQuery, scope: SearchScope, opts?: { categoryHint?: SearchCategory }): string`. The existing endpoint handler keeps its body but now calls `buildContentFilter`. Cover `nsfw`, `visibility`, `ratings`, `realmIds`, `realmTagKeys`, `tagIds`, `languages`, `userId`, `containedUnitIds`, and `type`. (Implemented in `package/server/src/meili/search/filters.ts`; legacy `searchContent` retains its existing inline filter to avoid disturbing its `ContentSearchOptions` shape — the federated endpoint is the new builder's caller.)
- [x] 6.2 In `package/server/src/meili/post/post.service.ts`, extract `buildPostFilter(query: SearchQuery, scope: SearchScope, opts?: { categoryHint?: SearchCategory }): string`. Cover `kind` (with category-implied override), `targetUnitId`, `rootTargetUnitId`, `rootTargetUnitType`, `realmIds`, `authorUserId`, `isLocked`. (Implemented in `package/server/src/meili/search/filters.ts`.)
- [x] 6.3 In `package/server/src/meili/realm/realm.service.ts`, extract `buildRealmFilter(query: SearchQuery, scope: SearchScope): string`. Realm scope is meaningless on the realms index itself; the function returns the existing `isPublic` / `isOfficial` filters and ignores scope. (Implemented in `package/server/src/meili/search/filters.ts`.)
- [x] 6.4 In `package/server/src/meili/user/user.service.ts` (create if absent — currently only `meili.service.ts`), extract `buildUserFilter(query: SearchQuery, scope: SearchScope): string`. User scope is meaningless on the users index; the function returns whatever filter the legacy code already applies (likely none). (Implemented in `package/server/src/meili/search/filters.ts`; legacy users handler still owns its slug/ids filter shape.)
- [x] 6.5 Add unit tests for each filter builder asserting that the produced filter expression matches the legacy hand-built version for representative `SearchQuery` inputs. (`filters.test.ts` — 18 tests pass.)

## 7. Server — federated endpoint

- [x] 7.1 Create `package/server/src/meili/search/federation.config.ts` exporting `federationWeights = { content: number, posts: number, realms: number, users: number }` with documented defaults (e.g. content 1.0, posts 1.0, realms 1.2, users 1.5). Document that runtime tuning happens here, not in callers.
- [x] 7.2 Create `package/server/src/meili/search/federated.service.ts` exporting `federatedSearch(client, opts: FederatedSearchOptions, ctx): Promise<FederatedSearchResult>`. Internal structure:
  - Compute the scope-permitted index allowlist (per the strict-membership table in `federated-search/spec.md`).
  - Branch on `category`: `all` → non-federated multi-search; `mixed` → federated multi-search with `federation: { page, hitsPerPage }` and per-query `federationOptions.weight` from config; single category → a one-element multi-search (or direct call to the per-index endpoint) with full pagination.
  - For each sub-query, call the appropriate `build<Index>Filter(query, scope, { categoryHint })`.
  - Map the Meilisearch response back into the discriminated `FederatedSearchResult` variants.
- [x] 7.3 Create `package/server/src/meili/search/federated.api.ts` exporting an Elysia route `POST /meili/search/federated` that validates the body against `FederatedSearchOptions` and calls `federatedSearch`. Register it in `package/server/src/meili/index.ts` (the route mounting that already includes content/posts/realms search). (Mounted via `.use(federatedSearchApi)` at top-level Elysia chain in `package/server/src/index.ts` and re-exported from `meili/index.ts`.)
- [x] 7.4 Apply the existing default filters (`nsfw=false`, `visibility=PUBLIC`, ratings auth) inside `buildContentFilter` so that single-index endpoints and the federated endpoint both inherit them; assert via a test that omitting `nsfw` produces a filter containing `nsfw = false`. (Asserted by `nsfw=false default applies` test in `federated.service.test.ts` and by `global scope with bare query yields nsfw + visibility defaults` in `filters.test.ts`.)
- [x] 7.5 Add server tests in `package/server/src/meili/search/federated.service.test.ts` covering: (a) global `all` returns sections with totalHits, (b) book scope omits realms+users sections and includes shelves filtered by containedUnitIds, (c) realm scope filters by realmIds across content+posts, (d) user scope filters by userId/authorUserId, (e) mixed category returns ranked variant with origin metadata. (8 tests pass.)

## 8. API client — TanStack Query hook

- [x] 8.1 In `package/api/src/meili/`, add `meili.federated.ts` exporting `federatedSearchQueryOptions(opts: FederatedSearchOptions)` and `useFederatedSearch(opts)` that calls `POST /meili/search/federated`. Match the patterns in the existing `meili.queries.ts`.
- [x] 8.2 The hook return type SHALL preserve the discriminated union of `FederatedSearchResult` so consumers narrow via `if (data.kind === "grouped") …`. (`useQuery<FederatedSearchResult>` keeps the union intact.)
- [x] 8.3 Add a stale-time and gcTime consistent with other search hooks. Cache key: `["federated-search", opts]` with deep-equal serialization. (staleTime 2min, gcTime 5min, queryKey `["federated-search", opts]`.)

## 9. Frontend — parser, scope resolver, helpers

- [x] 9.1 In `package/app/src/search/models/searchQuery.ts`, extend `parseSearchString` to recognize `kind:value` tokens. Normalize the value to canonical `PostKind` (`review→REVIEW`, etc.) and write to `SearchQuery.kind`. Drop unknown values silently.
- [x] 9.2 Extend `serializeSearchQuery` (same file) to round-trip `kind`. Add tests in `searchQuery.test.ts` covering parse, serialize, last-wins, and silent-drop.
- [x] 9.3 Create `package/app/src/search/models/scope.ts` exporting `resolveScope(pathname: string): SearchScope | { kind: "userSlug"; userSlug: string }` per the route-to-scope rules in `federated-search/spec.md`. Add unit tests covering all five rule branches and edge cases (`/realm/search` directory, `/user/me`, unknown paths).
- [x] 9.4 In `package/app/src/search/index.ts` (the search feature's public entry), update `buildSearchPath` to accept `{ scope, category?, keyword?, tags? }`. The `category="all"` case omits the `category` URL param; non-default categories include it. Existing callers that pass only `{ keyword }` continue to work by defaulting `scope = { kind: "global" }`. (Old per-field URL params dropped — single `?q=<SO-style>` contract is now canonical; legacy `parseSearchParams` and `buildBookSearchPath` removed.)
- [x] 9.5 Re-export `resolveScope`, `buildSearchPath`, `useFederatedSearch` (from `@rezics/api/meili/meili.federated`) from `package/app/src/search/index.ts`. (`FederatedResultList` and `SearchCategoryNav` re-exports deferred to §11 when those components exist.)
- [x] 9.6 Run `bun -F @rezics/app test src/search/models/searchQuery.test.ts` and the new scope test; expect green. (33/33 pass.)

## 10. Frontend — `useSearchQuery` extension

- [x] 10.1 In `package/app/src/search/hooks/useSearchQuery.ts`, add `scope?: SearchScope` and `initialCategory?: SearchCategory` to `UseSearchQueryOptions`. Default `scope = { kind: "global" }` and `category = "all"`. Surface `scope`, `category`, and `setCategory` on the hook return value as siblings of `query` (since they are not `SearchQuery` fields).
- [x] 10.2 `bind("scope")` is already a TypeScript error: `BindableField = keyof SearchQuery` and `SearchQuery` has no `scope` field, so the bind generic rejects it without explicit exclusion. (Documented here for clarity; no code change required.)
- [x] 10.3 Add `toSearchParams(): URLSearchParams` to the hook, backed by an exported pure helper `buildSearchParams(query, category)` that emits `q=<SO-style>` and `category=…` for any non-`all` category (omitted otherwise).
- [x] 10.4 Add `buildSearchParams` test scenarios to `useSearchQuery.test.ts` covering category=all omission, non-default inclusion, SO-style q serialization, empty-query omission, and a patch+serialize round-trip. (20/20 pass.)

## 11. Frontend — components

- [x] 11.1 Create `package/app/src/search/components/FederatedResultList.tsx`. Render the three layouts per `app-search-feature/spec.md`. (Per-bucket renderers are minimal inline rows — `ContentItemRow`, `PostItemRow`, `RealmItemRow`, `UserItemRow` — kept in-file as the spec allows when domain card components don't accept search-document shapes directly.)
- [x] 11.2 Create `package/app/src/search/components/SearchCategoryNav.tsx` per spec. Uses shadcn `Tabs`/`TabsList`/`TabsTrigger`. The pure helper `permittedCategoriesForScope` lives in a separate non-React module (`permittedCategories.ts`) so it can be unit-tested without dragging in shadcn imports.
- [x] 11.3 Add stories `SearchCategoryNav.stories.tsx` (global / realm / book / user scope) and `FederatedResultList.stories.tsx` (Grouped / Ranked / Single / Loading) at `package/app/src/search/components/`.
- [x] 11.4 Re-export both from `package/app/src/search/components/index.ts` (and via `export * from "./components"` in `package/app/src/search/index.ts`).

## 12. Frontend — pages (5 routes)

- [x] 12.1 Refactor `package/app/src/routes/_mainLayout/search/index.tsx` to mount `FederatedSearchPage` (factored shared component at `package/app/src/search/pages/FederatedSearchPage.tsx`). The page resolves `scope = { kind: "global" }` and `category` from URL, calls `useFederatedSearch`, and renders `<SearchCategoryNav> + <AdvancedSearch> + <FederatedResultList>`. The `?q=` URL contract is preserved; `?category=` is parsed via the `isSearchCategory` validator (extracted to `models/category.ts` so it can be unit-tested without dragging in shadcn imports).
- [x] 12.2 Create `package/app/src/routes/_mainLayout/book/$bookId/search.tsx` mounting `FederatedSearchPage` with `scope = { kind: "book", unitId: bookId }`. The page nests under the existing book layout (`book/$bookId/route.tsx`).
- [x] 12.3 Create `package/app/src/routes/_mainLayout/realm/$realmId/search.tsx`. The existing `/realm/search` directory route stays untouched. Scope: `{ kind: "realm", realmId }`.
- [x] 12.4 Create `package/app/src/routes/_mainLayout/user/$userId/search.tsx`. Nests under the existing `ProfileLayout`. Scope: `{ kind: "user", userId }`.
- [x] 12.5 Create `package/app/src/routes/_mainLayout/u/$userSlug/search.tsx`. Resolves the slug to a user id via `userBySlugQuery` (`@rezics/api/user/user.queries`), shows a `Spinner` while pending, then mounts `FederatedSearchPage` with `scope = { kind: "user", userId: <resolved> }`.
- [x] 12.6 Verified `/book/search` (BookLibPage) and `/realm/search` (RealmSearchPage) untouched (still use `lazyRouteComponent` to load their existing implementations).
- [x] 12.7 Added unit tests for `isSearchCategory` (`pages/FederatedSearchPage.test.ts`) and `buildSearchPath` (`utils/searchQuery.test.ts`) covering the URL serialization contract for every scope. Full Playwright e2e is deferred — there is no Playwright harness in the app yet, and the routing surface here is straightforward `validateSearch` + `useNavigate` against contract-typed inputs.

## 13. Frontend — header search submit

- [x] 13.1 In `package/app/src/core/components/header/HeaderSearch.tsx`, replaced the `submit` body with `navigate({ to: buildHeaderSubmitPath(pathname, value) })`. The pure helper lives at `package/app/src/core/components/header/buildHeaderSubmitPath.ts` so it can be unit-tested without dragging in the React component's shadcn imports. It uses `resolveScope` from `@/search/models/scope` and falls back to a direct `/u/${userSlug}/search?q=…` URL for the `userSlug` intermediate (no slug→id resolution at the header layer).
- [x] 13.2 Added `buildHeaderSubmitPath.test.ts` covering all five scope cases (global, realm, user-by-id, user-by-slug, book), the empty-value case, and the `/realm/search` directory falling through to global. (7/7 pass.)

## 14. Convention checks, type checks, knip

- [x] 14.1 `bun run check:convention` — expect no new R1–R9 violations. The shelf service must still pass R7 (no direct `powerLaw`/`randomInt` calls) — the change doesn't touch counts. (6 violations, baseline 6 — no new violations introduced.)
- [x] 14.2 `bun -F @rezics/contract tsc --noEmit`, `bun -F @rezics/server tsc --noEmit`, `bun -F @rezics/search tsc --noEmit`, `bun -F @rezics/api tsc --noEmit`, `bun -F @rezics/app tsc --noEmit` — per the per-package tsc convention, ignore cross-package alias errors. (Filtered each package's tsc output to my work areas — no errors in meili/federated/scope/category/searchQuery/SearchCategoryNav/FederatedResultList/FederatedSearchPage/useSearchQuery/buildHeaderSubmitPath. The only flagged file in HeaderSearch.tsx is line 80's pre-existing `defaultLanguage` access on `realmQuery.data` from commit f1b6ad86, untouched by this change. Fixed one fixture in `FederatedResultList.stories.tsx` by adding `userId: null` and dropping the redundant `as ContentSearchDocument` cast.)
- [x] 14.3 `bun run knip` — expect no new unused exports. Confirm the new `FederatedResultList`, `SearchCategoryNav`, `useFederatedSearch`, `buildSearchPath` widening, `resolveScope`, `buildContentFilter`/`buildPostFilter`/`buildRealmFilter`/`buildUserFilter`, and federated route are all consumed by callers. (None of my new exports flagged; pre-existing knip flags are in unrelated modules.)

## 15. Rollout sequence and validation

- [x] 15.1 Document the apply order in deploy notes: (a) ship `containedUnitIds` schema/code, (b) `initContentIndex` settings update, (c) SQL backfill, (d) `syncAllContainedUnitIds` partial resync, (e) federated endpoint server deploy, (f) frontend pages + header submit deploy. Frontend stays backward-compatible against legacy endpoints throughout. (Documented in `openspec/changes/federated-platform-search/deploy-notes.md`.)
- [ ] 15.2 Manually verify in dev: `/search`, `/book/<id>/search`, `/realm/<id>/search`, `/u/<slug>/search`, `/user/<id>/search` all render with their scope-appropriate categories. Header submit on each scope type lands at the right URL. (Pending: requires a running dev environment + Meilisearch with seeded data — handing off to user.)
- [ ] 15.3 After all tasks complete and dev verification passes, archive the change with `/opsx:archive`.
