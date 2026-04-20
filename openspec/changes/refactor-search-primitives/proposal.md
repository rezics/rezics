## Why

The current search architecture in `package/app/src/search` is built around a monolithic `SearchInput` (+ `SearchInputView` MVP split) that bundles keyword, tags, word count, NSFW, licensed, and tag-group suggestion controls in one component. Domain surfaces like `BookSearch` and `AdvancedSearch` then *consume* this monolith instead of composing smaller parts, which has produced three concrete defects:

1. `BookSearchInput` in `package/app/src/book-library/components/BookSearch/BookSearch.tsx` is a thin shell around `SearchInput`; `AdvancedSearch` cannot reuse `SearchInput`'s shape and reimplements keyword/tags/type/sort/nsfw/licensed inputs from scratch — two parallel implementations of the same controls drift out of sync.
2. The tag filter is rendered as a `<TextField>` of comma-separated slug text (`search.input.tags_label`), which is not a usable tag picker. Meanwhile `package/app/src/tag/components/SelectedTagChips.tsx` duplicates the "tags as chips" responsibility for injected tags, producing two unrelated ways to display the same concept on the same page (`BookLibSection.tsx`).
3. Two parallel query shapes (`SearchInfo` and `SearchQuery`) exist for what is logically the same model, and the split between "pre-applied filters" (zone) and "injected filters" (router state) is ad-hoc — each callsite invents its own read-only chip display.

We are refactoring the search feature into a set of **pure, controlled primitives** with a single state hook, so that every domain composer (`BookSearch`, `ReviewSearch`, `AdvancedSearch`, etc.) assembles only the primitives it needs and shares one canonical query model.

## What Changes

- **BREAKING**: Remove `SearchInput` / `SearchInputView` / `SearchPanel` / `SearchPanelView` / the generic `BasicSearch` from `@/search`. Encapsulation moves to domain composers.
- **BREAKING**: Remove `BookSearchInput` as a shell. Replace with a real `BookSearch` composer that assembles primitives directly.
- **BREAKING**: Remove `SelectedTagChips` from `@/tag/components`. Its responsibilities merge into the new `TagPicker` primitive (editable chip display) and `AppliedFilterChips` (non-zone injection echo in basic mode).
- **BREAKING**: Collapse `SearchInfo` into `SearchQuery` as the single canonical query shape. `toContentSearchOptions` becomes the sole mapper to `ContentSearchOptions`.
- Add new primitive components under `search/components/`: `KeywordInput`, `TagPicker`, `ContentTypeCheckboxes`, `PostKindCheckboxes`, `SortSelect`, `NsfwToggle`, `LicensedToggle`, `WordCountRangeInput`, `TagGroupSuggestions`. All primitives are stateless (`{value, onChange}` controlled).
- Add `useSearchQuery({ initial, implicitInitial, middleware })` hook in `search/hooks/`. It returns `{ query, implicit, patch, bind, toOptions }` and is the single state home for a search session. `bind(field)` returns `{ value, onChange }` for a primitive.
- Rewrite `AdvancedSearch` as the single shared "full filter panel" composer that includes content type, post kind, and every other global dimension.
- Move the `useSearchQuery` call site to the **page layer** so that basic↔advanced mode switching preserves query state without prop drilling.
- `KeywordInput` supports an opt-in `middleware` prop (typed query string parser) that fires **only on submit** (Enter / icon button) and emits a `Partial<SearchQuery>` patch. Parser output is **appended** (union for array fields, overwrite for scalars), never replaces existing `tags` / `type` / `postKind` entries.
- Reframe "pre-applied" filters as `implicitInitial`: hidden in basic mode, visible and editable in advanced mode. All other notionally "injected" filters (route state, URL) are just `initial` and display as chips in basic mode via `AppliedFilterChips`.
- Keep `AppliedFilterChips` but give it a `hide` prop (accepts `implicit`) and a `rendered` prop (list of fields already surfaced by a primitive) so composers explicitly declare the residual chip set.
- TagPicker talks to the server for slug autocomplete via a temporary endpoint. Inline `TODO:` in `TagPicker.tsx` points at future Meilisearch tag-index migration.

## Capabilities

### New Capabilities

_(none — this is a restructuring of existing capabilities)_

### Modified Capabilities

- `app-search-feature`: Replaces the monolithic component contract (`SearchInput`, generic `BasicSearch`, the previous `AdvancedSearch`) with a primitive-plus-composer contract. Redefines how pre-applied filters are represented (`implicitInitial` vs `initial`) and how mode switching preserves state (page-level `useSearchQuery`). Keeps the syntax integration and multilingual behavior, but re-targets them at the new composition model.
- `search-state-injection`: Generalizes the "injected tags via router state" mechanism into the unified injection model. `injectedTags` becomes one source of `initial`; zone filters are `implicitInitial`; both flow through the same `useSearchQuery` without the search page distinguishing them by source.

## Impact

- **Affected packages**
  - `package/app`: all search-feature code (`src/search/**`), `src/book-library/components/BookSearch/**`, `src/book-library/sections/BookLibSection.tsx`, `src/tag/components/SelectedTagChips.tsx`, `src/routes/_mainLayout/search/**`, `src/review/pages/ReviewSearchPage.tsx`, `src/realm/pages/RealmSearchPage.tsx`, `src/zone/pages/ZoneSearchPage.tsx`, `src/shelf/pages/ShelfSearchPage.tsx`, `src/unit/pages/UnitsPage.tsx`, `src/user/pages/UserUnitsPage.tsx`, `src/home/sections/HomeSearchBar.tsx`.
  - No backend changes (`package/server`, `package/contract`, `package/api`) — `SearchQuery` / `ContentSearchOptions` are the existing contract and remain unchanged.
- **Backward compatibility**: intentionally broken within `@rezics/app`. Callsites that import `SearchInput`, `SearchInputView`, `SearchPanel`, `BookSearchInput`, generic `BasicSearch`, or `SelectedTagChips` must migrate to the new composers or primitives. No external consumers (the search feature is app-internal).
- **Migration**: the change is delivered in one atomic refactor — all callsites updated in the same PR.
- **Dependencies / infrastructure**: no new runtime deps. Temporary server call for tag slug matching re-uses existing tag endpoints; flagged with `TODO:` in `TagPicker.tsx` for future Meilisearch tag-index migration.
- **Risk**: small regression risk on pages that currently rely on `SearchInput`'s implicit URL sync effect (`useEffect` on `/book`). The new page-level `useSearchQuery` replaces this, but each affected page must be smoke-tested.
