# Search architecture

REZICS v1 searches current `unit_localization` rows directly in the authoritative PostgreSQL
database. PGroonga accelerates title, summary, semantically visible description text, published
body text, and eligible Unit aliases. There is no external search service, copied search
document, outbox, projector, or index-generation state.

The request boundary runtime-validates the Search and Filter AST, computes a server-owned
complexity proof, and only then compiles parameterized SQL. The same bounded SQL statement
applies PGroonga text predicates, lifecycle rules, viewer authorization, relational filters,
deduplication, sorting, and the keyset boundary. An index match is never an authorization grant.

## Indexes

The canonical inventory is the typed tuple in `database/schema/pgroonga.ts`; all three indexes are
declared by the owning Unit Drizzle schema and emitted in the single v1 baseline. The expression
indexes include all stored current localizations, while the alias index excludes tombstoned rows;
lifecycle and publication fields do not control index membership. `current_search_text_v1`
extracts only Portable Text span values into immutable text, while
`current_search_metadata_v1` joins title, summary, and description text. Both use
`pgroonga_text_full_text_search_ops_v2`. The `v2` suffix is PGroonga's current operator-class API
generation, not a REZICS schema or release version. Text expressions also avoid PGroonga 4.0.8's
`pgroonga_list_broken_indexes()` failure on JSONB indexes. Both expression targets use PGroonga's
`LARGE` lexicon and index flags so the lexicon key space and posting lists are not limited to their
small-data defaults.

Run `task services-main:search:index -- check` to verify pinned extensions and index validity.
Use `reindex-concurrently --yes` for online production maintenance or `reindex --yes` for an
explicit local/offline rebuild. Only canonical allowlisted index names are accepted.

## Result and count semantics

Pages use a query fingerprint plus stable numeric sort values and Unit ID. Localization and
qualified alias matches are deduplicated to one result per Unit only after PostgreSQL applies the
complete authorization and relational Filter predicates. The final page and facet window is
bounded; there is no unordered pre-authorization candidate cutoff that can hide a valid result.
Non-exhausted totals and bounded facets are lower bounds, and no online search path runs an
unbounded exact count. Fixed relation/index estimates use the separately privileged
`approx_count` extension.

## Recovery

Logical backups retain authoritative rows and index definitions, not physical PGroonga index
bytes. Restore recreates indexes from schema DDL, runs `ANALYZE`, and then verifies index validity
and search parity. See `docs/operations/postgresql-backup-recovery.md`.
