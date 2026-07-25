# Search configuration

`@rezics/search` is the engine-independent contract for the Search feature and its component
suite. A Search Block stores this configuration; it never stores PostgreSQL, Meilisearch,
Algolia, or Elasticsearch DSL.

The versioned Search Feature document has three different sources of state:

- `filter` is an invisible, trusted `@rezics/filter` predicate that user input cannot replace.
- `defaults` prefill a rendered control and disappear when the user supplies that field.
- `controls` are the complete render allow-list. Omitting a control hides it; `optionPolicy`
  includes or excludes individual options.

The lower-level Search engine configuration still uses normalized internal
constraints after the domain Filter adapter runs. Those constraints are not a
public API or a persisted Zone schema.

Both basic and advanced modes compile into one canonical request. Basic mode is flat control
state. Advanced mode is a bounded `all`/`any`/`not` expression tree with closed fields and
operators. Depth, clause count, values, operator allow-lists, modes, sorts, and page sizes are
validated before an engine adapter runs. Execution accepts an opaque cursor rather than a client
offset; the trusted configuration bounds both page size and the maximum result window.

This split follows the useful parts of major systems: Algolia separates non-rendering Configure
parameters, initial UI state, widgets, and renderless connectors; Elasticsearch separates scored
query context from structured filter context and recommends fault-tolerant simple query syntax for
search boxes; GitHub exposes scoped qualifiers without exposing its engine DSL; Google Search
products declare which metadata fields are filterable, facetable, and sortable. Rezics keeps the
same product boundaries while using its own closed contract.
