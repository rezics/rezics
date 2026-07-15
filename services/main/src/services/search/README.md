# Search service

Search runs directly against the authoritative PostgreSQL tables. Drizzle owns the PGroonga
indexes on unit localizations, profiles, poll options, and unit slugs; the generated search
migration also ensures that the extension exists. Soft-deleted slugs and poll options use partial
indexes that match the query predicates. Replies are posts, so their localized content uses the
same unit-localization indexes as every other post.

[`schema.ts`](./schema.ts) owns public categories, sorts, and category capabilities.
[`service.ts`](./service.ts) owns their mapping to the current Drizzle schema, filters, result
projection, ordering, and pagination. When a searchable field changes, update its table index and
the candidate query together, then generate a normal Drizzle migration.
