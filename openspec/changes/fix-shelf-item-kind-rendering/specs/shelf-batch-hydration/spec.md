## ADDED Requirements

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
