# Unified Filter documents

## Decision

REZICS has one server-owned Search capability ceiling and one sparse,
engine-independent `FilterDocument` contract. There is no SearchDocument,
template, preset, capability profile, or client-selectable limit document.

```ts
interface FilterDocument {
  categories?: SearchCategory[];
  where?: UnitPredicate;
  controls?: FilterDocumentControl[];
}
```

Every property is optional. `{}` means exactly:

- no category restriction;
- no fixed predicate;
- no control override;
- no document-provided query, sort, facet, page-size, or result-window default.

The server still needs operational behavior when a request omits a value. Those
values come from `WorkPolicy` and the field registry, not from a hidden default
document. The current Search request default is 20 results; the server ceiling
is 100 results per page, a 10,000-result continuation window, 4,096 scanned
candidates, 50,000 estimated postings, and a 1.5-second normal statement
budget. Raising those limits requires new capacity evidence. An endpoint such
as Progress may narrow the global field and sort set for its own data source;
that is executable server policy and is never persisted as a preset.

The global field registry supplies all controls that apply to the effective
categories. A sparse control entry changes only its named control. Built-in
controls use their field name as the key. Only Tag controls may be repeated
under a custom key. A document cannot add an indexed field, operator, sort, or
resource limit beyond the server ceiling.

## Ownership and persistence

A Zone owns its `filter_document` directly. Book, Media, Software, Realm, and
the Zone directory are ordinary Zones. Their category and predicate boundaries
are stored as concrete Filter documents on those Zone rows; their names do not
select server capabilities.

Search and Feed Blocks choose one of three sources:

- `global` uses `{}` and is still constrained by the hosting Zone;
- `zone` uses the hosting Zone's Filter document;
- `inline` carries an explicit sparse Filter document in the Block.

Shared Search queries contain a FilterDocument snapshot with cursor-free query
state and untrusted presentation hints. The snapshot makes a bearer link
deterministic without retaining a reference to an official template. Ordinary
Search requests may also submit a FilterDocument inline. All paths enter the
same parser, resolver, compiler, field registry, and execution plan.

Zone revisions store the same FilterDocument inside the Unit main snapshot.
Block localizations and Dock revisions store only the unified Block source
forms. This is important: restoring history cannot reintroduce a deleted
SearchDocument or a template name.

## Validation and execution

The TypeBox boundary rejects unknown members. A Unit predicate is limited to
100 nodes and depth 12; Search state is limited to 100 expression nodes and
depth 3 before compilation, 50 injections, four contexts, ten categories, and
50 Filter control overrides. Resolution intersects categories and composes
predicates; it never widens the server policy. Duplicate equal predicates are
canonicalized before execution so a Zone-owned document and its mandatory host
scope do not multiply equivalent database work.

The request path performs no configuration-table fan-out for an inline or
global Filter. A Zone read is a primary-key lookup. Search retains keyset
continuations and bounded per-category work; it does not use offset pagination,
load a corpus into one process, or compute exact whole-corpus counts.

## Workload and capacity

The planning baseline is 500,000,000 rows for every potentially corpus-scale
relation and the forward estimate is 3,000,000,000 rows. Zone configuration is
expected to be much smaller, but the migration does not rely on that
expectation. Shared queries, Docks, Block localizations, Unit revisions, and
revision content are treated as corpus-scale.

Online assumptions are 10,000 Search requests per second platform-wide, a
20-item median page, a 100-item maximum page, 95% Zone Filter cache hits after
warm-up, and a skewed head in which 1% of Zones receive 80% of reads. A Filter
document is bounded by ten categories, 50 control overrides, and the
100-node predicate limit. Zone lookup and compilation are therefore O(1) in
corpus cardinality. Hot Zone IDs should be cached by immutable serialized
document identity; cache misses remain one indexed row read. Backpressure is
the database pool plus the candidate, postings, result-window, facet, and
statement budgets above. Alert when Search p95 exceeds 1.5 seconds, pool wait
exceeds 100 ms, rejected work estimates exceed 1%, or one Zone key exceeds 10%
of cache-miss traffic.

The one-time migrator defaults to 500 rows per transaction and permits at most
5,000. At 500 million rows, a relation requires at most 1,000,000 default-size
batches; at three billion it requires 6,000,000. Each current-document batch is
read by UUID keyset and written with one set-based update. Revision contents use
the `(model, sha256)` unique index; references use the existing `content_id`
indexes and are moved as a bounded work queue, which handles a hot deduplicated
blob without materializing all of its references. Memory and network are
O(batch size × average JSON bytes), never O(corpus). Operators must lower the
batch size when sampled JSON exceeds 256 KiB; 500 such rows are already about
128 MiB before driver overhead.

For sizing, an illustrative 2 KiB average migrated document is roughly 1 TB of
logical payload read at 500 million rows and 6 TB at three billion, before heap,
indexes, WAL, replicas, vacuum headroom, and backups. Every changed current row
creates one heap version and WAL record. Every changed immutable snapshot adds
one canonical revision blob, rewires its indexed references, adjusts Unit
revision byte totals, and removes the unreferenced old blob. Reserve at least
the measured changed-payload size plus two peak WAL retention windows; do not
infer the change ratio from fixtures. Capture row counts, average and p99 JSON
bytes, changed ratios, WAL bytes per batch, replica lag, dead tuples, IOPS,
network throughput, and batch latency on a production snapshot before choosing
a batch size.

The script uses a five-second lock timeout, a 30-minute statement ceiling, and
a database advisory lock, so one database has one writer and no unbounded
queue. It is restartable: already converted current rows validate, new revision
blobs deduplicate by `(model, sha256)`, moved references no longer match the old
work item, and the final DDL refuses an incomplete corpus. At 500 million rows,
run the bulk pass before the release window on a restored production snapshot,
measure its wall time, then schedule equivalent maintenance capacity. At three
billion rows, run the same bounded worker independently on existing database
shards. A single-node three-billion-row database is not an accepted target: its
limiting resources are WAL retention, vacuum debt, and serial scan bandwidth.
Begin hash-sharding by stable owner/Unit identity before projected cutover time
exceeds the backup-restore objective, replica lag stays above 15 minutes, disk
exceeds 70%, or one batch exceeds five seconds for five consecutive minutes.

## 1.6.0 production cutover

This is a direct development-preview replacement. No old route, schema version,
adapter, alias, or dual-read path remains.

1. Take and verify a restorable backup. On a production-size restore, record the
   workload measurements above and run
   `task --dir services/main filter-documents:migrate -- --yes`.
2. Stop 1.5.x API, worker, authoring, and background writers. The release is
   listed as a maintenance cutover; mixed binaries are unsupported.
3. Run the database migration job. It reruns the bounded data worker to catch
   the final delta, then Atlas executes the contract migration only after all
   postconditions pass.
4. Atlas makes `zone.filter_document` required, removes
   `zone.boundary_document`, drops `zone_search_feature`, `search_document`,
   `search_document_revision`, and `search_document_revision_head`, and deletes
   their unreferenced revision blobs. Limit/default-only Search configuration is
   not archived. Legacy Block templates with real category or predicate effects
   become concrete inline Filter documents; a condition-free global template
   becomes the global source.
5. Deploy the 1.6.0 API, worker, generated clients, and web application
   together. Verify `{}` resolves with no document-level condition, each
   official work Zone returns only its own boundary, a Zone Feed continues by
   opaque cursor, a shared query reloads, and a migrated Zone Page and Dock
   revision can be restored.
6. Rebuild normal projections, inspect Search latency and replica/vacuum health,
   and then reopen traffic.

Rollback after the contract migration means restoring the pre-cutover backup
and the complete 1.5.x binary set. Recreating the removed tables from partial
data is not a supported rollback.
