# app-search-feature Specification

## Purpose

Defines the search feature in `@rezics/app`: result rendering against the `ContentSearchResult` server contract, controlled primitive components, the `useSearchQuery` session hook, the unified injection model for initial values, basic and advanced composers, applied-filter chip surfacing, and the integration with shadcn `Badge` for tag and applied-filter chips.

## Requirements

### Requirement: User-Visible Search Parity

The search feature SHALL consume the new `ContentSearchResult` from the server-mediated search API. Search results SHALL display content from `ContentSearchDocument` fields (`titles`, `creditNames`, `type`, `coverAssetUnitId`). The frontend SHALL resolve display title from the `titles` array based on the user's preferred language, falling back to the first available title.

#### Scenario: Query behavior with new result shape

- **GIVEN** the search API returns `ContentSearchResult` with `items` containing `ContentSearchDocument` objects
- **WHEN** results are rendered
- **THEN** each result SHALL display the title resolved from `titles` array, attribution from `creditNames`, and content type from `type`

#### Scenario: Multilingual title resolution

- **GIVEN** a search result document with `titles: ["Harry Potter...", "哈利·波特..."]` and `languages: ["en", "zh"]`
- **WHEN** the user's preferred language is "zh"
- **THEN** the displayed title SHALL be "哈利·波特..."

### Requirement: Public Search Feature Entry

The app SHALL expose search functionality through a stable public feature entry point (`package/app/src/search/index.ts`) with explicit named exports only. The entry SHALL export primitive components, `useSearchQuery`, the shared `AdvancedSearch` composer, the `SearchQuery` parser/serializer utilities, `toContentSearchOptions`, the **`FederatedResultList` component**, the **`SearchCategoryNav` component**, the **`resolveScope` function**, and the **`buildSearchPath` helper**. It SHALL NOT export `SearchInput`, `SearchInputView`, `SearchPanel`, `SearchPanelView`, generic `BasicSearch`, or any `SearchInfo` type (which has been removed).

#### Scenario: Consumer imports federated primitives from search feature entry

- **GIVEN** a domain composer integrating federated search
- **WHEN** it imports search building blocks
- **THEN** it SHALL import `FederatedResultList`, `SearchCategoryNav`, `resolveScope`, `buildSearchPath`, `useSearchQuery`, and `KeywordInput` from `@/search`

#### Scenario: Deprecated exports remain absent

- **WHEN** `@/search` is enumerated
- **THEN** it SHALL NOT export `SearchInput`, `SearchInputView`, `SearchPanel`, `SearchPanelView`, `BasicSearch`, or any type named `SearchInfo`

### Requirement: Search supports realm and tag filtering

The search feature SHALL support filtering by realm and by tags (both global and realm-scoped). Tag filtering SHALL use tag UUIDs, not tag name strings. The frontend SHALL pass tag UUIDs obtained from prior tag lookups or UI state.

#### Scenario: Search within a realm

- **GIVEN** the user is browsing a realm page
- **WHEN** they perform a search
- **THEN** the search request SHALL include `realmId` in the `ContentSearchOptions`
- **AND** results SHALL be scoped to that realm

#### Scenario: Search with tag filter

- **GIVEN** the user selects a tag filter in the search UI
- **WHEN** the search request is sent
- **THEN** it SHALL include the tag's UUID in `tagIds` (global) or `realmTagIds` (realm-scoped)

### Requirement: Search supports content type filtering

The search feature SHALL allow filtering by content type (BOOK, GAME, MEDIA, SHELF) via the `type` field in `ContentSearchOptions`.

#### Scenario: Filter search to books only

- **GIVEN** the user selects "Books" type filter
- **WHEN** the search is executed
- **THEN** the request SHALL include `type: "BOOK"` in search options
- **AND** only book results SHALL be displayed

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

### Requirement: Search supports realm and tag filtering

The search feature SHALL support filtering by realm and by tags (both global and realm-scoped). Tag filtering SHALL use `SlugRef` objects (`{ slug, unitId? }`) — the frontend SHALL send tag slugs (and unitIds when available from local cache or UI state). The search input SHALL accept tag slugs via `[slug]` syntax tokens.

#### Scenario: Search within a realm

- **GIVEN** the user is browsing a realm page
- **WHEN** they perform a search
- **THEN** the search request SHALL include `realmId` in the `ContentSearchOptions`
- **AND** results SHALL be scoped to that realm

#### Scenario: Search with tag filter via SlugRef

- **GIVEN** the user selects a tag filter in the search UI
- **WHEN** the search request is sent
- **THEN** it SHALL include the tag as a `SlugRef` in the `tags` array
- **AND** SHALL include `unitId` if available from local state

#### Scenario: Search with tag filter via syntax

- **GIVEN** the user types `[light-novel]` in the search input
- **WHEN** the search request is sent
- **THEN** it SHALL include `{ slug: "light-novel" }` in the `tags` array

### Requirement: Search supports content type filtering

The search feature SHALL allow filtering by content type (BOOK, GAME, MEDIA, SHELF, POST) via the `type` field in `ContentSearchOptions`. Content type filters MAY be set via the advanced search panel or via `type:value` search syntax.

#### Scenario: Filter search to books only

- **GIVEN** the user selects "Books" type filter
- **WHEN** the search is executed
- **THEN** the request SHALL include `type: "BOOK"` in search options
- **AND** only book results SHALL be displayed

#### Scenario: Filter via search syntax

- **GIVEN** the user types `type:book` in the search input
- **WHEN** the search is executed
- **THEN** the request SHALL include `type: ["book"]` in search options

### Requirement: Search supports realm and tag filtering

The search feature SHALL support filtering by realm and by tags (both global and realm-scoped). Tag filtering SHALL use tag UUIDs, not tag name strings. The frontend SHALL pass tag UUIDs obtained from prior tag lookups, UI state, or **injected router state**. When `injectedTags` is present in router navigation state, the search page SHALL use the provided `unitId` values directly. When absent, the search page SHALL resolve tag slugs (parsed from the `[slug]` URL syntax) to `unitId` values via the tag API before issuing the search request.

#### Scenario: Search within a realm

- **GIVEN** the user is browsing a realm page
- **WHEN** they perform a search
- **THEN** the search request SHALL include `realmId` in the `ContentSearchOptions`
- **AND** results SHALL be scoped to that realm

#### Scenario: Search with tag filter from injected state

- **GIVEN** the user navigated from a book's tag interaction with `injectedTags: [{ slug: "isekai", unitId: "tag-1", name: "異世界" }]`
- **WHEN** the search page renders
- **THEN** a tag chip labeled "異世界" SHALL appear immediately
- **AND** the search request SHALL include `unitId: "tag-1"` in tag filters without a resolution round trip

#### Scenario: Search with tag filter from URL (no injection)

- **GIVEN** the user navigates directly to `/search?q=[isekai]` with no router state
- **WHEN** the search page renders
- **THEN** the search page SHALL resolve slug "isekai" to its `unitId` via API
- **AND** once resolved, the tag chip SHALL display the translated name and the search SHALL execute with the resolved `unitId`

### Requirement: Search feature exports controlled primitive components

The search feature SHALL export a set of pure, controlled primitive components from `package/app/src/search/components/`. Each primitive SHALL be stateless and accept `value` and `onChange` props (or the semantically equivalent `{value, onPatch}` pair for primitives that may emit multi-field patches). Primitives SHALL NOT own search state; they SHALL NOT call any search-feature hook; they SHALL NOT assume the presence of a parent composer.

The exported primitives SHALL include at minimum:

- `KeywordInput` — text input for the main keyword, with opt-in middleware.
- `TagPicker` — chip-style tag filter input with slug-comma parsing and server-backed autocomplete.
- `ContentTypeCheckboxes` — multi-select for `ContentSearchOptions.type`.
- `PostKindCheckboxes` — multi-select for post kind.
- `SortSelect` — single-select for sort order.
- `RatingFilterChips` — four-checkbox selector for `ContentSearchOptions.ratings` (one checkbox per `ContentRating` member). Replaces the previous `NsfwToggle`.
- `LicensedToggle` — boolean toggle for licensed filter.
- `WordCountRangeInput` — numeric range input for text length.
- `TagGroupSuggestions` — preset tag chip group that adds chips on click.
- `AppliedFilterChips` — residual-display chip row for filter values not surfaced by a rendered primitive.

#### Scenario: Primitive is controlled

- **GIVEN** a `KeywordInput` rendered with `value="foo"` and `onChange={handler}`
- **WHEN** the user types "bar" at the end of the input
- **THEN** the handler SHALL be invoked with the updated keyword string
- **AND** the primitive SHALL NOT update its own internal state independently of the prop

#### Scenario: Primitive does not own state

- **GIVEN** any search feature primitive
- **WHEN** the component's source is inspected
- **THEN** it SHALL NOT import `useSearchQuery` or any search-feature state hook
- **AND** it SHALL NOT use `useState` / `useReducer` to hold the value prop

#### Scenario: RatingFilterChips renders four checkboxes

- **WHEN** `RatingFilterChips` renders
- **THEN** it SHALL render exactly four labeled checkboxes, one per `ContentRating` member (`GENERAL`, `R_15`, `R_18`, `R_18G`)
- **AND** the `value` prop SHALL be an array of `ContentRating` values
- **AND** ticking a checkbox SHALL invoke `onChange` with the union of the previous value and the ticked tier
- **AND** unticking SHALL invoke `onChange` with the previous value minus the unticked tier

#### Scenario: NsfwToggle is removed from exports

- **WHEN** the search feature's public surface is enumerated
- **THEN** it SHALL NOT export any primitive named `NsfwToggle`

### Requirement: `useSearchQuery` is the single search-session state hook

The search feature SHALL export a `useSearchQuery` hook from `package/app/src/search/hooks/useSearchQuery.ts`. It SHALL accept an options object with `initial?: Partial<SearchQuery>`, `implicitInitial?: Partial<SearchQuery>`, and `middleware?: QueryMiddleware`. It SHALL return `{ query, implicit, patch, bind, toOptions }` where:

- `query: SearchQuery` is the merged search state (`implicitInitial` + `initial` + user patches).
- `implicit: Partial<SearchQuery>` is the read-only projection of `implicitInitial` into the current `query`.
- `patch(p: Partial<SearchQuery>): void` merges a partial update into the query using the append-merge rules.
- `bind<K>(field: K): { value, onChange }` produces a controlled-prop pair for a single field.
- `toOptions(): ContentSearchOptions` maps `query` into the API-facing search options shape.

The hook SHALL live at the **page layer** of any search-capable route, so that mode switching (basic ↔ advanced) within the page preserves query state.

#### Scenario: Hook composes initial values

- **GIVEN** `useSearchQuery({ initial: { keyword: "foo" }, implicitInitial: { type: ["BOOK"] } })`
- **WHEN** the hook initializes
- **THEN** `query` SHALL equal `{ keyword: "foo", type: ["BOOK"] }`
- **AND** `implicit` SHALL equal `{ type: ["BOOK"] }`

#### Scenario: `bind` produces a controlled pair

- **GIVEN** a composer that calls `const { bind } = useSearchQuery(...)`
- **WHEN** the composer renders `<KeywordInput {...bind('keyword')} />`
- **THEN** `KeywordInput` SHALL receive the current keyword as `value`
- **AND** typing SHALL invoke `patch({ keyword: next })` via the returned `onChange`

#### Scenario: Mode switch preserves state

- **GIVEN** a page that renders either `BookSearch` (basic) or `AdvancedSearch` from the same `useSearchQuery` instance
- **WHEN** the user fills in a keyword and tag, then toggles to advanced mode
- **THEN** the keyword and tag SHALL appear in the advanced panel without reloading from URL or remount of the hook

### Requirement: Single canonical query shape

The search feature SHALL use `SearchQuery` from `@rezics/contract` as its only query shape. All composers and primitives SHALL operate on `SearchQuery` or its `Partial<SearchQuery>`. The feature SHALL expose exactly one mapper, `toContentSearchOptions(query: SearchQuery): ContentSearchOptions`, as the boundary to the search API.

#### Scenario: No parallel query shape exists

- **WHEN** the search feature's public surface is enumerated
- **THEN** it SHALL NOT export any type named `SearchInfo`
- **AND** any historic `SearchInfo` usage in `package/app/src/**` SHALL have been migrated to `SearchQuery`

### Requirement: Unified injection model with implicit / explicit initial values

The search feature SHALL represent all externally-provided filter values as either `initial` (visible in both basic and advanced modes) or `implicitInitial` (hidden in basic mode, visible and editable in advanced mode). "Pre-applied" zone filters SHALL be passed as `implicitInitial`. Router-injected tag state (`injectedTags`) and URL search params SHALL be passed as `initial`.

The search feature SHALL NOT maintain a separate "pre-applied filters" concept or a separate "injected tags" concept with distinct display rules — display is a pure function of `(query - implicit - rendered)`.

#### Scenario: Zone filters are hidden in basic mode

- **GIVEN** a zone page with `implicitInitial: { type: ["BOOK"], tags: [{ slug: "light-novel" }] }`
- **WHEN** the page renders in basic mode with its domain composer
- **THEN** the BOOK type and `light-novel` tag SHALL be applied to the search result
- **AND** neither SHALL appear as a chip or primitive value in the basic UI

#### Scenario: Router-injected tags are visible in basic mode

- **GIVEN** the user navigates to `/book/search` with router state `{ injectedTags: [{ slug: "isekai", unitId: "t1", name: "異世界" }] }` passed to `initial`
- **WHEN** the basic `BookSearch` composer renders
- **THEN** an `AppliedFilterChips` row SHALL display a chip for the injected tag
- **AND** the chip SHALL be removable, invoking `patch({ tags: [] })` (or an equivalent narrowed update)

#### Scenario: All injected values are editable in advanced mode

- **GIVEN** any combination of `initial` and `implicitInitial` values
- **WHEN** the page switches to advanced mode
- **THEN** every value SHALL be represented in the corresponding primitive (e.g., `type` in `ContentTypeCheckboxes`, tags in `TagPicker`)
- **AND** the user SHALL be able to modify any of them

### Requirement: Domain-specific basic composers

Each search-capable domain SHALL own its basic composer in that domain's feature folder. Basic composers SHALL NOT live in `package/app/src/search/components/`. Each basic composer SHALL assemble the primitives relevant to its domain via `useSearchQuery`'s `bind` helper.

The initial set of basic composers SHALL include:

- `book-library/components/BookSearch/BookSearch.tsx` — keyword, tags, word-count range, rating filter, licensed, tag-group suggestions.
- `review/components/ReviewSearch/ReviewSearch.tsx` — keyword, tags, and review-specific dimensions.

#### Scenario: BookSearch assembles primitives

- **WHEN** `BookSearch.tsx` is inspected
- **THEN** it SHALL render `KeywordInput`, `TagPicker`, `WordCountRangeInput`, `RatingFilterChips`, `LicensedToggle`, and `TagGroupSuggestions` as children
- **AND** it SHALL NOT render or import `SearchInput`, `SearchInputView`, `SearchPanel`, `NsfwToggle`, or any other monolithic search wrapper

#### Scenario: Basic composer lives in its domain

- **WHEN** a search-capable domain is added
- **THEN** its basic composer SHALL live under that domain's feature folder
- **AND** SHALL NOT be placed under `package/app/src/search/components/`

### Requirement: Single shared advanced composer with all global dimensions

The search feature SHALL export a single `AdvancedSearch` composer from `package/app/src/search/components/AdvancedSearch.tsx`. This composer SHALL render primitives for every dimension present in `SearchQuery`, including at minimum: keyword, tags, content type, post kind, sort order, rating filter, licensed, word-count range, and languages. When new dimensions are added to `SearchQuery`, `AdvancedSearch` SHALL be updated to render a corresponding primitive.

#### Scenario: AdvancedSearch renders all dimensions

- **WHEN** `AdvancedSearch` renders with `initial: {}` and `implicitInitial: {}`
- **THEN** it SHALL render a `KeywordInput`, a `TagPicker`, a `ContentTypeCheckboxes`, a `PostKindCheckboxes`, a `SortSelect`, a `RatingFilterChips`, a `LicensedToggle`, and a `WordCountRangeInput`
- **AND** it SHALL NOT render an `NsfwToggle`

#### Scenario: AdvancedSearch surfaces implicit values as editable

- **GIVEN** `AdvancedSearch` rendered with `implicitInitial: { type: ["BOOK"] }`
- **WHEN** the panel renders
- **THEN** `ContentTypeCheckboxes` SHALL show BOOK as checked
- **AND** the user MAY uncheck BOOK to broaden the search

### Requirement: `AppliedFilterChips` surfaces residual filter values

The `AppliedFilterChips` primitive SHALL render a chip per filter value in `query` that is **not** covered by `hide` and **not** listed in `rendered`. It SHALL accept:

- `query: SearchQuery` — the current query.
- `hide?: Partial<SearchQuery>` — values to suppress from display (typically `implicit`).
- `rendered?: (keyof SearchQuery)[]` — fields already surfaced by a sibling primitive.
- `onRemove?: (field: keyof SearchQuery, value: unknown) => void` — called when a chip's delete button is activated.

#### Scenario: Basic composer hides implicit and rendered fields

- **GIVEN** `query = { keyword: "foo", type: ["BOOK"], tags: [{ slug: "isekai" }] }`, `implicit = { type: ["BOOK"] }`, `rendered = ['keyword']`
- **WHEN** `<AppliedFilterChips query hide={implicit} rendered={['keyword']} />` renders
- **THEN** it SHALL show exactly one chip for `tag: isekai`
- **AND** SHALL NOT show a chip for BOOK (hidden via `implicit`) or for the keyword (surfaced by `KeywordInput`)

#### Scenario: Advanced composer suppresses all chips

- **GIVEN** `AdvancedSearch` that lists every field in `rendered`
- **WHEN** `AppliedFilterChips` renders inside it
- **THEN** it SHALL render no chips

### Requirement: KeywordInput middleware for typed query string

`KeywordInput` SHALL accept an optional `middleware?: (raw: string) => Partial<SearchQuery> | null` prop and an optional `onPatch?: (patch: Partial<SearchQuery>) => void` prop. When `middleware` is provided, the primitive SHALL invoke it **only on submit** (Enter key or explicit Search button click), not on every keystroke. If the middleware returns a non-null patch, `onPatch` SHALL be called with the patch. Otherwise `onChange` SHALL be called with the raw string.

The submit-time patch SHALL be merged into the current query using append-merge rules: array fields (`tags`, `type`, `postKind`, `languages`) union with dedupe, scalar fields overwrite only if the patch includes them, and the `keyword` field is replaced by the parser's residual keyword text.

#### Scenario: Middleware appends on submit

- **GIVEN** `useSearchQuery({ initial: { tags: [{ slug: "a" }] } })` and a `KeywordInput` with `middleware = parseSearchString`
- **WHEN** the user types `[b] light novel` and presses Enter
- **THEN** `patch` SHALL be invoked such that `query.tags` equals `[{ slug: "a" }, { slug: "b" }]`
- **AND** `query.keyword` SHALL equal `"light novel"`

#### Scenario: Middleware does not fire on keystroke

- **GIVEN** a `KeywordInput` with middleware enabled
- **WHEN** the user types `[b]` character by character without pressing Enter
- **THEN** `patch` SHALL NOT be invoked
- **AND** `onChange` SHALL be invoked with the raw string as it grows

#### Scenario: Middleware dedupes on re-submit

- **GIVEN** a query already containing `{ tags: [{ slug: "a" }] }`
- **WHEN** the user submits `[a] [b]`
- **THEN** the resulting `query.tags` SHALL equal `[{ slug: "a" }, { slug: "b" }]` — not `[{ slug: "a" }, { slug: "a" }, { slug: "b" }]`

### Requirement: Default rating filter derives from caller allowed set

When any search page (global `/search`, domain pages like `/book/search`, zone pages, etc.) initializes its `useSearchQuery` instance, the hook's `implicitInitial.ratings` SHALL default to the caller's derived allowed rating set (see the `content-rating` capability). The user MAY narrow the filter further via the rating primitive; narrowing SHALL be represented in `query.ratings` as a strict subset of the allowed set.

The search request's `ratings` field SHALL always be a subset of the caller's allowed set. The `toContentSearchOptions` mapper SHALL enforce this by intersecting `query.ratings` with the allowed set before emitting the request.

#### Scenario: Unauthenticated caller sees baseline filter

- **GIVEN** an unauthenticated user on `/search`
- **WHEN** the page mounts
- **THEN** the `RatingFilterChips` SHALL show `GENERAL` and `R_15` as checked
- **AND** `R_18` and `R_18G` checkboxes SHALL be rendered as disabled with an adjacent hint prompting sign-in

#### Scenario: Authenticated caller with opt-ins sees expanded default

- **GIVEN** an authenticated user with `optedInRatings = ["R_18"]` on `/search`
- **WHEN** the page mounts
- **THEN** the `RatingFilterChips` SHALL show `GENERAL`, `R_15`, `R_18` as checked
- **AND** `R_18G` SHALL be rendered as disabled (not opted in)

#### Scenario: User narrows filter

- **GIVEN** an authenticated user with `optedInRatings = ["R_18"]`
- **WHEN** the user unticks `R_18` in the search UI
- **THEN** `query.ratings` SHALL become `["GENERAL", "R_15"]`
- **AND** the emitted `ContentSearchOptions.ratings` SHALL equal `["GENERAL", "R_15"]`

#### Scenario: Query cannot widen beyond allowed set

- **GIVEN** an unauthenticated user
- **WHEN** an external URL includes `ratings=R_18` in the query string
- **THEN** the parsed `query.ratings` SHALL be intersected with `{GENERAL, R_15}` yielding `[]`
- **AND** the UI SHALL fall back to the caller's allowed set for display

### Requirement: NSFW toggle removed from app search

The `NsfwToggle` primitive and all of its references in `package/app/src/**` SHALL be removed. Any URL state that previously encoded `nsfw=true|false` SHALL be ignored on parse; the `ratings` query state is the sole carrier of age-rating filtering.

#### Scenario: Stale URL with nsfw parameter is ignored

- **GIVEN** a bookmarked URL containing `?nsfw=true`
- **WHEN** the search page parses the URL
- **THEN** the `nsfw` parameter SHALL be ignored
- **AND** the page SHALL fall back to the caller's default `ratings` set

### Requirement: TagPicker chips render via shadcn Badge

`TagPicker` SHALL render the current tag list as removable shadcn `Badge` components (from `@rezics/ui/shadcn`) and accept new tags via:

1. Typing a token and pressing Enter or comma → chip `{ slug: token }` appended.
2. Pasting a comma-separated string → each comma-separated token added as its own chip.

Each rendered badge SHALL include an inline remove affordance — a small button containing a `lucide-react` `X` icon — that on activation removes the corresponding tag from the controlled value.

#### Scenario: Chip rendered as Badge

- **WHEN** `TagPicker` is rendered with one or more selected tags
- **THEN** each tag SHALL render as a shadcn `Badge`
- **AND** each badge SHALL include a remove button with a `lucide-react` `X` icon

#### Scenario: Remove tag via badge close button

- **WHEN** the user clicks the `X` icon on a tag badge
- **THEN** the corresponding tag SHALL be removed from the controlled value
- **AND** `onChange` SHALL emit the new tag list

### Requirement: AppliedFilterChips renders via shadcn Badge

`AppliedFilterChips` SHALL render residual-display chips for filter values not surfaced by a primitive component. Each chip SHALL be a shadcn `Badge` (from `@rezics/ui/shadcn`) with a remove affordance using a `lucide-react` `X` icon.

#### Scenario: Applied filter chip renders

- **WHEN** `AppliedFilterChips` is rendered with one or more residual filter values
- **THEN** each value SHALL render as a shadcn `Badge` with a remove affordance using a `lucide-react` `X` icon

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

### Requirement: Search results use canonical card surfaces

Search result lists SHALL render result previews through app-level card
components backed by `@rezics/ui/shadcn` Card surfaces. Result lists SHALL NOT
use local border-row recipes for normal result items.

#### Scenario: Federated grouped results render cards

- **WHEN** the federated search result list renders a grouped response with
  visible section items
- **THEN** each result item SHALL render through `SearchLibraryUnitCard`,
  `SearchContentResultCard`, or an equivalent app card component backed by
  `@rezics/ui/shadcn` Card
- **AND** the result section itself SHALL remain an unframed page section

#### Scenario: Federated ranked results render cards

- **WHEN** the federated search result list renders a ranked response
- **THEN** each ranked hit SHALL render as a card-backed preview surface
- **AND** origin/category metadata SHALL remain visible on the preview

#### Scenario: Legacy content results render cards

- **WHEN** `SearchResultList` renders its default fallback item renderer
- **THEN** each content document SHALL render through the canonical search card
  surface vocabulary
- **AND** title resolution from the document's localized title arrays SHALL
  remain unchanged

### Requirement: Search result cards preserve preview behavior

Search result cards SHALL remain preview surfaces. They SHALL clamp long text,
preserve accessible media alternatives, and avoid document-flow behavior such as
expansion, replies, or reactions.

#### Scenario: Long result text is clamped

- **WHEN** a search result has a long title, summary, body, or metadata string
- **THEN** the rendered card SHALL clamp or truncate the text within the card
  without resizing neighboring result items unexpectedly

#### Scenario: Result media remains accessible

- **WHEN** a search result card renders a cover, thumbnail, avatar, or fallback
  media slot
- **THEN** meaningful media SHALL include an accessible text alternative
- **AND** decorative fallback media SHALL be hidden from assistive technologies

#### Scenario: Search preview excludes flow controls

- **WHEN** a post-like search result is rendered
- **THEN** the result SHALL present preview metadata and content
- **AND** it SHALL NOT render reply composers, reaction controls, or other
  document-flow controls inside the search result card
