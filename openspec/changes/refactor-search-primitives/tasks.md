## 1. Scaffolding — primitive module layout

- [ ] 1.1 Create `package/app/src/search/primitives/` folder (or keep under `components/` per feature-standard — decide and commit to one location).
- [ ] 1.2 Verify `SearchQuery` export shape in `@rezics/contract` is sufficient (covers `keyword`, `tags: SlugRef[]`, `type`, `postKind`, `languages`, `sort`, `nsfw`, `isLicensed`, `textLength`, `realm`). No contract change expected; stop and raise if a field is missing.
- [ ] 1.3 Add `search/models/toContentSearchOptions.ts` as the single mapper. Move logic from `search/models/searchQueryToOptions.ts` (or similar) and drop `SearchInfo`-based variants.
- [ ] 1.4 Delete the type `SearchInfo` and the `search/models/searchInfo.ts` file after the mapper migration.

## 2. State hook — `useSearchQuery`

- [ ] 2.1 Create `package/app/src/search/hooks/useSearchQuery.ts` with the signature `{ initial?, implicitInitial?, middleware? } → { query, implicit, patch, bind, toOptions }`.
- [ ] 2.2 Implement `patch` using append-merge rules: union-with-dedupe for `tags` (by slug), `type` / `postKind` / `languages` (by value); scalar overwrite for `nsfw`, `isLicensed`, `sort`, `textLength`, `realm`; replace for `keyword`.
- [ ] 2.3 Implement `bind(field)` returning `{ value: query[field], onChange: v => patch({ [field]: v }) }`.
- [ ] 2.4 Implement `toOptions()` to call the shared `toContentSearchOptions(query)`.
- [ ] 2.5 Unit tests for `useSearchQuery`: initial merging, `patch` merge rules, `bind` behavior, `toOptions` output, `implicit` projection.

## 3. Primitives — implementation

- [ ] 3.1 `KeywordInput.tsx` — `value / onChange / onPatch?: (p: Partial<SearchQuery>) => void / middleware?: QueryMiddleware / placeholder?: string`. Submit via Enter or icon button; middleware fires **only on submit**.
- [ ] 3.2 `TagPicker.tsx` — MUI `Autocomplete` with `multiple freeSolo`. Paste splits on comma; Enter/comma adds chip. Autocomplete via `useTagSuggest(query)` (new). Include inline `// TODO:` pointing at Meilisearch tag-index migration.
- [ ] 3.3 `search/hooks/useTagSuggest.ts` — debounced (250 ms) query against the existing tag endpoint that returns `{ slug, unitId, name }` for slug-prefix matches.
- [ ] 3.4 `ContentTypeCheckboxes.tsx` — multi-select for `BOOK / GAME / MEDIA / SHELF / POST`.
- [ ] 3.5 `PostKindCheckboxes.tsx` — multi-select bound to the post-kind contract values.
- [ ] 3.6 `SortSelect.tsx` — MUI Select with entries sourced from the shared sort options list.
- [ ] 3.7 `NsfwToggle.tsx` and `LicensedToggle.tsx` — MUI `FormControlLabel` + `Checkbox`, both with the existing tooltip components (`NSFWInfo`, `IsLicensedInfo`).
- [ ] 3.8 `WordCountRangeInput.tsx` — numeric input (or min/max pair) for `SearchQuery.textLength`.
- [ ] 3.9 `TagGroupSuggestions.tsx` — preset tag chip group with `onAddTag(slug)` callback.
- [ ] 3.10 `AppliedFilterChips.tsx` — residual-display with `query / hide? / rendered? / onRemove?` props. Compute `(query - hide) - rendered` and render one chip per remaining value.
- [ ] 3.11 Unit tests per primitive: controlled behavior, keyboard events, paste parsing (TagPicker), dedupe, submit middleware (KeywordInput).

## 4. Shared `AdvancedSearch` composer

- [ ] 4.1 Rewrite `package/app/src/search/components/AdvancedSearch.tsx` to consume primitives via props from a parent `useSearchQuery`. New prop surface: `{ query, bind, patch, implicit, onSubmit, onToggleBasic? }`.
- [ ] 4.2 Assemble `KeywordInput` (with `middleware={parseSearchString}` opt-in), `TagPicker`, `ContentTypeCheckboxes`, `PostKindCheckboxes`, `SortSelect`, `NsfwToggle`, `LicensedToggle`, `WordCountRangeInput`.
- [ ] 4.3 Do NOT render `AppliedFilterChips` inside `AdvancedSearch` (all fields are already surfaced by primitives).
- [ ] 4.4 Component test: renders all primitives; every `initial` + `implicitInitial` value is surfaced via the correct primitive.

## 5. Book domain — `BookSearch` composer

- [ ] 5.1 Rewrite `package/app/src/book-library/components/BookSearch/BookSearch.tsx` to be a composer accepting `{ query, bind, patch, implicit, onSubmit, onToggleAdvanced? }`.
- [ ] 5.2 Assemble `KeywordInput` (with submit middleware), `TagPicker`, `WordCountRangeInput`, `NsfwToggle`, `LicensedToggle`, `TagGroupSuggestions`, and `AppliedFilterChips` with `hide={implicit}` and `rendered={[...]}`.
- [ ] 5.3 Re-export `BookSearch` from `package/app/src/book-library/index.ts`. Remove the old `BookSearchInput` and its `BookSearchContainer` alias.
- [ ] 5.4 Component test: primitives receive expected bindings; `AppliedFilterChips` correctly suppresses implicit and rendered fields.

## 6. Review domain — `ReviewSearch` composer

- [ ] 6.1 Create `package/app/src/review/components/ReviewSearch/ReviewSearch.tsx` following the same composer shape as `BookSearch`. Wire to review-relevant dimensions (at minimum `keyword`, `tags`).
- [ ] 6.2 Re-export `ReviewSearch` from the review feature's `index.ts`.
- [ ] 6.3 Component test: primitives wiring and `AppliedFilterChips` behavior.

## 7. Page layer — host `useSearchQuery`

- [ ] 7.1 `package/app/src/routes/_mainLayout/search/index.tsx` — host `useSearchQuery` at page level; render `<AdvancedSearch {...bindings} />`.
- [ ] 7.2 `package/app/src/zone/pages/ZoneSearchPage.tsx` — host `useSearchQuery` with `implicitInitial = zone.filters`; render basic (domain-appropriate composer if defined, else `AdvancedSearch`).
- [ ] 7.3 `package/app/src/routes/_mainLayout/search/` (book-scoped search, if separate from `/search`) — host with `implicitInitial = { type: ["BOOK"] }` and `BookSearch` as basic composer.
- [ ] 7.4 `package/app/src/book-library/sections/BookLibSection.tsx` — host `useSearchQuery` with `initial` seeded from `injectedTags`; render `BookSearch`. Remove `<SelectedTagChips>` usage.
- [ ] 7.5 `package/app/src/review/pages/ReviewSearchPage.tsx` and `ReviewsPage.tsx` — host `useSearchQuery`; render `ReviewSearch` / `AdvancedSearch`.
- [ ] 7.6 `package/app/src/realm/pages/RealmSearchPage.tsx` — host `useSearchQuery` with `implicitInitial = { realm: { slug } }`; render `AdvancedSearch` (no realm-specific basic composer today).
- [ ] 7.7 `package/app/src/shelf/pages/ShelfSearchPage.tsx` — host `useSearchQuery` with appropriate implicit shelf filters; render composer.
- [ ] 7.8 `package/app/src/unit/pages/UnitsPage.tsx` and `package/app/src/user/pages/UserUnitsPage.tsx` — migrate off `BookSearchInput` onto the new composer + hook.
- [ ] 7.9 `package/app/src/home/sections/HomeSearchBar.tsx` — migrate off `BookSearchInput`; host `useSearchQuery` and render `BookSearch` (or a slim home-specific composer if BookSearch is too heavy — decide at implementation time).
- [ ] 7.10 For each migrated page, add `useState<'basic' | 'advanced'>` and a toggle control (icon button) that swaps the rendered composer, preserving the `useSearchQuery` instance.

## 8. Delete legacy surfaces

- [ ] 8.1 Delete `package/app/src/search/components/SearchInput.tsx`.
- [ ] 8.2 Delete `package/app/src/search/components/SearchPanel.tsx`.
- [ ] 8.3 Delete `package/app/src/search/components/BasicSearch.tsx` (the generic one).
- [ ] 8.4 Delete `package/app/src/tag/components/SelectedTagChips.tsx`.
- [ ] 8.5 Delete the old `BookSearchInput` body (component and its alias `BookSearchContainer`). The file is replaced by the new `BookSearch` composer at the same path or a neighbouring one — decide at implementation time.
- [ ] 8.6 Update `package/app/src/search/components/index.ts` and `package/app/src/search/index.ts` to export only the new surface: primitives, `useSearchQuery`, `AdvancedSearch`, `toContentSearchOptions`, `parseSearchString`, `serializeSearchString`.
- [ ] 8.7 `rg` to confirm zero references remain to `SearchInput`, `SearchInputView`, `SearchPanel`, `SearchPanelView`, `BasicSearch` (generic), `SelectedTagChips`, `BookSearchInput`, `SearchInfo` in `package/app/src`.

## 9. Validation

- [ ] 9.1 `bun run check:convention` from the repo root passes.
- [ ] 9.2 `bun run tsc --noEmit` in `package/app`, `package/search`, and any neighbor package whose exports were touched.
- [ ] 9.3 `bun test` in `package/app` passes, including the new hook and primitive unit tests.
- [ ] 9.4 Manually smoke-test each migrated page in the dev server:
  - `/search` — advanced, no pre-applied
  - `/book` (library) — basic with injected tags via router state, advanced toggle preserves state
  - `/book/search` (if exists) — book-scoped basic + advanced
  - `/zone/:slug/search` — zone filters hidden in basic, visible in advanced
  - `/realm/.../search` — realm scope preserved
  - `/shelf/.../search` — shelf scope preserved
  - home search bar, units pages
- [ ] 9.5 Verify `TagPicker` autocomplete debouncing and the `// TODO:` note is present in its source.

## 10. Archive prep

- [ ] 10.1 Ensure every task above is checked off.
- [ ] 10.2 Update `openspec/specs/app-search-feature/spec.md` and `openspec/specs/search-state-injection/spec.md` per the deltas during archive (`/opsx:archive refactor-search-primitives`).
