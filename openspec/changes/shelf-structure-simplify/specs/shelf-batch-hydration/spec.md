## ADDED Requirements

### Requirement: Frontend groups shelf items by kind for batch hydration

The frontend SHALL group the returned `ShelfItem[]` by `kind` and issue one batch list API call per kind to hydrate item data. The grouping SHALL use existing list endpoints with an `{ ids: [...] }` payload.

#### Scenario: Shelf with mixed kinds

- **WHEN** a shelf page contains items with kinds `[book, book, review, tag, book, post]`
- **THEN** the frontend SHALL issue at most 4 parallel API calls:
  - `POST /book/list` with book ids
  - `POST /post/list` with review ids
  - `POST /tag/list` with tag ids
  - `POST /post/list` with post ids

#### Scenario: Shelf with single kind

- **WHEN** a shelf page contains only book items
- **THEN** the frontend SHALL issue exactly one API call to the book list endpoint

#### Scenario: Kind without a list endpoint renders a generic card

- **WHEN** a shelf page contains items of a kind for which no list endpoint exists
- **THEN** the frontend SHALL render those items using a generic fallback card based on `kind` and `itemRef`
- **AND** SHALL NOT issue a list call for that kind

### Requirement: Cache seeding from batch hydration

After each batch list call, the frontend SHALL seed individual item entries into the TanStack Query cache using `queryClient.setQueryData` against the corresponding detail query key. This enables cache reuse across shelf views, detail pages, search results, and other features.

#### Scenario: Book list response seeds detail cache

- **WHEN** the book list endpoint returns two books with ids `B1` and `B2`
- **THEN** the frontend SHALL call `queryClient.setQueryData(bookKeys.detail(B1), book1Data)`
- **AND** `queryClient.setQueryData(bookKeys.detail(B2), book2Data)`

#### Scenario: Previously cached item renders from cache

- **WHEN** a shelf contains item `B1` that is already present in the TanStack Query detail cache
- **THEN** the UI SHALL render `B1` immediately from the cached data
- **AND** the batch list call MAY still include `B1` for freshness

### Requirement: Frontend-driven sort modes

The frontend SHALL provide three sort modes for shelf items: `manual` (default — `position` order as returned by the API), `time` (`ShelfItem.createdAt` descending), and `title` (hydrated item title via `Intl.Collator(userLocale)`). The backend SHALL NOT accept a sort parameter.

#### Scenario: Manual sort uses API order

- **WHEN** the user selects manual sort (or uses the default)
- **THEN** items SHALL render in the `position` ASC order returned by the API

#### Scenario: Time sort orders by createdAt descending

- **WHEN** the user selects time sort
- **THEN** the frontend SHALL sort the loaded items by `ShelfItem.createdAt` descending

#### Scenario: Title sort uses locale-aware collator

- **WHEN** the user selects title sort
- **THEN** the frontend SHALL sort the loaded items by hydrated title using `Intl.Collator(userLocale)`

#### Scenario: Title sort with partial data

- **WHEN** only a subset of a shelf's items are loaded
- **THEN** title sort SHALL sort only the loaded subset
- **AND** loading additional items SHALL re-sort the expanded set

### Requirement: Orphan detection and author-triggered cleanup

The frontend SHALL detect orphaned ShelfItems (rows whose `itemRef` fails hydration) and hide them from the rendered list. On the author's next save action of any kind (add, remove, reorder, retag), the frontend SHALL include the list of orphaned `itemRef` values in the request, and the backend SHALL delete those ShelfItem rows.

#### Scenario: Hydration failure hides orphaned item

- **WHEN** a ShelfItem with `itemRef = X` fails to hydrate (404 from the list endpoint)
- **THEN** the frontend SHALL hide that item from the rendered list
- **AND** SHALL NOT show an error message

#### Scenario: Author save triggers orphan cleanup

- **WHEN** the shelf author saves any change while two orphaned itemRefs are tracked
- **THEN** the save request SHALL include both orphaned `itemRef` values
- **AND** the backend SHALL delete the corresponding ShelfItem rows in the same transaction as the save

#### Scenario: Non-author viewer does not trigger cleanup

- **WHEN** a non-author views a shelf containing orphans
- **THEN** orphans SHALL be hidden from view
- **AND** no cleanup request SHALL be sent
