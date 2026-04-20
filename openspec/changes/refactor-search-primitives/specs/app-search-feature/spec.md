## ADDED Requirements

### Requirement: Search feature exports controlled primitive components

The search feature SHALL export a set of pure, controlled primitive components from `package/app/src/search/components/`. Each primitive SHALL be stateless and accept `value` and `onChange` props (or the semantically equivalent `{value, onPatch}` pair for primitives that may emit multi-field patches). Primitives SHALL NOT own search state; they SHALL NOT call any search-feature hook; they SHALL NOT assume the presence of a parent composer.

The exported primitives SHALL include at minimum:

- `KeywordInput` — text input for the main keyword, with opt-in middleware.
- `TagPicker` — chip-style tag filter input with slug-comma parsing and server-backed autocomplete.
- `ContentTypeCheckboxes` — multi-select for `ContentSearchOptions.type`.
- `PostKindCheckboxes` — multi-select for post kind.
- `SortSelect` — single-select for sort order.
- `NsfwToggle` — boolean toggle for NSFW inclusion.
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

- `book-library/components/BookSearch/BookSearch.tsx` — keyword, tags, word-count range, NSFW, licensed, tag-group suggestions.
- `review/components/ReviewSearch/ReviewSearch.tsx` — keyword, tags, and review-specific dimensions.

#### Scenario: BookSearch assembles primitives

- **WHEN** `BookSearch.tsx` is inspected
- **THEN** it SHALL render `KeywordInput`, `TagPicker`, `WordCountRangeInput`, `NsfwToggle`, `LicensedToggle`, and `TagGroupSuggestions` as children
- **AND** it SHALL NOT render or import `SearchInput`, `SearchInputView`, `SearchPanel`, or any other monolithic search wrapper

#### Scenario: Basic composer lives in its domain

- **WHEN** a search-capable domain is added
- **THEN** its basic composer SHALL live under that domain's feature folder
- **AND** SHALL NOT be placed under `package/app/src/search/components/`

### Requirement: Single shared advanced composer with all global dimensions

The search feature SHALL export a single `AdvancedSearch` composer from `package/app/src/search/components/AdvancedSearch.tsx`. This composer SHALL render primitives for every dimension present in `SearchQuery`, including at minimum: keyword, tags, content type, post kind, sort order, NSFW, licensed, word-count range, and languages. When new dimensions are added to `SearchQuery`, `AdvancedSearch` SHALL be updated to render a corresponding primitive.

#### Scenario: AdvancedSearch renders all dimensions

- **WHEN** `AdvancedSearch` renders with `initial: {}` and `implicitInitial: {}`
- **THEN** it SHALL render a `KeywordInput`, a `TagPicker`, a `ContentTypeCheckboxes`, a `PostKindCheckboxes`, a `SortSelect`, an `NsfwToggle`, a `LicensedToggle`, and a `WordCountRangeInput`

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

### Requirement: TagPicker provides real chip-based tag input

`TagPicker` SHALL render the current tag list as removable MUI chips and accept new tags via:

1. Typing a token and pressing Enter or comma → chip `{ slug: token }` appended.
2. Pasting a comma-separated string → each comma-separated token added as its own chip.
3. Selecting a server-provided autocomplete suggestion → chip `{ slug, unitId?, name? }` appended, preserving richer fields when available.

`TagPicker` SHALL NOT render tag slugs as comma-separated text inside a plain `<TextField>`.

#### Scenario: Chip added on Enter

- **GIVEN** `TagPicker` with `value = []`
- **WHEN** the user types "isekai" and presses Enter
- **THEN** `onChange` SHALL be invoked with `[{ slug: "isekai" }]`
- **AND** a chip labeled "isekai" SHALL appear

#### Scenario: Paste splits on comma

- **GIVEN** `TagPicker` with `value = []`
- **WHEN** the user pastes `isekai, fantasy, romance,` into the input
- **THEN** `onChange` SHALL be invoked with `[{ slug: "isekai" }, { slug: "fantasy" }, { slug: "romance" }]`

#### Scenario: Server suggestion preserves richer fields

- **GIVEN** the tag suggest endpoint returns `{ slug: "isekai", unitId: "t-1", name: "異世界" }`
- **WHEN** the user selects that suggestion from the autocomplete dropdown
- **THEN** `onChange` SHALL be invoked with a chip that includes the `unitId` and `name` fields

## REMOVED Requirements

### Requirement: Basic search component

**Reason**: The generic `BasicSearch` component is replaced by per-domain basic composers (`BookSearch`, `ReviewSearch`, etc.) that assemble primitives directly. A single `BasicSearch` cannot express the per-domain variation in filter sets.

**Migration**: Replace imports of `BasicSearch` from `@/search` with the relevant domain composer (e.g., `import { BookSearch } from '@/book-library'`). Each domain composer exposes the same mental model (keyword + submit + residual chips via `AppliedFilterChips`) but with its own primitive set.

### Requirement: Advanced search component

**Reason**: The previous `AdvancedSearch` implementation duplicated keyword / tags / type / sort / NSFW / licensed as its own tree. It is replaced by a primitive-composing `AdvancedSearch` that shares the same `useSearchQuery` state home and the same primitive library as basic composers. The name is preserved; the implementation is rewritten.

**Migration**: Callsites continue to import `AdvancedSearch` from `@/search`; the prop surface changes from `{ preAppliedFilters, onSearch, onToggleBasic, initialQuery }` to being driven by page-level `useSearchQuery`. See the `app-search-feature` ADDED requirements for the new contract.

### Requirement: Search components share a common core

**Reason**: Subsumed by the new `useSearchQuery`-based contract. The new requirement is stricter: both basic and advanced composers share not just a "core" but the exact same `useSearchQuery` instance hosted at the page layer, so mode switching is state-preserving by construction.

**Migration**: No user-visible change. The replacement requirement ("`useSearchQuery` is the single search-session state hook") covers state continuity in a more precise form.

### Requirement: Search syntax integration in search input

**Reason**: The "search input" as a single component no longer exists. Syntax parsing moves into an opt-in `KeywordInput.middleware` prop with submit-time semantics (see ADDED requirement "KeywordInput middleware for typed query string").

**Migration**: Composers that want typed query string support pass `middleware={parseSearchString}` to `KeywordInput`. The parser and serializer functions themselves are unchanged and still exported from `@/search`.

## MODIFIED Requirements

### Requirement: Public Search Feature Entry

The app SHALL expose search functionality through a stable public feature entry point (`package/app/src/search/index.ts`) with explicit named exports only. The entry SHALL export primitive components, `useSearchQuery`, the shared `AdvancedSearch` composer, the `SearchQuery` parser/serializer utilities, and `toContentSearchOptions`. It SHALL NOT export `SearchInput`, `SearchInputView`, `SearchPanel`, `SearchPanelView`, generic `BasicSearch`, or any `SearchInfo` type (which has been removed).

#### Scenario: Consumer imports primitives from search feature entry

- **GIVEN** a domain composer integrating search
- **WHEN** it imports search building blocks
- **THEN** it SHALL import `KeywordInput`, `TagPicker`, `useSearchQuery`, `AppliedFilterChips`, and `toContentSearchOptions` (as needed) from `@/search`

#### Scenario: Deprecated exports are absent

- **WHEN** `@/search` is enumerated
- **THEN** it SHALL NOT export `SearchInput`, `SearchInputView`, `SearchPanel`, `SearchPanelView`, `BasicSearch`, or any type named `SearchInfo`

### Requirement: Context-aware search routes

Search routes (`/book`, `/book/search`, `/zone/:slug/search`, `/realm/.../search`, `/shelf/.../search`, and `/search`) SHALL host `useSearchQuery` at the page layer and render either a per-domain basic composer or the shared `AdvancedSearch`, passing in mode-appropriate `initial` and `implicitInitial`. The URL SHALL maintain the context path — searches within a zone stay at `/zone/:slug/search`, not redirected to `/search`.

#### Scenario: Zone search hosts useSearchQuery at page layer

- **GIVEN** the route `/zone/light-novel/search`
- **WHEN** the page mounts
- **THEN** the page SHALL call `useSearchQuery({ implicitInitial: zone.filters, initial: fromUrl })`
- **AND** SHALL render either the shared `AdvancedSearch` or a zone-appropriate basic composer, both driven by the same hook instance

#### Scenario: Book search page hosts useSearchQuery at page layer

- **GIVEN** the route `/book/search`
- **WHEN** the page mounts
- **THEN** the page SHALL call `useSearchQuery({ implicitInitial: { type: ["BOOK"] }, initial: parseBookSearchParams(location.search) })`
- **AND** SHALL render `BookSearch` in basic mode (default) or `AdvancedSearch` when the user toggles

#### Scenario: Mode toggle does not rewrite URL

- **GIVEN** any search page with `useSearchQuery` mounted
- **WHEN** the user toggles between basic and advanced
- **THEN** the URL SHALL NOT change
- **AND** only submit actions SHALL serialize `toOptions()` into the URL
