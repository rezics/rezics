# Search architecture

REZICS v1 searches current `unit_localization` rows directly in the authoritative PostgreSQL
database. PGroonga accelerates title, summary, semantically visible description text, and
published body text. There is no external search service, copied search document, outbox,
projector, or index-generation state.

The request boundary runtime-validates the Search and Filter AST, computes a server-owned
complexity proof, and only then compiles parameterized SQL. The same bounded SQL statement
applies PGroonga text predicates, lifecycle rules, viewer authorization, relational filters,
deduplication, sorting, and the keyset boundary. An index match is never an authorization grant.

## Indexes

The canonical inventory is `services/main/search/pgroonga-indexes.sql` and is mirrored in the
single v1 baseline. Both indexes include all stored current localizations; lifecycle fields do not
control index membership. `current_search_text_v1` extracts only Portable Text span values, and
JSONB full-text indexes use `pgroonga_jsonb_full_text_search_ops_v2` for documents larger than
4 KiB. The `v2` suffix is PGroonga's current operator-class API generation, not a REZICS schema
or release version. Both expression targets use PGroonga's `LARGE` lexicon and index flags so the
lexicon key space and posting lists are not limited to their small-data defaults.

Run `task services-main:search:index -- check` to verify pinned extensions and index validity.
Use `reindex-concurrently --yes` for online production maintenance or `reindex --yes` for an
explicit local/offline rebuild. Only canonical allowlisted index names are accepted.

## Result and count semantics

Pages use a query fingerprint plus stable numeric sort values and Unit ID. One result card is
returned per Unit when multiple localizations match. PGroonga materializes at most
`SEARCH_CANDIDATE_SCAN_LIMIT` current localizations (512 by default, 8,192 hard ceiling), after
which authorization and complex filters run as bounded primary-key lookups. The candidate CTE
reads one sentinel row beyond the budget; a truncated scan is reported as a lower-bound total and
never as exact. Non-exhausted totals and bounded facets are also lower bounds, and no online
search path runs an unbounded exact count. Fixed relation/index estimates use the separately
privileged `approx_count` extension.

## Recovery

Logical backups retain authoritative rows and index definitions, not physical PGroonga index
bytes. Restore excludes exactly the canonical PGroonga index entries from post-data, restores all
authoritative data, recreates the indexes from the checked-in inventory, runs `ANALYZE`, and then
verifies index validity and search parity. See `docs/operations/postgresql-backup-recovery.md`.
