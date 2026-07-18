# Search service

Search runs directly against the authoritative PostgreSQL tables. Drizzle owns the PGroonga
indexes on unit localizations, profiles, poll options, and unit slugs; the generated search
migration also ensures that the extension exists. Soft-deleted slugs and poll options use partial
indexes that match the query predicates. Replies are posts, so their localized content uses the
same unit-localization indexes as every other post.

Search is a separate feature, not a Block renderer. `@rezics/search` owns its trusted configuration,
basic/advanced input, controls, option policies, and bounded expression tree. `@rezics/block` embeds
that configuration in a Search Block. The API exposes the server-owned global configuration at
`GET /search/configuration` and executes it at `POST /search/execute`; clients never submit a
configuration as authority. Zone execution resolves the stored Zone boundary, Realm execution adds
a Realm constraint, and Unit execution can include Content Structure descendants. Zone Dock and
Page endpoints load the named Search Block from the stored Block document and intersect its scope
with the host Zone boundary. Cursor offsets are decoded only by Search and rejected outside the
configuration's maximum result window. Configured execution also returns conjunctive facet counts
for dynamic control options; category adapters batch all requested facets into one query and bound
each facet to 100 values.

Every query is visibility-aware. Anonymous searches see discoverable, approved public Units.
Authenticated searches additionally see Units readable through direct, authenticated, or Realm
bindings, while unlisted Units are not globally enumerable. Structured filters compile separately
from full-text matching and do not alter relevance.

[`schema.ts`](./schema.ts) owns public categories, sorts, and category capabilities.
[`service.ts`](./service.ts) owns their mapping to the current Drizzle schema, filters, result
projection, ordering, and pagination. When a searchable field changes, update its table index and
the candidate query together, then generate a normal Drizzle migration.
