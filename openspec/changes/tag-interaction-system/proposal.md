## Why

Tags on the book detail page are currently non-functional. The hero section renders tag labels from `BookDTO.tags` — a flat `{ tagUnitId, label, score }` structure where `label` is an optional string with no language awareness. Clicking a tag navigates to `/book?tags=<label>` which passes a display string instead of a stable identifier, does not support multiple tags, and does not integrate with the new unified search system. Meanwhile, the tag system's actual data model (tags as Units with `UnitTranslation`, scored via `UnitTag`) is fully in place but the frontend display layer hasn't caught up. This change builds the interactive tag layer that connects the existing tag data model to the book detail UI and the search system, with full multilingual support and zero-latency search navigation.

**Prerequisite**: This change runs after `book-detail-restructure`, which provides the Overview tab, page-wide language switching, and the new tab layout.

## What Changes

### Tag Display — Multilingual via Batch Translation Query

- **BREAKING** (on `BookDTO`): Remove the `tags` field (array of `scoredTagBriefSchema`) from `BookDTO`. Tag display data is no longer embedded in the book detail response. Instead, `UnitTag` records (from `tagQueries.list({ unitId })`) provide `tagUnitId` + `score` + `voteCount`, and a new batch translation query resolves tag labels, slugs, and descriptions for the selected language.
- Add a new API query: batch-resolve tag unit translations given an array of `tagUnitId[]` and a `language` parameter. Returns `Map<tagUnitId, { name, slug, description }>`. This query is used by both the hero tag chips and the Overview tag section.
- Tag labels in the hero and Overview tab follow the page-wide language selection from `book-detail-restructure`.

### Tag Interaction Component — Popper Detail + Multi-Select

- Build a reusable `TagInteraction` component for the Overview tab's tag section. Tags render as clickable chips.
- **Single click**: Opens a non-modal MUI `Popper` anchored to the clicked chip with an arrow. The popper displays: translated tag name, description, score, vote count, upvote/downvote buttons, and a "Search this tag" button. The popper has a close (x) button and does not block interaction with other chips.
- **Multi-select**: Clicking a second chip while a popper is open closes the popper and enters multi-select mode — both chips become selected (visually highlighted). In multi-select mode, clicking chips toggles their selection. A search action bar appears showing the count of selected tags and a "Search selected tags" button. Deselecting all tags returns to the default state.
- **Search navigation**: Both single-tag search (from popper) and multi-tag search (from multi-select bar) navigate to the search page with tag data injected via router state.

### Search Page Injection — Pre-Resolved Tag Data

- When navigating from tag interaction to the search page, pass pre-resolved tag objects (`{ slug, unitId, name }`) via TanStack Router's `state` mechanism. The URL uses the existing `[slug]` search syntax for shareability (`/search?q=[isekai][adventure]`).
- The search page checks for `injectedTags` in router state. If present, it uses them directly for chip display and search execution without re-querying. If absent (e.g., shared URL, direct navigation), it falls back to resolving slugs from the URL via API.

### Hero Tag Cleanup

- Remove `getBookTagLabels()` from `translation-helpers.ts`. Replace hero tag rendering with the new batch translation query + language-aware tag chips. Tag chips in the hero link to single-tag search with injection.

## Capabilities

### New Capabilities

- `tag-batch-translation`: Batch translation query for tag units — resolves `tagUnitId[]` + `language` to `{ name, slug, description }` per tag. Used by hero and Overview tag sections.
- `tag-interaction-component`: Reusable tag interaction UI with three states (idle, single-preview via Popper, multi-select). Supports tag detail display, voting, single-tag search, and multi-tag search.
- `search-state-injection`: Router state injection mechanism for pre-resolved search filter data. Search page accepts injected tag objects to skip resolution queries. Falls back to API resolution when no injection is present.

### Modified Capabilities

- `app-search-feature`: Search page must accept pre-resolved tag data via router state and use it when available, falling back to slug-based resolution otherwise.
- `tag-scoring`: `UnitTagDTO` removes `tagLabel` field — tag display labels are resolved via the batch translation query, not embedded in the scored junction DTO.
- `content-search-contract`: `BookDTO` removes the `tags` field (`scoredTagBriefSchema[]`). Tag data for display is fetched independently via `tagQueries.list()` + batch translation.

## Impact

### Affected Packages

- `@rezics/contract` — Remove `scoredTagBriefSchema` and `tags` field from `BookDTO`. Remove `tagLabel` from `unitTagDTOSchema`. Add batch tag translation query/response types.
- `@rezics/server` — Add batch tag translation endpoint (resolve `tagUnitId[]` + `language` → translated tag data). Remove `tags` population from book detail mapper.
- `@rezics/api` — Add `tagQueries.batchTranslations(tagUnitIds, lang)` query hook. Update any consumers of `BookDTO.tags`.
- `@rezics/app` — New `TagInteraction` component (Popper detail card, multi-select state machine, search navigation with injection). Update `BookHeroSection` tag rendering. Update search feature to accept injected state. Remove `getBookTagLabels()`.

### Backward Compatibility

- **BREAKING**: `BookDTO.tags` removal affects any consumer reading this field. A `grep` for `bookInfo?.tags`, `book.tags`, `getBookTagLabels` identifies all call sites. Migration: replace with `tagQueries.list({ unitId })` + batch translation.
- **BREAKING**: `UnitTagDTO.tagLabel` removal. Migration: use batch translation query instead.
- Search page URL format is unchanged (`[slug]` syntax) — existing bookmarks and shared links continue to work via the fallback resolution path.
