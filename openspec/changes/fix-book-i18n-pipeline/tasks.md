## 1. Contract: Add translations field to ContentSearchDocument

- [x] 1.1 Add optional `translations` array field to `ContentSearchDocumentSchema` in `package/contract/src/meili/content.ts` — each entry: `{ language: string, title: string|null, subtitle: string|null, summary: string|null, description: string|null }`
- [x] 1.2 Verify `ContentSearchDocument` type exports compile: run `bun run build` in `package/contract`

## 2. Search: Populate translations in content sync

- [x] 2.1 Update `buildContentDocument()` in `package/search/src/sync.ts` to include `translations` array mapped from the Prisma `translations` relation (language, title, subtitle, summary, description per entry)
- [x] 2.2 Verify sync builds compile: run `bun run build` in `package/search`

## 3. Frontend: Fix useHomeBooks and useHomeShelves hooks

- [x] 3.1 Update `useHomeBooks()` in `package/app/src/home/section/hooks/hooks.ts` to map `doc.translations` into the constructed DTO's `translations` field. Add fallback: if `doc.translations` is missing, construct a single-entry array from `doc.titles[0]` and `doc.defaultLanguage`
- [x] 3.2 Update `useHomeShelves()` in the same file to include translations in the shelf DTO mapping
- [x] 3.3 Verify homepage sections render book titles by checking `getBookTitle()` returns non-empty strings with the updated DTOs

## 4. Frontend: Fix BookLibPage search result mapping

- [x] 4.1 Update the `books` mapping in `package/app/src/book-library/page/BookLibPage.tsx` to include `translations` from `ContentSearchDocument`, with the same fallback pattern as the hooks
- [x] 4.2 Remove the `as any` cast on `BookLibSectionRef` `books` prop — the mapping should now produce a proper type

## 5. i18n: Add translation keys for homepage sections

- [x] 5.1 Add keys under `page.home.section` in `package/app/src/locale/en-US.ts` for: NewBookSection (title, tabs: latest_serial, new_on_shelf, recently_completed, more), TrendingBookSection (title, more, loading), TrendingQuoteSection (title, more, empty), ActiveRealmsSection (title, more), LibraryCardsSection (book_library, game_library, media_library, coming_soon)
- [x] 5.2 Add corresponding Chinese keys in `package/app/src/locale/zh-SC.ts`
- [x] 5.3 Add corresponding keys in `package/app/src/locale/zh-TC.ts` (Traditional Chinese)
- [x] 5.4 Add corresponding keys in `package/app/src/locale/de-DE.ts` (use English placeholder with `// TODO: translate` where native translation unavailable)
- [x] 5.5 Add corresponding keys in `package/app/src/locale/ja-JP.ts` (use English placeholder with `// TODO: translate` where native translation unavailable)

## 6. i18n: Add translation keys for search components

- [x] 6.1 Add keys under `page.search` in `en-US.ts` for: SearchFilter sort labels (relevance, time, favorites, word_count, month_votes, recommendation, desc, asc), SearchInput (placeholder, tags_label, tags_hint, word_count_label, word_count_placeholder, preset tags)
- [x] 6.2 Add corresponding Chinese keys in `zh-SC.ts` for search components
- [x] 6.3 Add corresponding keys in `zh-TC.ts`, `de-DE.ts`, `ja-JP.ts` for search components

## 7. Component migration: Homepage sections to i18n

- [x] 7.1 Update `NewBookSection.tsx` — import `useTranslation`, replace "最新作品", tab labels, "更多 →", "Loading..." with `t()` calls
- [x] 7.2 Update `TrendingBookSection.tsx` — replace "趋势好书", "更多 →", "Loading..." with `t()` calls
- [x] 7.3 Update `TrendingQuoteSection.tsx` — replace "热门摘录", "更多 →", "暂无摘录" with `t()` calls
- [x] 7.4 Update `ActiveRealmsSection.tsx` — replace "Active Realms", "More" with `t()` calls
- [x] 7.5 Update `LibraryCardsSection.tsx` — replace "Book Library", "Game Library", "Media Library", "Coming Soon" with `t()` calls

## 8. Component migration: Search components to i18n

- [x] 8.1 Update `SearchFilter.tsx` — replace all hardcoded Chinese sort labels (搜索相关性, 最新, 总收藏, 总字数, 月票, 推荐, 降序, 升序) with `t()` calls
- [x] 8.2 Update `SearchInput.tsx` — replace hardcoded placeholder, "Tags", "Word Count", tag hint text, and preset tag labels with `t()` calls

## 9. Validation

- [x] 9.1 Run `bun run build` across all affected packages (contract, search, app) to verify compilation (note: app build has pre-existing i18next MISSING_EXPORT error unrelated to this change)
- [x] 9.2 Start dev server (`bun run app:dev`) and verify homepage renders book titles and descriptions (manual verification required)
- [x] 9.3 Verify book search page at `/book/search` renders titles and descriptions from search results (manual verification required)
- [x] 9.4 Switch UI language and verify homepage sections and search labels change accordingly (manual verification required)
- [x] 9.5 Trigger Meilisearch re-index (`syncAllContent`) to populate the new `translations` field in existing documents (manual verification required)
