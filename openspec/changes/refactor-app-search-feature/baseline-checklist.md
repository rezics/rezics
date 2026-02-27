# Baseline Behavior Checklist (refactor-app-search-feature)

## Existing Search Flows to Preserve

- Book search keyword submission from search input triggers `/book` result refresh.
- Search tags are serialized and can be restored from URL search parameters.
- Optional filters (`nsfw`, `isLicensed`, `textLength`) are preserved when supported by caller.
- Search loading state remains non-blocking and page stays interactive.
- Empty search results show existing empty-state behavior without runtime errors.
- Request errors render recoverable error UI without crashing surrounding layout.

## Header Search Behavior Targets

- Desktop home route (`/`) shows visible search input in main header.
- Mobile home route (`/`) shows search button in top bar.
- Mobile search button toggles a search bar rendered below top bar.
- Mobile submit closes expanded search panel and navigates to `/book` query route.

## Accessibility / Localization Baseline

- Search controls keep localized labels/placeholders (`t('placeholders.search_books')`).
- Search button keeps `aria-label` for assistive technologies.
- Desktop and mobile wrappers preserve same input semantics (enter-to-submit and click-to-submit).
