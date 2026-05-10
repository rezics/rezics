## ADDED Requirements

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
