## ADDED Requirements

### Requirement: Frontend groups shelf items by kind-to-endpoint for batch hydration

The frontend SHALL group the returned `ShelfItem[]` by the list endpoint associated with each slot's `kind` and issue one batch list API call per distinct endpoint to hydrate item data. The grouping SHALL use existing list endpoints with an `{ ids: [...] }` payload. Kinds that map to the same endpoint (e.g. `review`, `quote`, `post` all use `/post/list`) SHALL be merged into a single call.

#### Scenario: Shelf with mixed kinds that share endpoints

- **WHEN** a shelf page contains items with kinds `[book, book, review, tag, book, post]`
- **THEN** the frontend SHALL issue exactly 3 parallel API calls:
  - `POST /book/list` with the three book ids
  - `POST /post/list` with the review and post ids combined
  - `POST /tag/list` with the tag id

#### Scenario: Shelf with single kind

- **WHEN** a shelf page contains only book items
- **THEN** the frontend SHALL issue exactly one API call to the book list endpoint

#### Scenario: Kind without a list endpoint renders a generic card

- **WHEN** a shelf page contains items of a kind for which no list endpoint exists
- **THEN** the frontend SHALL render those items using a generic fallback card based on `kind` and `itemRef`
- **AND** SHALL NOT issue a list call for that kind

### Requirement: Attachments hydrate through the same pipeline

The per-slot `reviewIds: string[]` and `tagIds: string[]` arrays returned by the shelf items endpoint (projected from `ShelfUnit`) are unit ids. The frontend SHALL hydrate them through the same kind-grouped batch-list pipeline used for primary slots, rather than through a dedicated attachment-fetch path.

#### Scenario: Reviews and tags join the same batch

- **WHEN** a shelf page has book slots whose `reviewIds` reference Post units and `tagIds` reference Tag units
- **THEN** the review unit ids SHALL be folded into the `/post/list` batch alongside any primary `review`/`post`/`quote` kinds
- **AND** the tag unit ids SHALL be folded into the `/tag/list` batch alongside any primary `tag` kinds

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

The frontend SHALL detect orphaned slots (rows whose primary `itemRef` fails hydration, typically because the referenced Unit was deleted externally) and hide them from the rendered list. On the author's next save action of any kind (add, remove, reorder, attach review, detach review, set tags), the frontend SHALL include the list of orphaned `itemRef` values in the request, and the backend SHALL delete those `ShelfItem` rows — the cascade to `ShelfUnit` handles the rest.

#### Scenario: Hydration failure hides orphaned slot

- **WHEN** a slot with `itemRef = X` fails to hydrate (no entry returned by the list endpoint for kind)
- **THEN** the frontend SHALL hide that slot from the rendered list
- **AND** SHALL NOT show an error message

#### Scenario: Author save triggers orphan cleanup

- **WHEN** the shelf author saves any change while two orphaned itemRefs are tracked
- **THEN** the save request SHALL include both orphaned `itemRef` values
- **AND** the backend SHALL delete the corresponding `ShelfItem` rows in the same transaction as the save
- **AND** cascading FKs SHALL delete the orphaned `ShelfUnit` rows bound to those slots

#### Scenario: Non-author viewer does not trigger cleanup

- **WHEN** a non-author views a shelf containing orphans
- **THEN** orphans SHALL be hidden from view
- **AND** no cleanup request SHALL be sent

### Requirement: Kind dispatches to domain card with full hydrated DTO

The shelf renderer SHALL switch on `ShelfItem.kind` and delegate rendering to the existing domain card for that kind, feeding it the full DTO read from the TanStack Query detail cache (not a pre-extracted title string). The mapping SHALL be:

| `kind` | Component | DTO source key |
| --- | --- | --- |
| `book` | `BookCard` | `bookKeys.detail(itemRef)` |
| `review` | `ReviewCard` | `postKeys.detail(itemRef)` |
| `quote` | `ExcerptCard` | `postKeys.detail(itemRef)` |
| `post` | `PostCard` | `postKeys.detail(itemRef)` |
| `tag` | `SingleTagChip` | `tagKeys.detail(itemRef)` |
| any other kind | generic fallback shell | none |

The renderer SHALL NOT accept a pre-computed `title` string as a prop.

#### Scenario: Book kind renders with cover and metadata

- **WHEN** a shelf contains an item with `kind = "book"` and the book batch has seeded `bookKeys.detail(itemRef)` with a `BookDTO` including `coverUrl` and `translations`
- **THEN** the renderer SHALL output a `BookCard` with `coverUrl`, title (from `translations[0].title`), and attribution-derived author drawn directly from the cached `BookDTO`
- **AND** the output SHALL NOT fall back to displaying the raw `itemRef`

#### Scenario: Review kind renders full review card

- **WHEN** a shelf contains an item with `kind = "review"` and the post batch has seeded `postKeys.detail(itemRef)` with the review's `PostDTO`
- **THEN** the renderer SHALL output a `ReviewCard` with the full `PostDTO`, showing the review body, rating, and any book metadata embedded in `extra`

#### Scenario: Tag kind renders tag chip

- **WHEN** a shelf contains an item with `kind = "tag"` and the tag batch has seeded `tagKeys.detail(itemRef)`
- **THEN** the renderer SHALL output a `SingleTagChip` fed the cached tag DTO

#### Scenario: Unsupported kind renders minimal shell without network activity

- **WHEN** a shelf contains an item with `kind` not in the dispatch table (e.g. `realm`, `game`, `link`, `image`, `video`, `media`, `chapter`)
- **THEN** the renderer SHALL output a generic shell showing a `Chip` labelled with the kind plus a shortened `itemRef`
- **AND** SHALL NOT issue any list-endpoint request for that item

#### Scenario: Hydration pending renders null, not placeholder

- **WHEN** the renderer attempts to read a cached DTO for a supported kind but the cache entry is not yet populated
- **THEN** the renderer SHALL return `null` for that item
- **AND** SHALL re-render the correct card once `useShelfHydration` resolves and seeds the cache

### Requirement: Attached reviews render under the primary item

For each primary `ShelfItem`, the renderer SHALL render every id in `item.reviewIds` as a `ReviewCard`, sourcing each `PostDTO` from `postKeys.detail(reviewId)` seeded by the shared post batch.

#### Scenario: Book item with two attached reviews in review view mode

- **WHEN** a book item has `reviewIds = [R1, R2]` and the shelf is rendered in `review` view mode
- **THEN** the renderer SHALL output the `BookCard` followed by two `ReviewCard`s — one for `R1`, one for `R2` — with each review's `PostDTO` sourced from the seeded cache

#### Scenario: Attached review failed to hydrate is silently omitted

- **WHEN** an attached `reviewId` was included in the `/post/list` batch but the response did not include it (e.g. deleted externally)
- **THEN** the renderer SHALL omit that review from the output
- **AND** SHALL NOT mark the primary item as orphaned on account of the missing attachment

#### Scenario: View mode gates attachment rendering

- **WHEN** the shelf is rendered in `grid` or `list` view mode
- **THEN** attached `ReviewCard`s SHALL NOT render inline; the existing count affordance remains
- **WHEN** the shelf is rendered in `review` view mode
- **THEN** attached reviews SHALL render inline beneath their primary item

### Requirement: Title derivation is a pure sort-only helper

Title derivation for the `title` sort mode SHALL live in a pure helper function separate from the rendering path. The rendering path SHALL NOT consume the helper; cards read the DTO they need directly. The helper SHALL accept an item and the cached DTO for that item and SHALL return a string usable by `Intl.Collator`.

#### Scenario: Title-mode sort uses helper for each kind

- **WHEN** the user selects title sort
- **THEN** `ShelfPage` SHALL derive a sort key per item by calling the helper with `(item, queryClient.getQueryData(detailKeyFor(item)))`
- **AND** SHALL compare the resulting strings with `Intl.Collator(userLocale)` in manual-position ties

#### Scenario: Helper falls back to itemRef when no cached DTO

- **WHEN** the helper is called with an item whose cache entry is empty or whose kind has no detail cache
- **THEN** the helper SHALL return `item.itemRef` as the sort key
- **AND** sorting SHALL remain stable as hydration fills in real titles on subsequent renders

#### Scenario: Renderer does not import the helper

- **WHEN** the shelf renderer module is compiled
- **THEN** it SHALL have no import of the title-derivation helper
- **AND** the rendered output SHALL NOT contain any string derived through the helper
