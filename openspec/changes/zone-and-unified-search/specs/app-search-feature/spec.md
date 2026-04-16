## ADDED Requirements

### Requirement: Global search route

The app SHALL register a `/search` route that renders the advanced search interface with no pre-applied filters. This is the universal entry point for unrestricted search across all content.

#### Scenario: Navigate to global search

- **WHEN** a user navigates to `/search`
- **THEN** the advanced search panel SHALL render with no pre-applied conditions
- **AND** all filter dimensions SHALL be available for the user to configure

### Requirement: Basic search component

The search feature SHALL export a `BasicSearch` component providing a clean, minimal search input. It SHALL accept pre-applied filters as props (hidden from the user) and a keyword input. On submit, it SHALL navigate to the appropriate search route with the keyword and pre-applied filters encoded in the URL.

#### Scenario: Basic search in zone context

- **GIVEN** a `BasicSearch` component with pre-applied filters `{ type: ["BOOK"] }`
- **WHEN** the user types "異世界" and submits
- **THEN** the search SHALL execute with `{ type: ["BOOK"], keyword: "異世界" }`

#### Scenario: Basic search provides advanced search toggle

- **GIVEN** a `BasicSearch` component
- **WHEN** the user clicks an "advanced search" control
- **THEN** the UI SHALL transition to show the `AdvancedSearch` panel

### Requirement: Advanced search component

The search feature SHALL export an `AdvancedSearch` component providing a full filter panel. It SHALL expose all `ContentSearchOptions` dimensions as interactive controls. Pre-applied filters (from zones or domain routes) SHALL be displayed as removable condition chips, allowing users to understand and optionally modify the active filters.

#### Scenario: Advanced search with pre-applied zone filters

- **GIVEN** an `AdvancedSearch` with pre-applied `{ type: ["BOOK"], tags: [{ slug: "light-novel" }] }`
- **WHEN** the panel renders
- **THEN** "Book" and "light-novel" SHALL appear as applied condition chips
- **AND** the user MAY remove these chips to broaden the search

#### Scenario: Advanced search filter dimensions

- **WHEN** the advanced search panel renders
- **THEN** it SHALL provide controls for: content type, tags (by slug input), language, NSFW, licensed status, and sort order

### Requirement: Search components share a common core

`BasicSearch` and `AdvancedSearch` SHALL be built on the same underlying search core: shared state management, shared query construction, and shared `SearchQuery` → `ContentSearchOptions` conversion. Switching between basic and advanced modes SHALL NOT lose the current search state.

#### Scenario: Switching from basic to advanced preserves state

- **GIVEN** the user has typed "異世界" in basic search with pre-applied type filter
- **WHEN** the user switches to advanced search
- **THEN** the keyword "異世界" and the type filter SHALL be preserved in the advanced panel

### Requirement: Context-aware search routes

Search routes (`/book/search`, `/zone/:slug/search`, etc.) SHALL render the shared search components with their respective pre-applied filters. The URL SHALL maintain the context path — searches within a zone stay at `/zone/:slug/search`, not redirected to `/search`.

#### Scenario: Zone search maintains context URL

- **GIVEN** a user at `/zone/light-novel/search`
- **WHEN** they perform a search
- **THEN** the URL SHALL remain under `/zone/light-novel/search` with query parameters
- **AND** SHALL NOT redirect to `/search`

#### Scenario: Book search uses shared components

- **GIVEN** the `/book/search` route
- **WHEN** it renders
- **THEN** it SHALL use the shared search feature components with `{ type: ["BOOK"] }` pre-applied

### Requirement: Search syntax integration in search input

The search input (used in both basic and advanced modes) SHALL support StackOverflow-style syntax. When the user types structured tokens (e.g., `[tag-slug]`, `type:book`), the input SHALL parse them via `parseSearchString()` and reflect the parsed state in the active filters. The input SHALL also support displaying the serialized form of the current search state via `serializeSearchString()`.

#### Scenario: User types tag syntax in search input

- **WHEN** the user types `[light-novel] 異世界` in the search input
- **THEN** the search feature SHALL parse `light-novel` as a tag filter and `異世界` as the keyword
- **AND** the advanced filter panel (if visible) SHALL reflect the tag as an applied condition

#### Scenario: Applied filter reflected in search input

- **GIVEN** the user has applied a tag filter via the advanced panel UI
- **WHEN** the search input is focused
- **THEN** the input value SHALL include the `[tag-slug]` syntax token representing that filter

## MODIFIED Requirements

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
