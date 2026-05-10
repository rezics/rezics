## ADDED Requirements

### Requirement: Federated path forwards kind filter from query syntax

When the federated search orchestrator dispatches a sub-query against the `posts` index for a category that may surface posts (`all`, `mixed`, `posts`, `reviews`, `excerpts`, `remarks`), it SHALL forward the `kind` value from the parsed `SearchQuery` (populated from the `kind:` token defined in `search-query-syntax`) onto the post sub-query as the existing `PostSearchOptions.kind` filter. For category values that already imply a `kind` (e.g., `category = "reviews"` ⇒ `kind = "REVIEW"`), the category-implied filter SHALL take precedence over a conflicting `query.kind`.

The `posts` index `filterableAttributes` SHALL remain unchanged by this change; this requirement only governs how the orchestrator wires existing filters together.

#### Scenario: Free `kind:` token narrows the All view

- **GIVEN** `{ scope: { kind: "global" }, category: "all", query: { keyword: "magic", kind: "REVIEW" } }`
- **WHEN** the orchestrator builds post sub-queries for the `reviews`, `excerpts`, `remarks`, and `posts` sections
- **THEN** the `reviews` section SHALL apply `kind = "REVIEW"` (matches; surfaced)
- **AND** the `excerpts`, `remarks`, and `posts` sections SHALL be empty for this query (because `query.kind = "REVIEW"` does not match those categories)

#### Scenario: Category-implied kind beats free token

- **GIVEN** `{ scope: { kind: "book", unitId: "b-1" }, category: "reviews", query: { kind: "POST" } }`
- **WHEN** the orchestrator dispatches the single-category query
- **THEN** the post sub-query SHALL apply `kind = "REVIEW" AND rootTargetUnitId = "b-1"`
- **AND** SHALL NOT apply `kind = "POST"`

#### Scenario: kind ignored on non-post categories

- **GIVEN** `{ scope: { kind: "global" }, category: "books", query: { kind: "REVIEW", keyword: "x" } }`
- **WHEN** the orchestrator dispatches the content sub-query
- **THEN** the filter expression SHALL NOT contain `kind`
- **AND** the sub-query SHALL succeed without error
