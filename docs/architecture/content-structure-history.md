# Content Structure, Dock, History, and Search

Target contract. [System architecture](database/README.md) owns authority and consistency;
[composition](database/content-composition.md) owns explicit contents, import/refresh and
publication. Current routes, limits and partial implementation are documented in the
[native service boundary](../../services/main/src/services/content-structure/native-structure.md).
These contracts do not claim that the replacement APIs already exist.

## Aggregate boundary

History follows lifecycle, concurrency and restoration authority. A Work, release,
contributed content, Content Structure and Dock retain independently maintained identities
and heads. Nodes are occurrences owned by a structure; the referenced content has its own
identity and authority. Changing metadata or restoring a Work does not implicitly restore
all referenced structures, content or Docks.

A Page Post and its exact ZonePage binding retain page identity independently of navigation,
addressing and placement. A page need not be present in a navigation structure to exist.
Page, address, display placement and composition mutations therefore use their own preconditions.

Shared history and reference protocols do not require all native objects to use one physical
revision table. Each domain keeps complete owner/variant/revision keys and explicit public heads.
A multi-object workflow records the exact versions it used rather than borrowing another
aggregate's concurrency token.

## Unit history storage

A logical Unit is an identity/reference/capability contract. Its domain revision describes the
state owned by that aggregate, not a checkpoint of every reachable object. The existing
`unit_revision` family is one implementation; catalog metadata and other owners have their
own qualified revision families.

Immutable manifests can reuse unchanged content-addressed documents. A snapshot's logical
byte size is not the amount of newly allocated storage. Deltas/checkpoints are internal
representations with bounded replay and exact bases; they must preserve the same revision
meaning. No generic JSON patch or content hash supplies authorization or identity equality.

Restore creates a new authorized revision or selection and retains the old history. It
rechecks current target eligibility and disclosure. Invalid, unavailable or erased inputs
cannot become an accepted state merely because they appeared in an older snapshot.

### Unit revision contribution provenance

Preserve accountable operator, credited contributor, method and source independently.
Human/AI/unattributed declarations describe contribution provenance rather than infer who
controls the resource. A credited software-agent Entity is distinct from the private account
that authorized the operation. Source acquisition does not create native accounts or grant
participation through matching names.

Retain the exact contribution contract and allowed historical credit even when current
metadata changes. History lists and contributor reverse queries use bounded pages and
selective indexes; provenance does not require scanning all revisions or updating every
past credit when a display name changes.

### Unit revision visibility

Immutable identity/history is separate from currently permitted disclosure. Apply the
[access vocabulary](../../libraries/access/README.md) and governance rules to content,
metadata, edit summaries and actors. A placeholder may preserve permitted chronology only
when the viewer is allowed to know that history exists. Suppression must not leak identity,
counts, slot contents or private authors through compare, restore, search or export.

Correcting a public selection, withdrawing a use, revoking a grant and erasing a payload are
separate operations. Recovery replays erasure and revocation frontiers before exposing
restored content. History is not an irrevocable copy of sensitive bytes.

## Localized content metrics

[Native Work profiles](database/native-work.md#classification-and-applicable-properties)
determine which measurements apply. A word count describes exact text, language, coverage
and algorithm; duration describes timed content or a selected sequence. Unknown,
inapplicable and inaccessible values do not become zero.

Reported external lengths remain claims with their own scope. Measured hosted-content
counts are projections, not author-edited metadata. Published-composition totals use the
selected revisions and declare occurrence-weighted versus distinct-content counting.
Do not add both container subtotals and explicit leaf counts or sum language alternatives
into one unqualified Work length.

The current metrics SQL measures current Chapter localizations and refreshes owner totals
from row triggers. The replacement [measurement protocol](database/content-composition.md#measurements-and-read-models)
coalesces changes per operation/generation, uses valid deltas or paged recomputation, and
retains exact input provenance. This transition must be qualified with large import and
refresh tests rather than increasing tree limits in isolation.

## Naming and identities

The [identity/reference contract](database/README.md#31-identity-rules) separates logical
owner, native identity, revision, occurrence and physical placement. A slug is an address.
A local occurrence label/number may differ from the current content name without modifying
the referenced content. Capturing or exposing that label requires appropriate disclosure.

Structural kind identifiers name purpose and validated behavior; they are not the entire
classification of a Work and do not grant a capability or permission.

## Content Structure kinds

Domain profiles specialize a shared composition protocol. The current `book.contents`
owner is a Publishing TextVersion and `media.contents` uses Program; these existing mappings
must be reconciled with native Work/release selections rather than define the common model.
Post contents, Realm taxonomy and Zone/wiki navigation retain their own purpose and target
rules. A navigation grouping, external URL, label or reference-only node is not consumed
body content by assumption.

A container occurrence does not unfold another object's latest structure. To include its
children, record destination-local occurrences manually or use explicit version-bound
import. Repeated content, local ordering and coverage are legal under the profile. Family
or classification relationships cannot silently supply those members.

Membership, navigation and reading/playback order have separate meanings; a profile can
derive a default order from one occurrence set while supporting explicit alternatives.
Previous/next destinations identify occurrences because one content object may be used more
than once. Progress is neither copied from source structures nor implied by container nodes.

## Chapter identity, Reader context, and takedown

A Chapter currently has its own Post identity. The target contributed-content model keeps
that independence through qualified content/revision references. Standalone identity lookup
and contextual consumption remain distinct requests; a reader does not guess one parent
from all possible uses, and a failed contextual read does not bypass policy by falling back
to another route.

Contextual consumption proves the selected structure/manifest/occurrence, compatible exact
content and currently effective disclosure. An accessible parent alone is insufficient.
An explicit disclosure grant may authorize an exact adoption according to its scope;
ordinary membership is not that grant. Metadata-only presentation does not delete the body
or claim readable coverage.

Withdrawing a Work or release does not automatically draft its independently owned content.
A separately requested child-lifecycle operation uses its own permission checks, captured
scope, bounded pages, receipts and cancellation policy. The existing chapter-draft worker
is a limited implementation of this workflow, not authority to retarget every reuse.

### Workload and capacity

Plan occurrences, revisions, imports, memberships and read projections at 500M and 3B rows,
including long-tail structure size and widely reused content. The current 2,048-node and
64-live-placement guards remain until [replacement acceptance](../testing/content-composition.md)
qualifies staged writes, revision-bound child pagination, statistics and recovery together.
They do not establish a permanent semantic limit on a Work's size or number of uses.

One child page uses the structure/manifest/parent/order/occurrence index and bounded hydration;
a full export processes its declared output through continuation. Reverse impact queries
use selective current-use indexes and durable cursors. Historical/deleted placements must
not cause unbounded synchronous refresh even when current live usage is small.

Measure row/key widths, repeated-use amplification, history retention, WAL, locks, memory,
response bytes, queue age and stale projection behavior. An indexed or bounded query can
still exceed an SLO. Estimates from an older physical layout are not qualification of
changed occurrence keys or exact-reference storage.

## Content Structure history

Each accepted edit compares its base head under the structure's lock. Domain commands record
semantic operations on stable occurrences; invalid small edits commit nothing. A command
count is not a row-work budget: deleting one subtree can touch many nodes. Large operations
must use the common staged protocol rather than hide unlimited work in a single command.

Plan, stage, validate, activate and cleanup record durable progress. Source-to-destination
mapping survives retries. Refresh compares imported base, proposed source and local edits;
activation rechecks current authority and expected destination version. Only the validated
complete manifest becomes a published selection.

The current history implementation uses immutable deltas and checkpoints, with thresholds
of 32 delta levels, 64 KiB for one delta and 256 KiB cumulative replay, also bounded by its
checkpoint size. Its complete-tree planner and tolerant cycle behavior are implementation
facts, not acceptance of arbitrary-size published trees. The replacement representation
must support paged materialization/sealing while preserving exact historical references.

Docks may keep full checkpoints for their bounded documents. Share infrastructure only
where revision meaning, disclosure and restoration rules actually agree.

## Search Feature

`@rezics/filter` defines both the engine-independent `UnitFilter` and Search Feature input: one
sparse `FilterDocument`, server-established contexts, provenance-bearing injections, and untrusted
interaction state. Full-text matching is the positive `UnitFilter.search` constraint; structured
domain selection is `UnitFilter.where`. The server owns one global capability ceiling and field
registry. A Filter document may narrow categories, add a fixed predicate, sparsely override
controls, and repeat Tag controls, but cannot introduce or widen fields, operators, sorts, facets,
page sizes, or result windows. `{}` adds no document-level condition or default.

A Zone persists its Filter document directly. Other surfaces use `{}` or an inline Filter document
plus allowed contexts and injections. Realm search uses `{}` with a fixed hidden Realm context; Tag
links inject refinements into the same input boundary. Contexts, document constraints, injections,
server fallbacks, and user state remain distinct by provenance and are composed by the compiler, so
browser state cannot replace a fixed context or injected predicate.

Quick filters, the advanced builder, and hidden-filter disclosure are renderer concerns over one
`SearchControlExpression` contract. “Advanced” names only the frontend editing experience; it never
selects a backend mode, changes field availability, or changes execution semantics. Controls retain
stable `controlKey` identity, including repeated Tag controls, through UI state, compilation, facet
results, and canonical input hashing. Search and Feed Blocks choose the global `{}`, the hosting
Zone document, or one inline sparse Filter document; Content Structure nodes never embed a query
schema.
A Feed Block adds presentation settings only and does not persist Feed-owned filter defaults.
Search owns execution controls, facets, relevance, and the Search Service adapter; it does not own
a second filtering language. A Search Feature may be presented through the Feed item renderer
without widening the general Feed API. The server has distinct Search and Feed sort policies,
including ordered options and empty-query/text-query fallbacks. Relevance is query-only and may
appear only in the Search policy. The Feed policy defaults to `best` with or without text and is
validated not to expose relevance.

The general Feed endpoint accepts the bounded domain Filter through `POST /feed/query`; its standard
UI projects content-kind, language, Realm, and Tag selection into that Filter. Its recommendation
sorts use `best` as the default and never expose Search relevance. Specialized surfaces retain
domain-specific selection without introducing another public filtering language. Review lists use
one Realm-addressed Score filter: Score values and their Realm ID are supplied together,
and selected values are ORed within that Realm. Review lists default to non-personalized `best`
ranking, use snapshot-bound cursors, and return every Score attached to each selected Review. Only
Review Feed items carry `scores`; other Post item variants do not expose an always-empty Score
field.

## PostgreSQL and PGroonga

The [current Search implementation](../../services/main/src/services/search/README.md)
transactionally maintains PGroonga projections and enforces bounded candidate work. The
[selected system read model](database/README.md#13-search-recommendation-export-and-derived-state)
also requires explicit source-version/freshness and published-composition context, with
current authorization independent of stale index membership. Any asynchronous replacement
must preserve read-your-writes outcomes, replay and safe counts/snippets.

Keep the [known failure evidence](../testing/known-failures.md) open until qualified repairs
or runtime changes explain the result. A schema refactor is not a search-engine stability fix.

## Tree and storage invariants

- Parent and child of a validated navigation tree belong to the same structure/manifest.
- Activation rejects missing parents, self-parenting and cycles under the tree profile.
- Semantic relation cycles are governed separately; tolerant readers terminate on damaged input.
- Occurrence identity differs from content identity and position; repeated targets remain representable.
- Active reads exclude soft-deleted data and apply current disclosure to the selected targets.
- Structure/manifest/parent/order/occurrence keys and target reverse indexes support bounded reads.
- Importing a structure copies explicit local uses, not independently owned bodies or privileges.

Explicit occurrence rows are the selected starting point. Closure indexes or shared immutable
subtrees are optional measured read/storage optimizations; they must not become a second
writable membership authority or an implicit family-expansion rule.
