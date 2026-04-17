# Search Feature Migration Notes

## Summary

The `app/search` feature now follows the app-feature layered structure:

- `model`: pure search entities and normalization/parser rules
- `hooks`: feature-local navigation and orchestration hooks
- `util`: technical query parse/serialize helpers
- `state`: header mobile expand/collapse state
- `component`: presentational search input/filter/panel components
- `section`: desktop/mobile main-header search composition
- `page`: reserved thin page entry layer
- `index.ts`: feature public export entry

## Breaking API Changes

The following exports were removed from search component entry:

- `Show`
- `Container`
- `Filter`
- `panelShow`
- `panelContainer`
- `Search` aggregated namespace (`Search.Show`, `Search.Container`, `Search.Filter`, `Search.panel.*`)

## New Import Contract

Use explicit named imports from `@/search`:

- `SearchInput`
- `BookSearchFilter`
- `SearchPanel`
- `SimpleSearchInput`
- search model/types (`SearchInfo`, parser/normalize helpers)

Avoid deep imports from `@/search/components/*` outside the feature.

## Header Home Search Behavior

Home search is now integrated in `MainLayout` header:

- Desktop: search input is visible in header on home route.
- Mobile: search button is shown in header on home route; tapping opens search input below top bar.

Both wrappers reuse the same base input component (`HomeSearchInputBase`) and navigate to `/book` with query parameters.
