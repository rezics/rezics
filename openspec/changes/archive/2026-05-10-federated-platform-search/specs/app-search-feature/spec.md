## MODIFIED Requirements

### Requirement: Global search route

The app SHALL register a `/search` route that renders the **federated search page** with `scope = { kind: "global" }` and `category` taken from the URL (default `"all"`). The page SHALL render `SearchCategoryNav` (the category strip) above the result region; the result region renders `FederatedResultList` for the active category. The advanced filter composer (`AdvancedSearch`) SHALL be available on the page and SHALL apply to whichever sub-query the active category dispatches.

#### Scenario: Navigate to global federated search

- **WHEN** a user navigates to `/search`
- **THEN** the page SHALL mount with `scope = { kind: "global" }` and `category = "all"`
- **AND** the result region SHALL render the grouped variant of `FederatedResultList`
- **AND** `SearchCategoryNav` SHALL render with all category labels and per-category counts once results return

#### Scenario: URL category is honored

- **WHEN** a user navigates to `/search?q=magic&category=reviews`
- **THEN** the page SHALL mount with `category = "reviews"`
- **AND** the result region SHALL render the single-variant of `FederatedResultList`
- **AND** the keyword "magic" SHALL be in the keyword input

### Requirement: Context-aware search routes

The following search routes SHALL exist and host `useSearchQuery` at the page layer with the indicated scope:

| Route | Scope passed to `useSearchQuery.initial` |
|---|---|
| `/search` | `{ kind: "global" }` |
| `/book/:bookId/search` | `{ kind: "book", unitId: bookId }` |
| `/realm/:realmId/search` | `{ kind: "realm", realmId }` |
| `/user/:userId/search` | `{ kind: "user", userId }` |
| `/u/:userSlug/search` | `{ kind: "user", userId: <resolved from slug> }` |

These five routes SHALL share a single page implementation parameterized by `scope` and SHALL render `SearchCategoryNav` + `FederatedResultList` with category-aware sub-queries via `useFederatedSearch`.

The pre-existing routes `/book/search` (book directory / library page) and `/realm/search` (realm directory) SHALL remain in place with their existing `BookLibPage` / `RealmSearchPage` implementations. They are dedicated `books` / `realms` category landing pages and SHALL NOT be redirected to the federated path. The federated `/search?category=books` and `/search?category=realms` SHALL coexist as alternative entry points.

The legacy `/zone/:slug/search`, `/review/search`, `/shelf/search` routes SHALL keep their existing implementations until separately migrated; they are out of scope for this change.

#### Scenario: Realm scoped search page mounts

- **GIVEN** the route `/realm/r-1/search`
- **WHEN** the page mounts
- **THEN** `useSearchQuery` SHALL be initialized with `scope = { kind: "realm", realmId: "r-1" }`
- **AND** `useFederatedSearch` SHALL fire with that scope
- **AND** `SearchCategoryNav` SHALL only show categories the scope permits (per `federated-search` strict-membership mapping)

#### Scenario: Book scoped search page mounts with shelves and post sections only

- **GIVEN** the route `/book/b-9/search`
- **WHEN** the page mounts and the federated query returns
- **THEN** the available categories in `SearchCategoryNav` SHALL be `all`, `mixed`, `reviews`, `excerpts`, `remarks`, `posts`, `shelves`
- **AND** `books`, `realms`, `users` categories SHALL NOT be shown (the scope omits those indexes)

#### Scenario: User-by-slug page resolves before query

- **GIVEN** the route `/u/alice/search`
- **WHEN** the page mounts
- **THEN** the page SHALL resolve the slug `alice` to a user id via the existing user-by-slug query
- **AND** SHALL pass `scope = { kind: "user", userId: <resolvedId> }` to `useSearchQuery`
- **AND** SHALL show a Spinner placeholder until resolution completes

#### Scenario: Mode toggle does not rewrite URL

- **GIVEN** any federated search page with `useSearchQuery` mounted
- **WHEN** the user toggles between basic and advanced
- **THEN** the URL SHALL NOT change

### Requirement: Public Search Feature Entry

The app SHALL expose search functionality through a stable public feature entry point (`package/app/src/search/index.ts`) with explicit named exports only. The entry SHALL export primitive components, `useSearchQuery`, the shared `AdvancedSearch` composer, the `SearchQuery` parser/serializer utilities, `toContentSearchOptions`, the **`FederatedResultList` component**, the **`SearchCategoryNav` component**, the **`resolveScope` function**, and the **`buildSearchPath` helper**. It SHALL NOT export `SearchInput`, `SearchInputView`, `SearchPanel`, `SearchPanelView`, generic `BasicSearch`, or any `SearchInfo` type (which has been removed).

#### Scenario: Consumer imports federated primitives from search feature entry

- **GIVEN** a domain composer integrating federated search
- **WHEN** it imports search building blocks
- **THEN** it SHALL import `FederatedResultList`, `SearchCategoryNav`, `resolveScope`, `buildSearchPath`, `useSearchQuery`, and `KeywordInput` from `@/search`

#### Scenario: Deprecated exports remain absent

- **WHEN** `@/search` is enumerated
- **THEN** it SHALL NOT export `SearchInput`, `SearchInputView`, `SearchPanel`, `SearchPanelView`, `BasicSearch`, or any type named `SearchInfo`

## ADDED Requirements

### Requirement: FederatedResultList component

The search feature SHALL export a `FederatedResultList` component that accepts `{ result: FederatedSearchResult, isLoading: boolean, scope: SearchScope, onCategoryChange: (c: SearchCategory) => void }`. The component SHALL render one of three layouts based on `result.kind`:

- `"grouped"` — section-per-category layout. Each section displays the category title, the per-section `totalHits` count, the capped `items` (rendered with the category-appropriate card), and a "查看更多" link that calls `onCategoryChange` for that category. Sections with `totalHits = 0` SHALL be hidden.
- `"ranked"` — single flat list of mixed-origin hits. Each hit SHALL be rendered with the card appropriate to its `_origin.indexUid`, and SHALL carry a small origin badge (e.g., chip showing "Book", "Review", "Realm") so the user can distinguish item types.
- `"single"` — single-category list with full pagination controls.

The component SHALL be pure (controlled): it accepts result data and emits category-change callbacks; it SHALL NOT call any data-fetching hook itself.

#### Scenario: Grouped layout shows section per category with counts

- **GIVEN** a `result` with `kind: "grouped"` containing `sections.books = { totalHits: 42, items: [5 items] }` and `sections.reviews = { totalHits: 0, items: [] }`
- **WHEN** the component renders
- **THEN** a section labeled "Books" SHALL appear with the count "42"
- **AND** the "Reviews" section SHALL NOT appear

#### Scenario: "see more" calls onCategoryChange

- **GIVEN** a grouped layout with a non-empty Books section
- **WHEN** the user clicks the section's "see more" link
- **THEN** `onCategoryChange("books")` SHALL be invoked
- **AND** the component itself SHALL NOT navigate or rewrite history

#### Scenario: Ranked layout tags each hit with its origin

- **GIVEN** a `result` with `kind: "ranked"` containing one content hit and one post hit
- **WHEN** the component renders
- **THEN** the content hit SHALL display an "Book" / "Shelf" origin badge per its `type`
- **AND** the post hit SHALL display a "Review" / "Excerpt" / "Remark" / "Post" origin badge per its `kind`

### Requirement: SearchCategoryNav component

The search feature SHALL export a `SearchCategoryNav` component that accepts `{ scope: SearchScope, value: SearchCategory, counts: Partial<Record<SearchCategory, number>>, onChange: (c: SearchCategory) => void }`. The component SHALL render a horizontal nav strip showing only the categories the scope permits (per `federated-search` strict-membership mapping). Each category SHALL display its label and, when `counts[category]` is defined, the count.

#### Scenario: Realm scope omits the realms and users categories

- **GIVEN** `scope = { kind: "realm", realmId: "r-1" }`
- **WHEN** `SearchCategoryNav` renders
- **THEN** the nav SHALL include `all`, `mixed`, `books`, `reviews`, `excerpts`, `remarks`, `posts`, `shelves`
- **AND** SHALL NOT include `realms` or `users`

#### Scenario: Counts render when provided

- **GIVEN** `counts = { books: 42, reviews: 18 }`
- **WHEN** the nav renders
- **THEN** the Books label SHALL show "42" alongside it
- **AND** the Reviews label SHALL show "18"
- **AND** any category without a count SHALL render the bare label

### Requirement: HeaderSearch submit is scope-aware

The `HeaderSearch` component SHALL resolve the current scope from `pathname` (already done for badge rendering) and SHALL submit the form to the matching scoped search URL using `buildSearchPath({ scope, keyword })`. The legacy behavior of always navigating to `/search` (or `/book/search` when path begins with `/book`) SHALL be removed.

For the `userSlug` intermediate scope, `HeaderSearch` SHALL navigate to `/u/:userSlug/search` directly without slug→id resolution at the header layer; the destination page resolves the slug.

#### Scenario: Submit on a realm page goes to scoped URL

- **GIVEN** the user is on `/realm/r-1/forum`
- **WHEN** the user types "magic" into the header search and submits
- **THEN** the navigation target SHALL be `/realm/r-1/search?q=magic`

#### Scenario: Submit on a user page goes to scoped URL

- **GIVEN** the user is on `/user/u-3/content`
- **WHEN** the user submits "epic"
- **THEN** the navigation target SHALL be `/user/u-3/search?q=epic`

#### Scenario: Submit on a slug user page goes to slug URL

- **GIVEN** the user is on `/u/alice/realms`
- **WHEN** the user submits "epic"
- **THEN** the navigation target SHALL be `/u/alice/search?q=epic`
- **AND** the slug SHALL NOT be pre-resolved at the header layer

#### Scenario: Submit on a book page goes to scoped URL

- **GIVEN** the user is on `/book/b-9/info`
- **WHEN** the user submits "deep"
- **THEN** the navigation target SHALL be `/book/b-9/search?q=deep`

#### Scenario: Submit elsewhere goes to global

- **GIVEN** the user is on `/feedback/admin`
- **WHEN** the user submits "test"
- **THEN** the navigation target SHALL be `/search?q=test`
