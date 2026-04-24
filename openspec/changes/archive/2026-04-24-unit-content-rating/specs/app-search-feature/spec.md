## MODIFIED Requirements

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

## ADDED Requirements

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
