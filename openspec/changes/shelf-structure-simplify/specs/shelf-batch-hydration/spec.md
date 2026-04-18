## ADDED Requirements

### Requirement: Frontend groups shelf items by kind for batch hydration

The frontend SHALL group ShelfItem results by `kind` and issue one batch list API call per kind to hydrate item data. The grouping SHALL use existing POST list endpoints with `{ ids: [...] }` parameter.

#### Scenario: Shelf with mixed item kinds

- **WHEN** a shelf contains items with kinds `[book, book, review, tag, book, post]`
- **THEN** the frontend SHALL issue at most 4 API calls:
  - `POST /book/list { ids: [book-ids] }`
  - `POST /post/list { ids: [review-ids], kind: 'REVIEW' }`
  - `POST /tag/list { ids: [tag-ids] }`
  - `POST /post/list { ids: [post-ids] }`

#### Scenario: Shelf with single kind

- **WHEN** a shelf contains only book items
- **THEN** the frontend SHALL issue exactly 1 API call to `POST /book/list`

### Requirement: Cache seeding from batch hydration

After each batch list API call, the frontend SHALL seed individual item entries into the TanStack Query cache using `queryClient.setQueryData` with the corresponding detail query key. This enables cache reuse across shelf views, detail pages, search results, and other features.

#### Scenario: Book list response seeds detail cache

- **WHEN** `POST /book/list { ids: ["book-1", "book-2"] }` returns two book objects
- **THEN** the frontend SHALL call `queryClient.setQueryData(bookKeys.detail("book-1"), book1Data)`
- **AND** `queryClient.setQueryData(bookKeys.detail("book-2"), book2Data)`

#### Scenario: Previously cached item skips redundant fetch

- **WHEN** a shelf contains "book-1" which is already in TanStack Query cache from a previous page visit
- **THEN** the cached data SHALL be used for rendering
- **AND** the batch query MAY still include "book-1" for freshness, but the UI SHALL render immediately from cache

### Requirement: Frontend-driven sorting

The frontend SHALL support three sort modes on loaded shelf items: manual (structure.units order, default), time (ShelfItem.createdAt), and title (hydrated item title using `Intl.Collator` with the user's locale). Title sort SHALL only cover items currently loaded in the TanStack Query cache.

#### Scenario: Sort by manual order

- **WHEN** the user selects manual sort (or uses default)
- **THEN** items SHALL render in `structure.units` order as returned by the API

#### Scenario: Sort by time

- **WHEN** the user selects time sort
- **THEN** items SHALL be sorted by `ShelfItem.createdAt` descending

#### Scenario: Sort by title

- **WHEN** the user selects title sort and 200 items are loaded across 2 pages
- **THEN** all 200 items SHALL be sorted alphabetically by their hydrated title
- **AND** sorting SHALL use `Intl.Collator(userLocale)` for locale-aware comparison

#### Scenario: Title sort with partial data

- **WHEN** a shelf has 300 items but only 100 are loaded
- **THEN** title sort SHALL sort only the 100 loaded items
- **AND** loading more items SHALL re-sort the expanded set

### Requirement: Orphan detection and cleanup

The frontend SHALL detect orphaned items (items in structure.units or ShelfItem rows whose hydration fails) and hide them during rendering. When the author next saves any edit to the shelf, the frontend SHALL send a cleanup request to remove orphaned ShelfItem rows and their references from structure.units.

#### Scenario: Hydration failure hides orphaned item

- **WHEN** a shelf item "book-1" fails hydration (404 from batch list API)
- **THEN** "book-1" SHALL be hidden from the rendered list
- **AND** no error message SHALL be shown to the user

#### Scenario: Author edit triggers orphan cleanup

- **WHEN** the author reorders items in a shelf that contains 2 orphaned items
- **THEN** the save request SHALL include orphaned itemRefs for deletion
- **AND** the backend SHALL remove the orphaned ShelfItem rows
- **AND** the backend SHALL remove the orphaned itemRefs from structure.units
