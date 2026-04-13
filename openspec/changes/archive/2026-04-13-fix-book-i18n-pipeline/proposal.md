## Why

Book titles, descriptions, and summaries do not render on the homepage or search results pages. The root cause is a broken data pipeline: `useHomeBooks()` and `BookLibPage` map Meilisearch `ContentSearchDocument` objects into pseudo-`BookDTO`s that lack the `translations[]` array. When `getBookTitle()` receives these objects, `book.translations` is `undefined`, so it returns an empty string. The multilingual data exists in the Meilisearch index but is stored as denormalized flat arrays (`titles[]`, `descriptions[]`) with no language→text mapping — making it impossible to reconstruct `UnitTranslationDTO[]` from search results alone.

Additionally, ~7 homepage and search components have hardcoded Chinese or English strings that bypass the existing `react-i18next` infrastructure, breaking the UI for non-default language users.

This change fixes both problems so that all content renders correctly in the user's preferred language — a prerequisite for the planned homepage restructure and REZICS rebrand.

## What Changes

- **Add a `translations` field to `ContentSearchDocument`** — a structured array of `{ language, title, subtitle, summary, description }` objects indexed alongside the existing flat text arrays. This preserves Meilisearch full-text search on the flat arrays while providing structured data for rendering.
- **Update the content sync pipeline** to populate the new `translations` field when indexing units.
- **Fix `useHomeBooks()` hook** (`package/app/src/home/section/hooks/hooks.ts`) to construct proper `BookDTO`-compatible objects using the structured translations from search results.
- **Fix `BookLibPage` mapping** (`package/app/src/book-library/page/BookLibPage.tsx`) — same broken pattern, same fix.
- **Fix `useHomeShelves()` hook** — same pattern for shelf content.
- **Migrate hardcoded strings to i18n** in these components:
  - `NewBookSection.tsx` — 最新作品, 最新连载, 最新上架, 近期完结, 更多 →
  - `TrendingBookSection.tsx` — 趋势好书, 更多 →, Loading...
  - `TrendingQuoteSection.tsx` — 热门摘录, 更多 →, 暂无摘录
  - `ActiveRealmsSection.tsx` — Active Realms, More
  - `LibraryCardsSection.tsx` — Book Library, Game Library, Media Library, Coming Soon
  - `SearchFilter.tsx` — 搜索相关性, 最新, 总收藏, 总字数, 月票, 推荐, 降序, 升序
  - `SearchInput.tsx` — placeholder text, Tags, Word Count, preset tag labels
- **Add missing translation keys** to all five locale files (en-US, zh-SC, zh-TC, de-DE, ja-JP).

## Capabilities

### New Capabilities

- `content-search-translations`: Structured translation data in Meilisearch content search documents, enabling language-aware rendering from search results without a second API call.

### Modified Capabilities

- `content-search-api`: ContentSearchDocument schema gains a `translations` field; content sync must populate it.
- `multilingual-ui`: Homepage and search components adopt translation helpers and i18n for UI strings — fulfilling the spec's requirement that all unit views display content in the user's preferred language.

## Impact

- **`package/contract`** — `ContentSearchDocumentSchema` gains a `translations` field.
- **`package/server`** — Content sync pipeline must include structured translations when indexing to Meilisearch.
- **`package/app`** — `useHomeBooks`, `useHomeShelves`, `BookLibPage` mapping logic rewritten; ~7 components updated with `useTranslation()` hooks; locale files updated with new keys.
- **Meilisearch index** — Existing documents need re-indexing to include the new `translations` field. This is a non-breaking addition (the field is optional for search; existing flat arrays remain for full-text search).
- **Backward compatibility** — No breaking changes. The flat `titles[]`/`descriptions[]` arrays remain for Meilisearch full-text search. The new `translations` field is additive. Frontend components that already use `getBookTitle()` will start working correctly without changes.
