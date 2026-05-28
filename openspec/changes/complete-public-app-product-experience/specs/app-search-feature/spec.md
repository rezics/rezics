## MODIFIED Requirements

### Requirement: Search supports task-oriented cross-type discovery

Search SHALL support cross-type results, type filters, tag/realm/entity filters, grouped release results, and result actions that lead to detail, collect, follow, or create flows. Filters SHALL be expressed in stable Unit/Entity/Realm ids with localized labels resolved for display, not raw translated labels as filter values.

#### Scenario: User filters search by realm and type

- **WHEN** a user searches for a title with type `book` and realm filter selected
- **THEN** results SHALL respect both filters and preserve the query state in the route

### Requirement: Search route shows explicit filter chips

The search route SHALL render the active type, realm, tag, entity, and work-grouping filters as visible removable chips bound to the URL query, so filter state is shareable and reversible.

#### Scenario: User removes a filter chip

- **WHEN** a user removes a filter chip on the search page
- **THEN** the URL query SHALL update
- **AND** results SHALL re-fetch without the removed filter

### Requirement: Search remembers recent queries locally

The search UI SHALL offer recent-query suggestions stored client-side, scoped to the current user agent, with a control to clear history. No server contract is required for this affordance.

#### Scenario: User opens search after past queries

- **WHEN** a user focuses the search input and has past queries stored locally
- **THEN** the UI SHALL offer recent queries as quick suggestions
- **AND** a clear-history control SHALL be available
