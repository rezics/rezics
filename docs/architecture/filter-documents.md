# Unified Filter documents

## Decision

REZICS has one server-owned Search capability ceiling and one sparse,
engine-independent `FilterDocument` contract. There is no SearchDocument,
template, preset, capability profile, or client-selectable limit document.

```ts
interface FilterDocument {
  categories?: SearchCategory[];
  where?: ResourcePredicate;
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

## Selected temporal capabilities

The target adds [event occurrence-time fields](database/event-time.md) to the
server registry: actual/planned temporal role, civil-date/instant interpretation,
definite/possible matching, start-in/overlap predicates and chronological sorting.
The registry declares each applicable target, typed effective field and index.
Named-event topic bindings and participant predicates compose through bounded
candidate plans; a Tag selection alone does not create a date index. Event-list
and matching-content result modes retain their own identities and denominators.
Unsupported calendars/operators return typed unavailable/invalid outcomes.

[Rating timeline selection](database/ratings.md) similarly preserves explicit
context, time basis/range, scale, aggregation method and generation through
saved state and drill-down. A Filter or display control cannot create a rating
context, turn an observation correction into a new submission, or relabel an
observation-weighted mean as an equal-person score. The rating API owns these
reductions; Search does not recompute them by joining arbitrary raw score rows.

These are selected target contracts pending their backend qualification. The
[temporal budgets](database/temporal-capacity.md) may narrow this server ceiling;
they do not silently raise its candidate, posting or response limits.

## Ownership and persistence

The Space presentation capability owns its versioned boundary Filter. A route
resolves a Resource and carries the admitted boundary as a trusted injection;
the target's shared content does not acquire a different stored body or owner.
Book, Media, Software and community directories are ordinary configured views,
not server query-capability profiles selected by display name.

Search and Feed Blocks can select global, hosting-Space or explicit inline Filter
sources under the same parser and field registry. Global source does not remove
the host's narrowing boundary. Filter state is declarative data, never executable
SQL or a credential.

Shared queries contain a versioned Filter snapshot, cursor-free query state and
untrusted presentation hints. Versioned Space configuration, Resource content and
Dock revisions retain their own exact Filter inputs. Restoration cannot revive
an unsupported format or a retired execution capability. The former released
SearchDocument/template migration is [historical procedure](../releases/1.6.0.md#filter-document-cutover),
not another target model or a reason to rewrite the current migration baseline.

## Validation and execution

The TypeBox boundary rejects unknown members. A Resource predicate is limited to
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
expected to be much smaller, but its storage/query design does not rely on that
expectation. Shared queries, Docks, Block localizations, Resource revisions, and
revision content are treated as corpus-scale.

Online assumptions are 10,000 Search requests per second platform-wide, a
20-item median page, a 100-item maximum page, 95% Zone Filter cache hits after
warm-up, and a skewed head in which 1% of Zones receive 80% of reads. A Filter
document is bounded by ten categories, 50 control overrides, and the
100-node predicate limit. Compilation is bounded by document size, independently
of corpus cardinality; an uncached Zone lookup still requires an indexed
`O(log Z)` seek for Z Zone rows. Expected constant-time cache lookup does not
remove the miss cost. Cache hot Zone IDs by immutable serialized document
identity. These preparation bounds do not bound execution of the resulting
Search/filter query. Backpressure is
the database pool plus the candidate, postings, result-window, facet, and
statement budgets above. Alert when Search p95 exceeds 1.5 seconds, pool wait
exceeds 100 ms, rejected work estimates exceed 1%, or one Zone key exceeds 10%
of cache-miss traffic.

At an illustrative 2 KiB per document, 500M/3B stored documents represent about
1.024/6.144 TB of payload before revisions, indexes, TOAST, WAL, replicas and backup.
Count immutable revisions and shared content references separately; deduplication
must preserve disclosure and erasure. An execution budget limits examined work,
not just returned rows. The 10,000 requests/s scenario is unqualified and does not
follow from row count or cache-hit assumptions.

Use same-database owner/time partitions where their query and retention benefits
are measured. Rebuild derived filter/search state with bounded, resumable batches
and immutable version cutoffs. Full exports and rebuilds still process their
selected corpus bytes and need separate maintenance budgets. Current schema
installation does not require the historical SearchDocument conversion; its
[workload record](../releases/1.6.0.md#filter-migration-workload-record) belongs to
that release. No fixed row count mandates database splitting.
