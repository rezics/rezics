## MODIFIED Requirements

### Requirement: Search supports task-oriented cross-type discovery

Search SHALL support cross-type results, type filters, tag/realm/entity filters, grouped release results, and result actions that lead to detail, collect, follow, or create flows.

#### Scenario: User filters search by realm and type

- **WHEN** a user searches for a title with type `book` and realm filter selected
- **THEN** results SHALL respect both filters and preserve the query state in the route
