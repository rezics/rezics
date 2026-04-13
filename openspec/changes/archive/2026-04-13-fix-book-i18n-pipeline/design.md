## Context

### Current State

The content search pipeline indexes units into Meilisearch via `buildContentDocument()` in `package/search/src/sync.ts`. This function has full access to Prisma `translations[]` relations but denormalizes them into flat arrays:

```
translations[] → titles[], subtitles[], summaries[], descriptions[], languages[]
```

These flat arrays are optimized for Meilisearch full-text search but lose the language→text mapping needed for rendering.

On the frontend, `useHomeBooks()` (`package/app/src/home/section/hooks/hooks.ts`) and `BookLibPage` (`package/app/src/book-library/page/BookLibPage.tsx`) receive `ContentSearchDocument` objects from search results and attempt to construct `BookDTO`-compatible objects. They pick `titles[0]` and `descriptions[0]` — losing all other translations — and never set a `translations` field. When `getBookTitle()` is called on these objects, `book.translations` is `undefined`, returning empty string.

Additionally, ~7 homepage/search components have hardcoded Chinese or English strings that bypass `react-i18next`.

### Data Flow (Current — Broken)

```
Prisma Unit + translations[]
    ↓ buildContentDocument()
ContentSearchDocument { titles: ["书名", "Title"], languages: ["zh-CN", "en"], ... }
    ↓ Meilisearch → frontend
useHomeBooks() maps to { title: titles[0], ... }  ← loses multilingual data
    ↓
getBookTitle(book) → book.translations is undefined → returns ""
```

## Goals / Non-Goals

**Goals:**
- Book titles, descriptions, and summaries render correctly on homepage and search pages
- Content renders in the user's preferred language (using existing `getTranslation()` fallback chain)
- All homepage and search UI strings use `react-i18next` with proper locale keys
- No additional API calls needed — search results contain enough data for language-aware rendering

**Non-Goals:**
- Changing the Meilisearch full-text search behavior (flat arrays remain for search)
- Implementing user language preference settings (covered by existing `multilingual-ui` spec)
- Redesigning the homepage layout (covered by `homepage-restructure-rebrand` change)
- Adding new homepage sections or changing routing

## Decisions

### Decision 1: Add structured `translations` field to ContentSearchDocument

**Choice:** Add a `translations` array of `{ language, title, subtitle, summary, description }` objects to `ContentSearchDocumentSchema` in `package/contract/src/meili/content.ts`.

**Rationale:** The `buildContentDocument()` function in `package/search/src/sync.ts` already fetches the full Prisma `translations[]` relation. We just need to pass it through to the document instead of only extracting flat arrays. This is a ~5-line change in the sync function.

**Alternatives considered:**
- *Batch-fetch BookDTOs after search* — Would require a second API call for every search result page. Adds latency, complexity, and couples the homepage to the book API.
- *Reconstruct translations from parallel arrays* — The flat arrays use `.filter(Boolean)` which removes empty entries, making positional correlation with `languages[]` unreliable.

**Integration points:**
- `package/contract/src/meili/content.ts` — Schema addition (additive, non-breaking)
- `package/search/src/sync.ts` — `buildContentDocument()` includes structured translations
- `package/search/src/client.ts` — No change needed; `translations` is a display field, not searchable/filterable

### Decision 2: Map ContentSearchDocument.translations to BookDTO.translations in hooks

**Choice:** Update `useHomeBooks()`, `useHomeShelves()`, and `BookLibPage` to use the new `translations` field from search results when constructing DTO-compatible objects, instead of picking `titles[0]`.

**Data flow (target):**

```
Prisma Unit + translations[]
    ↓ buildContentDocument()
ContentSearchDocument { 
  titles: ["书名", "Title"],          ← kept for full-text search
  translations: [                      ← NEW: for rendering
    { language: "zh-CN", title: "书名", description: "..." },
    { language: "en", title: "Title", description: "..." }
  ]
}
    ↓ Meilisearch → frontend
useHomeBooks() maps to { translations: doc.translations, ... }
    ↓
getBookTitle(book) → finds "en" translation → returns "Title" ✓
```

### Decision 3: i18n migration for hardcoded strings

**Choice:** Add translation keys under a `page.home.section.*` and `page.search.*` namespace in all five locale files. Update components to use `useTranslation()`.

**Scope:** Only touch strings in the affected components. Don't refactor component structure — just swap hardcoded text for `t()` calls.

**Locale files:** `en-US.ts`, `zh-SC.ts`, `zh-TC.ts`, `de-DE.ts`, `ja-JP.ts`. For de-DE and ja-JP, use English as placeholder where native translations aren't available — mark with `// TODO: translate` comments.

## Risks / Trade-offs

**[Meilisearch document size increase]** → Adding structured translations increases document size. Mitigation: translations are small text fields (title, subtitle, summary, description per language). Typical books have 1-3 translations. The increase is negligible compared to the existing flat arrays that already contain the same text.

**[Re-index required]** → Existing Meilisearch documents don't have the `translations` field. Mitigation: Run `syncAllContent()` after deployment. The field is optional in the schema (`t.Optional`), so the frontend gracefully handles missing data during the transition window by falling back to `titles[0]`.

**[Flat arrays and translations contain duplicate text]** → The same title text appears in both `titles[]` (for search) and `translations[]` (for display). This is intentional: flat arrays are optimized for Meilisearch's full-text search engine, structured translations are for language-aware rendering. Trade-off accepted for clean separation of concerns.
