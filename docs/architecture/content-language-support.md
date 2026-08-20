# Unit content language support

Status: Accepted

Owner: Units

## Decision

`contentLanguageSupport` is the only authoritative content-consumption language
field. It is a user-maintained Unit value and one atomic Unit-history field. An
entry has one canonical BCP 47 `languageTag` and may optionally name one or more
of the fixed channels `text`, `audio`, `subtitle`, and `interface`. Omitted
`channels` means that the declaration is known only at the language level; an
empty channel array is invalid. Input is normalized into code-point-sorted
language order and registry-sorted channel order before storage, revision
hashing, or response caching.

This field does not replace, alias, or derive any localization or availability
contract:

- `unit_localization` remains authored presentation metadata and content in the
  product's bounded localization-language groups.
- `availableLanguages` and existing localization filters retain their current
  discovery and presentation meaning.
- A Unit can remain available to the wiki, community, comments, reviews, and
  every non-consumption surface even when `contentLanguageSupport` is empty.
- No read or write path converts localization languages into content language
  support, or content language support into availability.

The sparse `unit_content_language_support` relation stores one bounded JSONB
`value` per supported Unit. Absence means the authoritative value is `[]`;
empty arrays are never stored. The primary key is `unit_id`, and the composite
foreign key `(unit_id, unit_kind)` proves that the declaration belongs to a
Book, Software, Media, Video, Audio, or Release Unit. PostgreSQL proves only
the row-local kind and top-level non-empty array bound. The shared runtime
contract proves canonical BCP 47 tags, exact object keys, supported channels,
uniqueness after canonicalization, and the 64-entry ceiling on every public
write and persisted read. There is deliberately no JSONB GIN index: no request
path searches the corpus through this authoritative document.

Unit history owns a separate `content_language_support` slot with model
`rezics.unit.content-language-support.v1`. New revisions always include the
slot, including an empty value. Revisions created before the slot existed have
the released legacy meaning `[]`. Restore and undo replace the whole field in
the same transaction as the Unit snapshot; concurrent overlapping edits
conflict at the field boundary instead of mechanically merging languages.

## Editing evidence, not a second value

The editor may ask for related Unit declarations. This evidence is read-only,
non-authoritative, and never persisted or copied into another Unit:

| Edited Unit | Direct evidence sources |
| --- | --- |
| Book | its Main when editing a Variant, and direct Variants of that Main |
| Software | its Main/direct Variants, and Releases whose direct parent is the edited Software |
| Media | its Main/direct Variants, and direct Video/Audio occurrences in its own `media.contents` structure |
| Video | Audio Units reached by one explicit `adapted_audio` Unit relation hop |
| Audio | none |
| Release | its direct parent Unit |

The evidence endpoint does not calculate a merged answer. It returns each
related Unit's one authoritative field so the editor can make the final choice.
It never recursively traverses a Content Structure, follows nested Unit
relationships, enumerates a complete Main subtree, or treats a Video's tree
position as an adapted-Audio relationship. Media occurrences are read as a
flat, keyset-paginated occurrence range through the owning structure.

Each page contains at most 50 evidence items. A Unit-bound opaque cursor seeks
the complete source-specific key:

- Release parent: one primary-key lookup with no recursive continuation;
- Variant: `(main_unit_id, created_at, variant_unit_id)`;
- Release: `(parent_unit_id, released_on NULLS LAST, id)`; and
- Media occurrence: `(structure_id, node_id)` after resolving the one active
  `media.contents` structure by `(owner_unit_id, kind)`; and
- Video adapted Audio: `(source_unit_id, relation_kind, target_unit_id)`.

The candidate page is hydrated with one bounded Unit presentation query and one
bounded support query. No offset, count, unbounded `IN` list, N+1 query, GIN
scan, corpus aggregation, or Content Structure recursion is permitted. A cache
may memoize an evidence response only as a disposable projection keyed by the
edited Unit/version, cursor, localization hints, and viewer access epoch. Such
a cache never enters Unit history and must not become a second language field.

## Workload and capacity

### Cardinality and distribution

The corpus planning baseline is 500,000,000 Units and the forward estimate is
3,000,000,000 Units. Let `p` be the fraction of Units with a non-empty field;
the sparse table has exactly `pN` rows. `p` is not yet measured, so capacity
must be checked at both a 10% planning scenario and the 100% safety envelope:

| Corpus | 10% non-empty | 100% non-empty |
| --- | ---: | ---: |
| 500M Units | 50M rows | 500M rows |
| 3B Units | 300M rows | 3B rows |

The working estimate is three language entries per non-empty Unit. It is an
assumption for sizing, not a product cap. Main Units may be hot and language
distribution is highly skewed, but row ownership remains uniformly routable by
UUID `unit_id`; common languages do not create a write hot key because they are
inside the per-Unit document and have no reverse index.

### Storage sensitivity

A typical heap row with three short tags is provisionally 200–400 bytes after
tuple/JSONB overhead, before free-space, dead tuples, TOAST, WAL, replicas, and
backups. The primary-key index is provisionally 40–80 bytes per row. These are
planning ranges that must be replaced by `pg_column_size`, `pg_relation_size`,
and production-shaped samples:

| Corpus case | Heap estimate | Primary-key estimate |
| --- | ---: | ---: |
| 500M, 10% non-empty | 10–20 GB | 2–4 GB |
| 500M, 100% non-empty | 100–200 GB | 20–40 GB |
| 3B, 10% non-empty | 60–120 GB | 12–24 GB |
| 3B, 100% non-empty | 600 GB–1.2 TB | 120–240 GB |

Operational provisioning must additionally cover revision content, at least
one replica, backups, temporary index builds, normal bloat, and peak WAL. The
64-entry/255-character pathological document is roughly tens of KiB rather
than the typical hundreds of bytes; if every row approached that bound, heap
and TOAST storage would reach multi-terabyte scale at 500M rows and tens of
terabytes at 3B. Track the p50/p95/p99 document byte size and entry count rather
than extrapolating only from the typical row.

Revision storage grows with edits, not just Units. Revision content is hashed
and reused when unchanged, and a Unit revision reuses the previous slot content
ID when this field did not change. A changed field creates one bounded revision
document. Monitor revisions per Unit and new revision-content bytes per day;
high-churn Units are the skew risk.

### Read, write, concurrency, and network work

- A Unit read adds one primary-key probe. Evidence hydration probes at most 50
  distinct related Unit IDs, with an internal hard batch ceiling of 100.
- A non-empty write adds one upsert; clearing adds one indexed delete. The
  conflict update has an atomic `IS DISTINCT FROM` predicate over the stored
  JSONB value and Unit kind, so an identical normalized declaration does not
  rewrite the support row or amplify its heap, index, autovacuum, or WAL work.
  Both paths remain inside the existing Unit optimistic-concurrency and
  revision transaction, with no read-before-write corpus work.
- One evidence request performs at most four indexed source queries plus two
  bounded batch projections. Its CPU, memory, serialization, and network work
  are `O(page size)`, never `O(corpus)` or `O(structure size)`.
- Concurrent editors already serialize history through the per-Unit advisory
  lock and Unit `updated_at` compare-and-swap. A hot Unit can serialize its own
  writes; unrelated Units do not share a language key or lock.
- API quotas and the 50-item page limit provide admission backpressure. If
  evidence traffic causes replica lag or pool saturation, shed/retry editor
  evidence requests before weakening Unit mutation correctness.

No new latency or throughput promise is invented here. Before production
cutover, benchmark point reads, upserts, clears, and all three range sources at
representative skew. Run `EXPLAIN (ANALYZE, BUFFERS)` and confirm the primary
key, `unit_variant_main_created_at_idx`,
`release_parent_released_on_idx`,
`content_structure_owner_kind_idx`, and
`content_structure_node_structure_id_idx` own candidate generation and that
actual rows never exceed `limit + 1`. Observe p50/p95/p99 latency, rows removed
by filters, buffer reads, lock waits, pool occupancy, WAL bytes, replica lag,
autovacuum progress, bloat, and cache hit rate.

## Partitioning and sharding path

The logical model is shardable because every authoritative read and write is
owned by one immutable Unit ID. Do not wait for a single physical relation to
approach the 500M safety envelope. Start the cutover plan when the next
12-month forecast would exceed any measured node budget: 60% of provisioned
table/index storage, a primary-key working set that no longer meets the point
lookup objective, autovacuum unable to finish inside its interval, sustained
WAL/replica lag outside the service budget, or maintenance/reindex time outside
the recovery window.

Use stable hash buckets of `unit_id`, co-locating the Unit, its support row, and
Unit history so the kind foreign key and atomic restore remain local. As a
planning illustration, 16 shards at 500M fully populated rows average 31.25M
support rows per shard; 64 shards at 3B average 46.875M. Actual shard and local
partition counts must come from measured row width, index residency, write
rate, and recovery time rather than these averages.

Repartition with bounded UUID keyset copies and backpressure: create the target
buckets, dual-write one bucket, copy bounded batches, compare counts and
checksums per bucket, switch reads, stop the old write, and retire the old
bucket only after the rollback window. Global discovery by language, if later
required, belongs in a derived search/outbox projection partitioned for that
query; it must never turn this authoritative JSONB table into a cross-shard
scan or introduce another editable field.

## Migration and cutover

The generated release migration
`20260820063101_content_language_support_and_unit_relations.sql` adds the
revision-slot enum value and creates the empty sparse table. It intentionally
does not backfill from `unit_localization`, `availableLanguages`, a Content
Structure, Variants, or Releases. Therefore historical-data work is constant
and no 500M-row validation scan is justified. The typed schema is not a live
database cutover until this migration is applied.

The old binary does not understand the new history slot, so use a coordinated
cutover:

1. Stop Unit writes or enter the normal maintenance response.
2. Apply the enum/table DDL and verify the composite Unit-kind foreign key and
   JSONB root/length check.
3. Deploy the new API and workers before allowing a revision with the new slot.
4. Run schema reconciliation and the production-shaped `EXPLAIN`/benchmark
   matrix above.
5. Create, update, clear, restore, and undo one Unit field; verify old revisions
   read as `[]` and new revisions contain exactly one slot.
6. Resume writes while watching database latency, WAL, replica lag, and error
   telemetry.

A failed DDL transaction leaves the previous application untouched. After new
slots are written, rollback requires the new reader or a coordinated database
restore; silently dropping slot rows would destroy authored history. Prefer a
forward fix.
