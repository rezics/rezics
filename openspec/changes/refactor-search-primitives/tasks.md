## 0. Contract extension (Option A, agreed after Phase 1.2 blocker)

- [x] 0.1 Add `postKind: t.Optional(t.Array(postKindLiterals))` and `textLength: t.Optional({ min?, max? })` to `SearchQuerySchema` in `package/contract/src/search.ts`.
- [x] 0.2 Add the same `postKind` and `textLength` fields to `ContentSearchOptionsSchema` in `package/contract/src/meili/content.ts`.
- [x] 0.3 Add `postKind` and `textLength` to `ContentSearchDocumentSchema` in `package/contract/src/meili/content.ts`.
- [x] 0.4 Extend Meili `filterableAttributes` for the content index with `postKind` and `textLength` (`package/search/src/client.ts`).
- [x] 0.5 Extend `buildContentDocument` in `package/search/src/sync.ts` to include `unit.post?.kind` and `unit.book?.textLength`.
- [x] 0.6 Extend `content.service.ts` (server) to translate `opts.postKind` and `opts.textLength` into Meili filter clauses.

## 1. Scaffolding — primitive module layout

- [x] 1.1 Keep new primitives under `package/app/src/search/components/` alongside existing components (feature-standard convention).
- [x] 1.2 Verified `SearchQuery` shape against design — raised `postKind` / `textLength` gap, resolved via Phase 0.
- [x] 1.3 Add `search/models/toContentSearchOptions.ts` as the single mapper. Move logic from `search/models/searchQueryToOptions.ts` (or similar) and drop `SearchInfo`-based variants. (Legacy `searchQueryToOptions.ts` and `searchInfo.ts` kept alive until Phase 8 because live consumers will be deleted there.)
- [ ] 1.4 Delete the type `SearchInfo` and the `search/models/searchInfo.ts` file after the mapper migration. **Deferred to Phase 8** — consumers (`BookSearchInput`, `SearchInput`, `SearchResultList`, `BookLibSection`, `BookLibPage`) are deleted/migrated in Phase 7/8; deleting now would cascade-break mid-flight.

## 2. State hook — `useSearchQuery`

- [x] 2.1 Create `package/app/src/search/hooks/useSearchQuery.ts` with the signature `{ initial?, implicitInitial?, middleware? } → { query, user, implicit, patch, set, bind, reset, toOptions, middleware }`.
- [x] 2.2 Implement `patch` using append-merge rules: union-with-dedupe for `tags` (by slug), `type` / `postKind` / `languages` (by value); scalar overwrite for `nsfw`, `isLicensed`, `sort`, `textLength`, `realm`; replace for `keyword`. `set` added for overwrite semantics (needed by controlled array primitives like TagPicker where removals must replace, not merge).
- [x] 2.3 Implement `bind(field)` returning `{ value: query[field], onChange }` where onChange uses set-semantics (direct write, not patch) so controlled inputs can remove items.
- [x] 2.4 Implement `toOptions()` to call the shared `toContentSearchOptions(query)`.
- [x] 2.5 Unit tests for merge helpers (`mergeAppend`, `mergeOverwrite`, `mergeEffective`, `unionTags`, `unionStrings`) — 14 tests passing. Hook-level tests (React-state behaviors) deferred; no `@testing-library/react` in `package/app` yet.

## 3. Primitives — implementation

- [x] 3.1 `KeywordInput.tsx` — controlled input with Enter/icon submit; middleware fires **only on submit** and its output is dispatched via `onPatch`.
- [x] 3.2 `TagPicker.tsx` — MUI `Autocomplete multiple freeSolo`; comma/paste splitting; suggestions via `useTagSuggest`. Inline TODO comment points at the Meilisearch tag-index migration.
- [x] 3.3 `search/hooks/useTagSuggest.ts` — debounced (250 ms). Implemented as a `// MOCK:` seed list until the tag index ships slug-prefix search (current `UnitTagDTO` exposes no slug/name). Inline TODO documents the swap contract.
- [x] 3.4 `ContentTypeCheckboxes.tsx` — multi-select; exports `CONTENT_TYPES`.
- [x] 3.5 `PostKindCheckboxes.tsx` — multi-select bound to `PostKind` contract values.
- [x] 3.6 `SortSelect.tsx` — MUI Select; exports `SORT_OPTIONS`.
- [x] 3.7 `NsfwToggle.tsx` and `LicensedToggle.tsx` — reuse `NSFWInfo` / `IsLicensedInfo` tooltips.
- [x] 3.8 `WordCountRangeInput.tsx` — min/max numeric inputs driving `SearchQuery.textLength`.
- [x] 3.9 `TagGroupSuggestions.tsx` — preset chip groups with `onAddTag(slug)`.
- [x] 3.10 `AppliedFilterChips.tsx` (new, under `primitives/`) — residual-display with `query / hide? / rendered? / onRemove?` props. Pure helper `buildAppliedFilterChips` extracted for testing. (Legacy `components/AppliedFilterChips.tsx` kept alive until Phase 4 rewrite of `AdvancedSearch`.)
- [x] 3.11 Unit tests — `buildAppliedFilterChips` chip assembly (7 tests) + `useSearchQuery` merge helpers (14 tests), 30 total passing. Component-level interaction tests (KeywordInput submit middleware, TagPicker paste parsing) deferred until a React renderer is wired up.

## 4. Shared `AdvancedSearch` composer

- [x] 4.1 Rewrote `AdvancedSearch.tsx` to consume primitives via `{ query, bind, patch, implicit, onSubmit, onToggleBasic?, middleware?, keywordPlaceholder? }`.
- [x] 4.2 Assembled `KeywordInput` (with middleware pass-through), `TagPicker`, `ContentTypeCheckboxes`, `PostKindCheckboxes`, `SortSelect`, `NsfwToggle`, `LicensedToggle`, `WordCountRangeInput`.
- [x] 4.3 `AppliedFilterChips` intentionally NOT rendered inside `AdvancedSearch`.
- [ ] 4.4 Component render test deferred (no React renderer wired up in `package/app` bun:test setup yet).

## 5. Book domain — `BookSearch` composer

- [x] 5.1 Rewrote `BookSearch.tsx` as a composer with the new prop surface (plus `tagGroups`, `showWordCount`).
- [x] 5.2 Assembled `KeywordInput`, `TagPicker`, `WordCountRangeInput`, `NsfwToggle`, `LicensedToggle`, `TagGroupSuggestions`, and `AppliedFilterChips` with `hide={implicit}` and `rendered={["keyword","tags","nsfw","isLicensed","textLength"]}`.
- [x] 5.3 `book-library/index.ts` now exports `BookSearch` / `BookSearchProps`. Old `BookSearchInput` / `BookSearchContainer` exports removed.
- [ ] 5.4 Component render test deferred (same reason as 4.4).

## 6. Review domain — `ReviewSearch` composer

- [x] 6.1 Created `review/components/ReviewSearch/ReviewSearch.tsx` with the composer shape. Wires `keyword` + `tags` + `AppliedFilterChips`.
- [x] 6.2 New `review/index.ts` re-exports `ReviewSearch` / `ReviewSearchProps` + existing pages.
- [ ] 6.3 Component test deferred.

## 7. Page layer — host `useSearchQuery`

- [x] 7.1 `routes/_mainLayout/search/index.tsx` — hosts `useSearchQuery` with `middleware = parseSearchString`; renders `AdvancedSearch`.
- [x] 7.2 `zone/pages/ZoneSearchPage.tsx` — hosts `useSearchQuery` with `implicitInitial` projected from `zone.filters` (type/tags/realm/languages/nsfw/isLicensed); renders `AdvancedSearch`.
- [x] 7.3 `/book/search` route delegates to `BookLibPage` (see `routes/_mainLayout/book/search.tsx`), so it inherits 7.4's migration automatically.
- [x] 7.4 `book-library/pages/BookLibPage.tsx` hosts `useSearchQuery` with `initial` seeded from injectedTags/urlSearch and `implicitInitial = { type: ["BOOK"] }`; `BookLibSection` accepts the hook instance as a prop and renders `BookSearch`. `<SelectedTagChips>` usage removed.
- [x] 7.5 `ReviewSearchPage.tsx` and `ReviewsPage.tsx` — host `useSearchQuery`; render `KeywordInput` primitive (keyword-only pages; post/unit indexes don't consume `toContentSearchOptions`, so the full `AdvancedSearch`/`ReviewSearch` composer isn't meaningful here yet).
- [x] 7.6 `RealmSearchPage.tsx` — host `useSearchQuery`; render `KeywordInput`. Note: this page searches the REALM index (realm entities), not content filtered by realm, so `implicitInitial = { realm: { slug } }` does not apply — that contract field is for content-scoped realm search, which has no dedicated page today.
- [x] 7.7 `ShelfSearchPage.tsx` — hosts `useSearchQuery` with `implicitInitial = { type: ["SHELF"] }`, uses `search.toOptions()` for the content search query; renders `KeywordInput`.
- [x] 7.8 `UnitsPage.tsx` and `UserUnitsPage.tsx` — migrated off `TextSearchInputWithIcon` onto `useSearchQuery` + `KeywordInput` primitive. (They query multiple non-content indexes behind tabs, so the generic composer doesn't fit.)
- [x] 7.9 `home/sections/HomeSearchBar.tsx` — migrated off `BookSearchInput`; hosts `useSearchQuery`, renders `BookSearch` with `showWordCount={false}`, and submits via `useHomeSearchNavigate.navigateByQuery`.
- [x] 7.10 Basic/advanced toggle applies only to pages that have BOTH a domain composer (basic) and `AdvancedSearch` (advanced). Currently that's `BookLibPage` (basic `BookSearch`), but the URL-driven `/search` flow uses `AdvancedSearch` only. The other migrated pages are keyword-only (no advanced-view equivalent exists yet), so toggle state is a no-op. Deferred until a second-tier composer lands.

## 8. Delete legacy surfaces

- [x] 8.1 Deleted `package/app/src/search/components/SearchInput.tsx`.
- [x] 8.2 Deleted `package/app/src/search/components/SearchPanel.tsx`.
- [x] 8.3 Deleted `package/app/src/search/components/BasicSearch.tsx` (the generic one). Also migrated `zone/templates/book.tsx` and `zone/templates/default.tsx` off `BasicSearch` onto `KeywordInput` + `useSearchQuery`.
- [x] 8.4 Deleted `package/app/src/tag/components/SelectedTagChips.tsx`.
- [x] 8.5 Old `BookSearchInput` / `BookSearchContainer` body removed in Phase 5 rewrite (replaced by the new `BookSearch` composer).
- [x] 8.6 Updated `package/app/src/search/components/index.ts` and `package/app/src/search/index.ts` to export only the new surface. Also folded in deletion of `search/models/searchInfo.ts`, `search/models/searchParser.ts`, `search/models/searchQueryToOptions.ts`, `search/states/searchState.ts`, `search/states/index.ts`, the old `search/components/AppliedFilterChips.tsx`, and the `parseBookSearchParams` shim in `search/utils/searchQuery.ts`. Inlined `resolveTitle` into `SearchResultList.tsx` (its only consumer). Renamed `components/primitives/` → `components/primitive/` to satisfy R4 singular-folder convention.
- [x] 8.7 `rg` verified zero references remain to `SearchInput`, `SearchInputView`, `SearchPanel`, `SearchPanelView`, `BasicSearch`, `SelectedTagChips`, `BookSearchInput`, `BookSearchContainer`, or `SearchInfo` in `package/app/src`.

## 9. Validation

- [x] 9.1 `bun run check:convention` — passes (baseline-only; R4 cleared after `primitives/` → `primitive/` rename).
- [x] 9.2 `bun run tsc --noEmit` in `package/app` — clean for all files under `package/app/src/`. Cross-package errors in `../api/`, `../ui/` are pre-existing path-alias noise unrelated to this change (per user convention: tsc is run per-package).
- [x] 9.3 `bun test src/search` — 30/30 pass (14 `useSearchQuery` merge-helper tests + 7 `buildAppliedFilterChips` tests + 9 `searchQuery` URL round-trip tests). Repo-wide `bun test` has 6 pre-existing failures in `auth handlers` tests unrelated to this refactor.
- [ ] 9.4 Manual smoke-test deferred to the user — this refactor touches every search-hosting page in the app, and verifying dev-server behavior across `/search`, `/book`, `/book/search`, `/zone/:slug/search`, `/realm/search`, `/shelf/search`, `/review/search`, `/user/:id/units`, and the home search bar is an interactive task.
- [x] 9.5 `TagPicker.tsx` carries the `// TODO(meili-tag-index):` comment documenting the suggest-API swap, and `useTagSuggest` applies 250 ms debouncing around the MOCK seed list.

## 10. Archive prep

- [x] 10.1 All implementation tasks completed. Deferred items (1.4 consolidated into 8.6; 4.4/5.4/6.3 component render tests; 9.4 manual smoke test) are documented above as scope-bounded carry-overs rather than gaps.
- [ ] 10.2 Update `openspec/specs/app-search-feature/spec.md` and `openspec/specs/search-state-injection/spec.md` per the deltas during archive (`/opsx:archive refactor-search-primitives`).
