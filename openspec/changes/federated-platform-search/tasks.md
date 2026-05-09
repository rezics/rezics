## 1. Content index — `containedUnitIds` document field

- [ ] 1.1 In `package/search/src/sync.ts`, locate `buildContentDocument` (the SHELF projection branch). Add `containedUnitIds: shelf.items.map(i => i.unitId)` to the projected document for `type === "SHELF"`. For non-SHELF types, leave the field absent (Meilisearch tolerates missing fields against array filterable attributes).
- [ ] 1.2 In the same file's `contentIncludeForSync` (or equivalent Prisma include used by content sync), ensure `Shelf.items` (or `ShelfItem`) is included so `buildContentDocument` can read item ids without an extra DB roundtrip.
- [ ] 1.3 Add a unit test in `package/search/src/<contentDocument>.test.ts` (or extend the closest existing test) that asserts a SHELF unit with three items projects `containedUnitIds: [<3 ids>]` and a BOOK unit projects either no field or an empty array.

## 2. Content index — index settings

- [ ] 2.1 In `package/search/src/client.ts:49-62` (`initContentIndex`), add `"containedUnitIds"` to `filterableAttributes`. Also add `"userId"` if it isn't already present in the spec list (the runtime list already includes it; reconcile with `content-index/spec.md` so the source of truth and the code line up).
- [ ] 2.2 Run `initContentIndex` against a dev Meilisearch instance and confirm the settings update task completes successfully. Document the rollout step in deploy notes.

## 3. ShelfService → partial resync hooks

- [ ] 3.1 In `package/server/src/shelf/shelf.service.ts:283` (`ShelfService.addItem`) and `:381` (`ShelfService.removeItem`), after the canonical Postgres write completes, recompute the post-state `containedUnitIds` for the parent shelf (`SELECT unitId FROM ShelfItem WHERE shelfUnitId = :id`) and call `client.patchContent([{ id: shelfUnitId, containedUnitIds }])`. Wrap in try/catch so a Meilisearch outage cannot fail the canonical write; log and move on (fire-and-forget pattern, mirror existing realmIds sync).
- [ ] 3.2 If `ShelfService` exposes any batched mutation path (multi-item add/replace/clear), coalesce the partial-update inside the batch boundary so a 500-item bulk-add emits one partial-update task, not 500. Search for callers of `addItem` / `removeItem` and confirm there is no caller that loops outside `ShelfService` — if there is, wrap it in a batched method or document the regression.
- [ ] 3.3 Add a test in `package/server/src/shelf/shelf.service.test.ts` asserting that `addItem`/`removeItem` issue a `patchContent` call with the expected `containedUnitIds` payload (mock the `SearchClient`).

## 4. Backfill and full-resync helper

- [ ] 4.1 Create `package/server/src/script/backfill-contained-unit-ids.ts` mirroring `package/server/src/script/resync-post-root-targets.ts`. The script SHALL execute one batched query per cursor page: `SELECT u.id AS shelfUnitId, ARRAY_AGG(si.unitId) AS items FROM "Unit" u LEFT JOIN "ShelfItem" si ON si."shelfUnitId" = u.id WHERE u.type = 'SHELF' AND u.status = 'PUBLISHED' GROUP BY u.id` and pass the result to `client.patchContent([{ id, containedUnitIds: items ?? [] }, …])`. Idempotent.
- [ ] 4.2 In `package/search/src/sync.ts`, add `syncAllContainedUnitIds(client: SearchClient)` mirroring `syncAllPostRealmIds` (`:773-814`). It SHALL cursor over published SHELF units, recompute `containedUnitIds`, and issue `client.patchContent` partial updates. Return `{ message, totalSynced }`.
- [ ] 4.3 Add a CLI entry under `package/server/src/script/resync-content-contained-units.ts` invokable via `bun run package/server/src/script/resync-content-contained-units.ts`.
- [ ] 4.4 Run the SQL backfill against a dev database; verify with `SELECT COUNT(*) FROM "Unit" u WHERE u.type = 'SHELF' AND u.status = 'PUBLISHED'` matches the document count in Meilisearch with `containedUnitIds` defined.

## 5. Contract — Typebox schemas

- [ ] 5.1 Create `package/contract/src/search/scope.ts`. Export `SearchScope = t.Union([…])` matching the table in `federated-search/spec.md`. Export `SearchCategory = t.Union([t.Literal("all"), t.Literal("mixed"), …])`. Export TypeScript types via `Static<typeof …>`.
- [ ] 5.2 Create `package/contract/src/search/federated.ts`. Export `FederatedSearchOptions` (with `scope`, `category`, `query`, `page?`, `hitsPerPage?`) and `FederatedSearchResult` as a discriminated union on `kind` (`"grouped" | "ranked" | "single"`). Re-export from `package/contract/src/index.ts` so `import { SearchScope } from "@rezics/contract"` works.
- [ ] 5.3 In `package/contract/src/search/query.ts` (or wherever `SearchQuery` is defined), add `kind: t.Optional(t.Union([t.Literal("REVIEW"), t.Literal("EXCERPT"), t.Literal("REMARK"), t.Literal("CHAPTER"), t.Literal("POST")]))`.
- [ ] 5.4 Run `bun -F @rezics/contract test` and `bun -F @rezics/contract tsc --noEmit`; expect green.

## 6. Server — shared filter builders (extracted from per-index services)

- [ ] 6.1 In `package/server/src/meili/content/content.service.ts`, extract the existing filter-construction code into an exported pure function `buildContentFilter(query: SearchQuery, scope: SearchScope, opts?: { categoryHint?: SearchCategory }): string`. The existing endpoint handler keeps its body but now calls `buildContentFilter`. Cover `nsfw`, `visibility`, `ratings`, `realmIds`, `realmTagKeys`, `tagIds`, `languages`, `userId`, `containedUnitIds`, and `type`.
- [ ] 6.2 In `package/server/src/meili/post/post.service.ts`, extract `buildPostFilter(query: SearchQuery, scope: SearchScope, opts?: { categoryHint?: SearchCategory }): string`. Cover `kind` (with category-implied override), `targetUnitId`, `rootTargetUnitId`, `rootTargetUnitType`, `realmIds`, `authorUserId`, `isLocked`.
- [ ] 6.3 In `package/server/src/meili/realm/realm.service.ts`, extract `buildRealmFilter(query: SearchQuery, scope: SearchScope): string`. Realm scope is meaningless on the realms index itself; the function returns the existing `isPublic` / `isOfficial` filters and ignores scope.
- [ ] 6.4 In `package/server/src/meili/user/user.service.ts` (create if absent — currently only `meili.service.ts`), extract `buildUserFilter(query: SearchQuery, scope: SearchScope): string`. User scope is meaningless on the users index; the function returns whatever filter the legacy code already applies (likely none).
- [ ] 6.5 Add unit tests for each filter builder asserting that the produced filter expression matches the legacy hand-built version for representative `SearchQuery` inputs.

## 7. Server — federated endpoint

- [ ] 7.1 Create `package/server/src/meili/search/federation.config.ts` exporting `federationWeights = { content: number, posts: number, realms: number, users: number }` with documented defaults (e.g. content 1.0, posts 1.0, realms 1.2, users 1.5). Document that runtime tuning happens here, not in callers.
- [ ] 7.2 Create `package/server/src/meili/search/federated.service.ts` exporting `federatedSearch(client, opts: FederatedSearchOptions, ctx): Promise<FederatedSearchResult>`. Internal structure:
  - Compute the scope-permitted index allowlist (per the strict-membership table in `federated-search/spec.md`).
  - Branch on `category`: `all` → non-federated multi-search; `mixed` → federated multi-search with `federation: { page, hitsPerPage }` and per-query `federationOptions.weight` from config; single category → a one-element multi-search (or direct call to the per-index endpoint) with full pagination.
  - For each sub-query, call the appropriate `build<Index>Filter(query, scope, { categoryHint })`.
  - Map the Meilisearch response back into the discriminated `FederatedSearchResult` variants.
- [ ] 7.3 Create `package/server/src/meili/search/federated.api.ts` exporting an Elysia route `POST /meili/search/federated` that validates the body against `FederatedSearchOptions` and calls `federatedSearch`. Register it in `package/server/src/meili/index.ts` (the route mounting that already includes content/posts/realms search).
- [ ] 7.4 Apply the existing default filters (`nsfw=false`, `visibility=PUBLIC`, ratings auth) inside `buildContentFilter` so that single-index endpoints and the federated endpoint both inherit them; assert via a test that omitting `nsfw` produces a filter containing `nsfw = false`.
- [ ] 7.5 Add server tests in `package/server/src/meili/search/federated.service.test.ts` covering: (a) global `all` returns sections with totalHits, (b) book scope omits realms+users sections and includes shelves filtered by containedUnitIds, (c) realm scope filters by realmIds across content+posts, (d) user scope filters by userId/authorUserId, (e) mixed category returns ranked variant with origin metadata.

## 8. API client — TanStack Query hook

- [ ] 8.1 In `package/api/src/meili/`, add `meili.federated.ts` exporting `federatedSearchQueryOptions(opts: FederatedSearchOptions)` and `useFederatedSearch(opts)` that calls `POST /meili/search/federated`. Match the patterns in the existing `meili.queries.ts`.
- [ ] 8.2 The hook return type SHALL preserve the discriminated union of `FederatedSearchResult` so consumers narrow via `if (data.kind === "grouped") …`.
- [ ] 8.3 Add a stale-time and gcTime consistent with other search hooks. Cache key: `["federated-search", opts]` with deep-equal serialization.

## 9. Frontend — parser, scope resolver, helpers

- [ ] 9.1 In `package/app/src/search/models/searchQuery.ts`, extend `parseSearchString` to recognize `kind:value` tokens. Normalize the value to canonical `PostKind` (`review→REVIEW`, etc.) and write to `SearchQuery.kind`. Drop unknown values silently.
- [ ] 9.2 Extend `serializeSearchQuery` (same file) to round-trip `kind`. Add tests in `searchQuery.test.ts` covering parse, serialize, last-wins, and silent-drop.
- [ ] 9.3 Create `package/app/src/search/models/scope.ts` exporting `resolveScope(pathname: string): SearchScope | { kind: "userSlug"; userSlug: string }` per the route-to-scope rules in `federated-search/spec.md`. Add unit tests covering all five rule branches and edge cases (`/realm/search` directory, `/user/me`, unknown paths).
- [ ] 9.4 In `package/app/src/search/index.ts` (the search feature's public entry), update `buildSearchPath` to accept `{ scope, category?, keyword?, tags? }`. The `category="all"` case omits the `category` URL param; non-default categories include it. Existing callers that pass only `{ keyword }` continue to work by defaulting `scope = { kind: "global" }`.
- [ ] 9.5 Re-export `resolveScope`, `buildSearchPath`, `FederatedResultList`, `SearchCategoryNav`, `useFederatedSearch` (from `@rezics/api`) from `package/app/src/search/index.ts`.
- [ ] 9.6 Run `bun -F @rezics/app test src/search/models/searchQuery.test.ts` and the new scope test; expect green.

## 10. Frontend — `useSearchQuery` extension

- [ ] 10.1 In `package/app/src/search/hooks/useSearchQuery.ts`, add `scope?: SearchScope` and `category?: SearchCategory` to `UseSearchQueryOptions['initial']`. Default `scope = { kind: "global" }` and `category = "all"`. Surface them in the `query` return value.
- [ ] 10.2 Make `bind("scope")` a TypeScript error: omit `scope` from the `BindableField` union or annotate it `Readonly`.
- [ ] 10.3 In the URL serialization path, include `?category=…` for any non-`all` category and omit it otherwise.
- [ ] 10.4 Update `useSearchQuery.test.ts` with a scenario asserting category round-trips through `patch` and `toSearchParams`.

## 11. Frontend — components

- [ ] 11.1 Create `package/app/src/search/components/FederatedResultList.tsx`. Render the three layouts per `app-search-feature/spec.md`. Use the existing `ContentCard`, post cards, `RealmCard`, and user-result components for the per-bucket renderers; if any are missing, add minimal new components in the same file.
- [ ] 11.2 Create `package/app/src/search/components/SearchCategoryNav.tsx` per spec. Use shadcn `Tabs` primitive (visual rendering); the contract layer name remains `SearchCategoryNav`.
- [ ] 11.3 Add stories under `package/app/src/.storybook/` (or wherever app-side stories live) for both components covering grouped / ranked / single layouts.
- [ ] 11.4 Re-export both from `package/app/src/search/components/index.ts` and `package/app/src/search/index.ts`.

## 12. Frontend — pages (5 routes)

- [ ] 12.1 Refactor `package/app/src/routes/_mainLayout/search/index.tsx` to mount the new federated implementation. The page resolves `scope = { kind: "global" }` and `category` from URL, calls `useFederatedSearch`, and renders `<SearchCategoryNav> + <AdvancedSearch> + <FederatedResultList>`. Preserve the existing `?q=` URL contract; add `?category=` handling.
- [ ] 12.2 Create `package/app/src/routes/_mainLayout/book/$bookId/search.tsx` mounting the same federated page implementation (factor it into a shared `<FederatedSearchPage scope={…} />` component) with `scope = { kind: "book", unitId: bookId }`.
- [ ] 12.3 Create `package/app/src/routes/_mainLayout/realm/$realmId/search.tsx` (note: the existing `/realm/search` directory route stays at `/realm/search` and is unrelated). Scope: `{ kind: "realm", realmId }`.
- [ ] 12.4 Create `package/app/src/routes/_mainLayout/user/$userId/search.tsx`. Scope: `{ kind: "user", userId }`.
- [ ] 12.5 Create `package/app/src/routes/_mainLayout/u/$userSlug/search.tsx`. The page resolves the slug to a user id via the existing `userQueries.bySlug` query, then mounts the federated page with `scope = { kind: "user", userId: <resolved> }`. Show a spinner placeholder until resolution completes.
- [ ] 12.6 Verify that `/book/search` (BookLibPage) and `/realm/search` (RealmSearchPage) keep their existing implementations untouched. Do not redirect them.
- [ ] 12.7 Add e2e or integration tests (Playwright if available, otherwise route-level component tests) asserting that `/realm/r-1/search?q=foo` navigates correctly and renders the realm-scoped result list.

## 13. Frontend — header search submit

- [ ] 13.1 In `package/app/src/core/components/header/HeaderSearch.tsx`, replace the `submit` body that hardcodes `pathname.startsWith("/book") ? "/book/search" : "/search"` with a call to `buildSearchPath({ scope: resolveScope(pathname), keyword: value })`. Use the same `resolveScope` exported from `@/search/models/scope`. For the `userSlug` intermediate, navigate to `/u/${userSlug}/search?q=…` directly.
- [ ] 13.2 Update or add tests asserting submit destinations for the five scope cases (global, realm, user-by-id, user-by-slug, book).

## 14. Convention checks, type checks, knip

- [ ] 14.1 `bun run check:convention` — expect no new R1–R9 violations. The shelf service must still pass R7 (no direct `powerLaw`/`randomInt` calls) — the change doesn't touch counts.
- [ ] 14.2 `bun -F @rezics/contract tsc --noEmit`, `bun -F @rezics/server tsc --noEmit`, `bun -F @rezics/search tsc --noEmit`, `bun -F @rezics/api tsc --noEmit`, `bun -F @rezics/app tsc --noEmit` — per the per-package tsc convention, ignore cross-package alias errors.
- [ ] 14.3 `bun run knip` — expect no new unused exports. Confirm the new `FederatedResultList`, `SearchCategoryNav`, `useFederatedSearch`, `buildSearchPath` widening, `resolveScope`, `buildContentFilter`/`buildPostFilter`/`buildRealmFilter`/`buildUserFilter`, and federated route are all consumed by callers.

## 15. Rollout sequence and validation

- [ ] 15.1 Document the apply order in deploy notes: (a) ship `containedUnitIds` schema/code, (b) `initContentIndex` settings update, (c) SQL backfill, (d) `syncAllContainedUnitIds` partial resync, (e) federated endpoint server deploy, (f) frontend pages + header submit deploy. Frontend stays backward-compatible against legacy endpoints throughout.
- [ ] 15.2 Manually verify in dev: `/search`, `/book/<id>/search`, `/realm/<id>/search`, `/u/<slug>/search`, `/user/<id>/search` all render with their scope-appropriate categories. Header submit on each scope type lands at the right URL.
- [ ] 15.3 After all tasks complete and dev verification passes, archive the change with `/opsx:archive`.
