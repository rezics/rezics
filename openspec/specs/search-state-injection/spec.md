## ADDED Requirements

### Requirement: Search page accepts pre-resolved tag data via router state

The search page SHALL check for `injectedTags` in TanStack Router's navigation state on mount. If `injectedTags` is present and is an array of `{ slug: string, unitId: string, name: string }` objects, the search page SHALL feed those objects into `useSearchQuery({ initial: { tags: injectedTags } })` — without issuing any API call to resolve tag slugs. Rendering those tags in the UI is the responsibility of whichever composer / primitive consumes `initial.tags` (typically `TagPicker` in advanced mode, `AppliedFilterChips` in basic mode).

The search page SHALL NOT maintain a separate `<SelectedTagChips>` rendering path — `initial.tags` flows through the unified injection model exactly like any other filter value.

#### Scenario: Navigation with injected tags seeds useSearchQuery

- **GIVEN** a user navigates to `/search?q=[isekai][adventure]` with router state `{ injectedTags: [{ slug: "isekai", unitId: "tag-1", name: "異世界" }, { slug: "adventure", unitId: "tag-2", name: "冒險" }] }`
- **WHEN** the search page mounts
- **THEN** the page SHALL pass those tag objects to `useSearchQuery` as `initial.tags`
- **AND** no tag resolution API call SHALL be made
- **AND** the composer rendered by the page SHALL display the two tags — either as chips in `AppliedFilterChips` (basic mode) or as `TagPicker` chips (advanced mode)

### Requirement: Search page falls back to slug resolution when no injection is present

When `injectedTags` is absent from router state (e.g., direct URL navigation, shared link, browser refresh), the search page SHALL parse `[slug]` tokens from the URL `q` parameter and resolve them to full tag objects via the existing API. This is the fallback path — functionally identical to the injected path, but with an additional API round trip.

#### Scenario: Direct URL navigation without injection

- **GIVEN** a user navigates directly to `/search?q=[isekai][adventure]` (no router state)
- **WHEN** the search page mounts
- **THEN** the search page SHALL parse slugs `["isekai", "adventure"]` from the URL
- **AND** the search page SHALL issue API calls to resolve these slugs to tag objects
- **AND** tag filter chips SHALL render once resolution completes

#### Scenario: Browser refresh clears injection

- **GIVEN** the user originally navigated with injected tags
- **WHEN** the user refreshes the browser
- **THEN** router state SHALL be empty
- **AND** the search page SHALL fall back to slug-based resolution

### Requirement: Injected and resolved tag data produce identical search behavior

Regardless of whether tags were injected or resolved, the search results, filter chips, and URL state SHALL be identical. The injection mechanism is a performance optimization only — it SHALL NOT change the functional behavior of the search page.

#### Scenario: Same results from both paths

- **GIVEN** tag "isekai" has slug "isekai" and unitId "tag-1"
- **WHEN** path A uses injected `{ slug: "isekai", unitId: "tag-1", name: "異世界" }` and path B resolves "isekai" from URL to the same unitId
- **THEN** both paths SHALL produce identical search API calls and identical results

### Requirement: Zone filters are injected as implicitInitial

Pre-applied zone filters (e.g., `zone.filters.type`, `zone.filters.tags`) SHALL be passed to `useSearchQuery` as `implicitInitial`, not `initial`. This causes them to be hidden from basic mode composers while remaining part of the effective search query and visible / editable in advanced mode.

#### Scenario: Zone filter hidden in basic mode

- **GIVEN** a zone with `filters = { type: ["BOOK"], tags: [{ slug: "light-novel" }] }`
- **WHEN** the user navigates to `/zone/light-novel/search` and the page renders in basic mode
- **THEN** the search request SHALL include `type: ["BOOK"]` and `tags: [{ slug: "light-novel" }]`
- **AND** neither SHALL appear as a chip in `AppliedFilterChips`
- **AND** neither SHALL appear as a primitive value in the rendered composer

#### Scenario: Zone filter visible and editable in advanced mode

- **GIVEN** the same zone as above
- **WHEN** the user switches to advanced mode
- **THEN** `ContentTypeCheckboxes` SHALL show BOOK as checked
- **AND** `TagPicker` SHALL display a chip for `light-novel`
- **AND** both SHALL be editable; unchecking / removing them SHALL narrow the implicit layer of the query

### Requirement: useSearchQuery accepts scope and category in initial

The `useSearchQuery` hook SHALL accept `initial.scope: SearchScope` and `initial.category: SearchCategory` alongside the existing `initial.tags`, `initial.keyword`, and other `SearchQuery` fields. Both new fields SHALL flow through the same merge rules as the rest of `initial`:

- `scope` is treated as identity-bearing route data, not as a user-mutable filter; `bind("scope")` SHALL NOT be exposed.
- `category` IS user-mutable via `patch({ category })`; calling `patch` with a new category SHALL produce a fresh query identity that downstream `useFederatedSearch` consumers re-key on.

When `initial.category` is omitted, the hook SHALL default to `"all"`. When `initial.scope` is omitted, the hook SHALL default to `{ kind: "global" }`.

#### Scenario: Scoped page seeds scope via initial

- **GIVEN** the `/realm/r-1/search` page mounts
- **WHEN** the page calls `useSearchQuery({ initial: { scope: { kind: "realm", realmId: "r-1" }, category: "all" }, … })`
- **THEN** `query.scope` SHALL equal `{ kind: "realm", realmId: "r-1" }`
- **AND** `query.category` SHALL equal `"all"`

#### Scenario: Category change invalidates downstream cache key

- **GIVEN** a federated search page with `category: "all"`
- **WHEN** the user invokes `patch({ category: "reviews" })`
- **THEN** `query.category` SHALL update to `"reviews"`
- **AND** any `useFederatedSearch` hook keyed on the resulting options SHALL fire a fresh query

#### Scenario: Scope is read-only via bind

- **WHEN** a composer calls `bind("scope")`
- **THEN** the call SHALL produce a TypeScript error or runtime warning
- **AND** `scope` SHALL only be settable through `initial`, not through user input

### Requirement: Category is reflected in URL via search params

When the federated search page is rendered, `useSearchQuery`'s URL serialization (via `toSearchParams` / equivalent) SHALL include a `category=<value>` query parameter for any non-default category. The default category (`"all"`) SHALL be omitted from the URL so that `/search?q=foo` is the canonical form.

#### Scenario: Non-default category appears in URL

- **GIVEN** the federated page with `category: "reviews"` and `keyword: "magic"`
- **WHEN** the page serializes to URL via `toSearchParams`
- **THEN** the URL SHALL be `?q=magic&category=reviews`

#### Scenario: All category is omitted from URL

- **GIVEN** the federated page with `category: "all"` and `keyword: "magic"`
- **WHEN** the page serializes
- **THEN** the URL SHALL be `?q=magic` with no `category` parameter

#### Scenario: Browser-back round trip preserves category

- **GIVEN** a user on `/search?q=foo&category=posts`
- **WHEN** the page mounts via direct navigation or browser back
- **THEN** `useSearchQuery` SHALL initialize with `category: "posts"` from the URL
- **AND** the `posts` category sub-tab SHALL be selected on first render
