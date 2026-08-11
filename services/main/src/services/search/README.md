# Search architecture

REZICS v1 keeps authoritative content in PostgreSQL and transactionally projects one
`unit_search_document` row per immutable Unit ID. PGroonga indexes the localized title, summary,
semantically visible description text, published body text, and eligible aliases in that single
document. Row triggers refresh only the affected Unit when its localization, alias eligibility,
or ordering timestamp changes. There is no external search service, asynchronous copy lag, or
cross-source merge at query time.

The request boundary runtime-validates the Search and Filter AST, computes a server-owned
physical-plan proof, and only then compiles parameterized SQL. Execution has two stages: an
index-ordered source seeks after the opaque cursor, then at most 4,096 candidates pass through
the complete lifecycle, viewer authorization, category, relational Filter, and deduplication
checks. An index match is never an authorization grant.

## Indexes

The canonical inventory is the typed tuple in `database/schema/pgroonga.ts`; all indexes are
declared by their owning Drizzle schema. The localization expression
indexes include all stored current localizations, while the alias index excludes tombstoned rows;
lifecycle and publication fields do not control index membership. `current_search_text_v1`
extracts only Portable Text span values into immutable text, while
`current_search_metadata_v1` joins title, summary, and description text. Both use
`pgroonga_text_full_text_search_ops_v2`. The `v2` suffix is PGroonga's current operator-class API
generation, not a REZICS schema or release version. Text expressions also avoid PGroonga 4.0.8's
`pgroonga_list_broken_indexes()` failure on JSONB indexes. Both expression targets use PGroonga's
`LARGE` lexicon and index flags so the lexicon key space and posting lists are not limited to their
small-data defaults. The multi-column Search-document index also uses `LARGE` for every text
source. It stores an all-language document, one document per supported language (including
language-neutral aliases), and one lexicographically sortable `updatedAt + Unit ID` key. The
composite key makes Groonga's continuation a single indexed comparison while preserving the
public `(updatedAt, Unit ID)` order.

Run `task services-main:search:index -- check` to verify pinned extensions and index validity.
Use `reindex-concurrently --yes` for online production maintenance or `reindex --yes` for an
explicit local/offline rebuild. Only canonical allowlisted index names are accepted.

## Ordering sources and complexity

Every supported non-relevance sort names its physical B-tree indexes in the typed field
registry. Created, updated, published, poll-close, reply-count, and follower-count sources seek
the complete sort tuple and Unit ID. Ascending indexes use an ascending Unit-ID tie-breaker and
descending indexes use a descending tie-breaker, allowing PostgreSQL row-value comparisons to
start at the cursor instead of filtering every preceding index entry. Nullable timestamps use
separate non-null and null phases. `best` pins the cursor to one immutable hourly recommendation
snapshot: positive time-decayed scores use the sparse `unit_best_score_kind_order_idx`, then
zero-score Units continue from `unit_public_kind_updated_at_desc_idx`. Per-kind Top-K branches
are merged after each branch has used its equality-leading index. The sparse projection is rebuilt
before a new snapshot becomes active, so its size follows recent positive activity rather than all
Units.

See [Sparse best ranking](../../../../../docs/architecture/sparse-best-ranking.md) for the shared
Feed/Search model, 500-million-row complexity boundary, and deployment cutover.

For an unfiltered page, B-tree candidate generation is `O(log N + k)` at every cursor depth, not
only on the first page. Residual authorization or relational filters make the request
`O(log N + S * filterCost)`, where `S <= 4,096` is enforced by server policy. If a selective
filter cannot fill the requested page inside that budget, Search returns fewer results and a
cursor positioned after the last scanned candidate. It never scans the rest of the corpus to
fill one request.

Positive Unit ID, Realm-placement, credit-attribution, subject-association, publisher, Tag,
Score, Post-subject/context, and Collection-item predicates expose an indexed candidate-set
proof. Language and kind alone deliberately do not: their sets can scale with the corpus. When
every branch of an `any` predicate has a proof, Search streams their `UNION ALL`; for a
conjunction, any one positive proof is already a safe superset, so Search chooses one instead of
materializing an `INTERSECT`.

The reverse-index stream is probed only up to 4,097 rows. At most 4,096 raw candidates are
deduplicated and sorted through the sparse path for every supported order, including `best`.
An overflow means the filter is dense: Search switches to the normal ordered index and applies
the relation through bounded membership probes. This adaptive split prevents both failure modes:
scanning the global order for a rare relation and sorting every member of a popular relation.
The complete authorization and Filter predicate is still reapplied afterward, so a seed may be
wider than the true result but can never widen returned results. Global category execution
evaluates shared authorization, scope, and domain predicates once rather than duplicating them in
every category branch.

The public `relevance` sort does not compute a request-time relevance score. It uses stable
`(updatedAt DESC, Unit ID DESC)` order and a narrowly privileged `search_text_candidates`
function; the application role cannot run arbitrary Groonga commands. Before choosing a path,
the function asks each selected Groonga lexicon for `table_tokenize(..., index_column=...)`
`estimated_size` values. This is an index-statistic lookup, not an exact count or a scan.

Queries whose estimated posting work is at most 50,000 use Groonga's inverted index and the
single composite search-after key. Higher-cost queries seek a bounded window from
`unit_public_updated_at_desc_idx` and test only that window against the projected document. A
dense fallback never expands repeatedly inside one request: if filtering under-fills the page,
Search returns the partial page and a cursor after the last scanned Unit. Both paths have exactly
the same total order, so changing plans between pages cannot invalidate the cursor. Sparse work
is `O(T(q) + P(q) + k log k)` with `P(q) <= 50,000`; dense work per request is
`O(T(q) + log N + S * matchCost)`, where `T(q)` is the bounded lexicon-estimation work and the
candidate window `S` is bounded by policy. There is no corpus-wide score materialization,
unbounded exact hit count, offset scan, or query-time sort over every match.

Global facets reuse one request-scoped bounded candidate stream across categories. They do not
rerun ranking once per category.

## Result and count semantics

Pages use a query fingerprint, the complete stable sort tuple, the ordered-source phase, and, for
`best`, the immutable snapshot ID. Localization and qualified alias text is transactionally
deduplicated into one projected document per Unit. Non-exhausted totals and bounded facets are lower bounds, and no online
search path runs an unbounded exact count. Fixed relation/index estimates use the separately
privileged `approx_count` extension.

A bounded scan may legitimately return zero hits while still advancing over ordered candidates.
Its cursor therefore carries both a zero returned-hit count and a non-empty keyset position; the
position proves forward progress and prevents rescanning or an invalid empty-page cursor.

That cursor is part of the explicit Search execution contract. Feed presentation is deliberately
stricter: after hydration, a page with zero presented items is terminal and does not expose the
internal Search cursor. Otherwise one visible infinite-scroll sentinel could turn separately
bounded 4,096-candidate requests into an unbounded request chain. A non-empty Feed page retains
the cursor, so normal keyset pagination remains `O(log N + S * filterCost)` per user action while
empty-result work stays bounded to one request at both 500 million and 3 billion corpus rows.

`task services-main:search:capacity -- --yes --rows 1000000` is an explicitly destructive,
manual capacity qualification against disposable `rezics_atlas`. It is intentionally not a CI
job: deterministic tests enforce cursor, budget, and physical-source contracts, while this task
measures a chosen PostgreSQL host and dataset. The qualification rejects ordered deep-cursor
plans that miss their declared index or touch more than a fixed shared-block budget; seeing an
index name alone is not considered proof of an index seek.

Five hundred million Units is a sharded-capacity target, not a single-index target. Groonga's
documented per-table record ceiling is too close to that cardinality to leave safe operational
headroom, and each full-text index also has a documented size ceiling. Partition before either
limit is approached, apply the same bounded sparse/dense search on every shard, and merge only
each shard's next ordered page by the common `(updatedAt, Unit ID)` key. The one-million-row task
qualifies request complexity and plan shape; it does not by itself certify 500-million-row disk,
memory, replication, backup, or rebuild capacity.

## Recovery

Logical backups retain authoritative rows, the deterministic Search documents, and index
definitions, not physical PGroonga index bytes. Restore recreates indexes from schema DDL, runs
`ANALYZE`, and then verifies index validity and search parity. See
`docs/operations/postgresql-backup-recovery.md`.
