## 1. Contract Changes — Remove Embedded Tag Data

- [ ] 1.1 Remove `scoredTagBriefSchema` and the `tags` field from `BookDTO` in `package/contract/src/book.ts`
- [ ] 1.2 Remove `tagLabel` field from `unitTagDTOSchema` in `package/contract/src/tag.ts`
- [ ] 1.3 Add batch tag translation request/response types to `package/contract/src/tag.ts`: `BatchTagTranslationQuery` (`{ unitIds: string[], language: string }`) and `BatchTagTranslationResult` (`Record<string, { name: string, slug: string, description: string }>`)
- [ ] 1.4 Run `bun run tsc --noEmit` in `package/contract` to verify type changes compile

## 2. Server — Batch Translation Endpoint

- [ ] 2.1 Add `GET /api/tags/batch-translations` endpoint in `package/server/src/tag/` that accepts `unitIds` (comma-separated string) and `lang` query parameters. Resolves each tag unit's translation via the standard resolution chain. Returns `Record<unitId, { name, slug, description }>`
- [ ] 2.2 Remove `tags` population from the book detail mapper/service (the field that was populating `BookDTO.tags`)
- [ ] 2.3 Remove `tagLabel` population from UnitTag query results in the tag service
- [ ] 2.4 Run `bun run tsc --noEmit` in `package/server` to verify no type errors

## 3. API Layer — Query Hooks

- [ ] 3.1 Add `tagQueries.batchTranslations(tagUnitIds: string[], lang: string)` query option in `package/api/src/tag/`. Query key: `['tags', 'translations', sortedIds, lang]`. Calls the new batch translation endpoint
- [ ] 3.2 Verify `tagQueries.list({ unitId })` still works correctly after `tagLabel` removal (it returns `UnitTagDTO[]` without label — consumers must use batch translation for display)
- [ ] 3.3 Update any existing consumers of `BookDTO.tags` in `package/api/` (if any query hooks reference this field)

## 4. Hero Tag Cleanup

- [ ] 4.1 Remove `getBookTagLabels()` from `package/app/src/shared/util/translation-helpers.ts`
- [ ] 4.2 Refactor `BookHeroSection.tsx` tag rendering: replace `getBookTagLabels(bookInfo)` with `tagQueries.list({ unitId: bookId })` + `tagQueries.batchTranslations(tagUnitIds, selectedLang)`. Tag chips display translated names and navigate to search with injection
- [ ] 4.3 Verify hero tag chips follow page-wide language selection from `useBookLanguage(bookId)`

## 5. Tag Interaction Component

- [ ] 5.1 Create `TagInteraction` component in `package/app/src/tag/component/TagInteraction.tsx`. Props: `tags: UnitTagDTO[]`, `translations: Map<string, { name, slug, description }>`, `bookUnitId: string`. Renders tag chips with click handlers
- [ ] 5.2 Implement `useTagInteractionReducer` with three states (idle, single-preview, multi-select) and defined transitions. Actions: `CLICK_CHIP`, `CLOSE_POPPER`, `DESELECT_ALL`
- [ ] 5.3 Build the Popper detail card: MUI `Popper` with arrow, placement="bottom", containing tag name, description, score, vote count, upvote/downvote buttons (calling existing `castTagVote` API), "Search this tag" button, and close (✕) button
- [ ] 5.4 Build the multi-select search action bar: shows selected count, "Search selected tags" button. Appears when 2+ tags are selected
- [ ] 5.5 Implement selected chip visual state (highlighted style) for multi-select mode

## 6. Search State Injection

- [ ] 6.1 Define the `InjectedSearchState` type in `package/app/src/search/model/`: `{ injectedTags?: Array<{ slug: string, unitId: string, name: string }> }`
- [ ] 6.2 Create `useInjectedTags()` hook in `package/app/src/search/hooks/` that reads `injectedTags` from TanStack Router's `state` on mount. Returns the injected array or `undefined`
- [ ] 6.3 Update the search page initialization logic: if `useInjectedTags()` returns data, hydrate the search state with these tag objects directly (render chips, set unitIds for search query). If undefined, fall back to parsing `[slug]` from URL and resolving via API
- [ ] 6.4 Implement navigation helper `navigateToTagSearch(tags: Array<{ slug, unitId, name }>, navigate)` in `package/app/src/search/` that constructs the URL with `[slug]` syntax and passes full objects in router state. Used by both TagInteraction (single and multi) and hero tag chips

## 7. Overview Tab Integration

- [ ] 7.1 Add `TagInteraction` component to the Overview tab (from `book-detail-restructure`), replacing the current `TagWrapper` usage in `BookBasicInfoPage`. Pass `tagQueries.list()` data + batch translations
- [ ] 7.2 Verify tag display follows page-wide language selection
- [ ] 7.3 Verify single-click popper opens with correct tag detail, voting works, and search navigation injects tag data
- [ ] 7.4 Verify multi-select mode activates on second chip click, search bar appears, and navigation injects all selected tags

## 8. Migration Cleanup

- [ ] 8.1 Grep for `bookInfo?.tags`, `book.tags`, `BookDTO` tag references, `getBookTagLabels`, `scoredTagBriefSchema` across the entire codebase. Replace or remove all remaining references
- [ ] 8.2 Grep for `tagLabel` references in frontend code and update consumers to use batch translation instead
- [ ] 8.3 Update `package/app/src/book-library/index.ts` exports if any tag-related exports changed

## 9. Validation

- [ ] 9.1 Run `bun run tsc --noEmit` in `package/contract`, `package/server`, `package/api`, and `package/app`
- [ ] 9.2 Run existing tag-related tests: `bun test` in `package/app` (includes `TagTest.test.tsx` and `searchQuery.test.ts`)
- [ ] 9.3 Run `bun run app:dev` and manually verify: hero tag chips display translated names, clicking a tag opens popper with detail/vote/search, clicking a second tag enters multi-select, search navigation lands on search page with pre-rendered tag chips, refreshing the search page still works (fallback resolution), language switching updates tag labels
- [ ] 9.4 Run `bun run knip` at root to check for unused exports after migration cleanup
