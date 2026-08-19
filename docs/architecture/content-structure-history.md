# Content Structure, Dock, History, and Search

Status: accepted.

## Aggregate boundary

History follows aggregate lifecycle, concurrency, and restore boundaries. Ownership alone does not
make one resource part of another resource's revision:

- Unit keeps its existing revision stream.
- Content Structure is a UUIDv7 aggregate with its own revision head. Its nodes are children of that
  aggregate because they cannot be edited, restored, or authorized independently.
- Dock is a UUIDv7 aggregate with its own revision head.
- Unit restore and undo never restore Content Structures or Docks. A cross-resource workflow may
  correlate revisions, but it cannot reuse another aggregate's concurrency token.

A Zone Page is a `zone_page` Unit, not a separate aggregate. Its localized title and Block document
use the ordinary Unit localization and Unit revision stream. The `zone_page` ownership relation
proves Zone membership independently of addressing and presentation. A Zone-scoped canonical slug
is optional; the exact slug `home` assigns the homepage role. The singleton `page-structure` is an
optional visual index for hierarchy and ordering. A valid Zone Page does not need to be indexed by
it. Page, address, and placement mutations therefore remain separate operations with separate
proofs; the Content Structure retains its own optimistic-concurrency token and history stream.

Content Structure and Dock still reference an owner Unit for authorization, discovery, and deletion
policy. Their immutable history payloads share the content-addressed `revision_content` store; they
do not share Unit revision slots or heads.

## Unit history storage

A Unit revision is a complete logical checkpoint represented by an immutable manifest. The manifest
does not duplicate every byte: each entry points to a content-addressed document in
`revision_content`, so unchanged documents are shared across revisions.

Fixed Unit state uses one slot each with identities `(main, "")`, `(relations, "")`,
`(structure, "")`, and, when present, `(rules, "")`. Localized state uses one slot per language with
identity `(localization, ContentLanguage)`. Each localization slot contains the complete typed state
for that language, including its position. The primary key and database check enforce this role/key
relationship, and runtime parsing additionally requires the payload's language to equal the slot
key.

Every revision writes the exact current manifest:

- unchanged slots reuse both their content ID and origin revision;
- a changed language creates or reuses only that language's content document;
- an added language adds one manifest entry;
- a deleted language is absent from the new manifest;
- an identical manifest is a no-op and does not create a revision.

Restore, compare, and undo first reconstruct a storage-independent Unit value. Localization
conflicts are consequently keyed by stable language paths such as `/localizations/en/title`, rather
than by array index or storage wrapper. Restores write the complete checkpoint back to live rows,
ordered by fractional position and then language.

Unit History deliberately does not persist generic JSON deltas. JSON Patch is an ordered program
against a particular base document, so using it as the durable Unit format would add replay,
inversion, and missing-base failure modes without meaningful savings after language-level
content-addressing. This manifest-plus-document model follows the same useful separation as Git
trees and blobs: the revision records a complete view while unchanged content remains shared.
[Git documents its content-addressed tree model](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects.html);
[RFC 6902 defines JSON Patch's sequential base-dependent operations](https://www.rfc-editor.org/rfc/rfc6902.html).

`unit_revision.byte_size` is the sum of the materialized documents referenced by that revision. It
is a logical snapshot size, not the newly allocated physical bytes for the edit. The latter may be
zero for an already-known content hash and must not be inferred from adjacent revisions'
`byte_size` values.

### Unit revision contribution provenance

Each revision records one primary semantic contribution kind: `human`, `ai`, or `unattributed`.
The accountable Profile remains `unit_revision.actor_profile_id`; it is authorization and audit
identity, not evidence that the Profile personally produced the content. Human and AI declarations
therefore require an accountable actor, while workflows that omit a declaration are stored as
unattributed.

AI-specific credit is an immutable optional one-to-one child row in
`unit_revision_credit_attribution`. The revision row keeps only the discriminator; the child stores
the credited published `software_agent` Entity, contribution role, and server-derived assurance.
The API reconstructs and returns one discriminated `primaryContribution` value with every revision
summary. Storage normalization is not exposed as a second client request.

History lists use UUIDv7 keyset pagination capped at 100 revisions. Their outer join probes the
credit table by its `revision_id` primary key only for the bounded page; it never scans attribution
to enumerate revision history. The `(credited_entity_id, revision_id)` index supports foreign-key
maintenance and any future Entity-scoped audit read without a corpus scan. Attribution remains
public provenance when the accountable actor is hidden: actor visibility protects the human
account identity, not the separately credited public software-agent Entity.

Capacity planning treats `unit_revision` as a 500,000,000-row baseline and 3,000,000,000-row
estimate. At a planning AI-credit density of 1%, the child contains 5,000,000 and 30,000,000 rows;
the 10% stress case contains 50,000,000 and 300,000,000 rows. Each revision creates at most one
child insert in the same transaction, and every history response performs at most 100 primary-key
lookups. A hot credited Entity can own millions of rows, so Entity-scoped reads must use keyset
pagination and bounded batches. Monitor child/index bytes, write amplification, WAL, cache hit rate,
and hot-key latency. If the 10% case exceeds a single node's index or maintenance window, cut over
by UUIDv7 time ranges so history pages prune old partitions; cross-partition Entity audit reads must
remain bounded by their cursor and may be routed to archival replicas.

### Unit revision visibility

Unit revision visibility preserves the immutable revision and its audit trail while restricting
selected historical data. The API exposes a discriminated state rather than independently writable
booleans:

- `visible` protects no revision fields;
- `hidden` protects one or more of the content, edit summary, and actor fields from ordinary
  readers, while `platform.moderate` can inspect them;
- `suppressed` protects one or more of those fields from ordinary moderators, while only
  `platform.suppress` can inspect them.

A restricted state must name at least one protected field. Entering or leaving suppression requires
`platform.suppress`; all other visibility changes require `platform.moderate`. The current revision
content cannot be hidden because the live Unit would still publish the same content. An operator
must first publish or restore a clean revision and then restrict the older revision.

History lists retain a visible placeholder so chronology and parent relationships remain auditable.
Unauthorized detail reads omit the protected content and its slot structure; compare, restore, and
undo treat protected content as unavailable. Suppressed revisions are removed from the revision
search index, and selectively hidden fields are excluded from otherwise indexable revision
documents. Every visibility mutation uses the Unit history lock and appends its reason and before
and after visibility states to the platform audit log in the same transaction.

## Localized content metrics

Word and character counts are rebuildable projections of current localized Portable Text, not
authored Unit state. `unit_localization_content_metric` is therefore keyed to a current
`(unit_id, language)` localization and excluded from Unit revision documents. Recording any Unit
revision synchronizes the projection in the same transaction; restore first replaces semantic
localization state and then measures it with the current algorithm.

The projection stores locale-aware word-like segments, non-whitespace Unicode grapheme clusters,
an algorithm version, and a canonical source-document hash. Text spans and visible image captions
participate. Marks, links, accessibility alt text, and unknown custom blocks do not. A client may
use the shared pure measuring function for immediate editor feedback, but the server never accepts
client-supplied counts.

Hosted Book totals sum current Chapter occurrences by content language.
They remain explicitly separate from `book.word_count`, which is authoritative editorial
metadata and may describe a Book whose text is not hosted by REZICS.
When a Book Unit is itself one occurrence in `book.contents`, that occurrence uses the referenced
Book's `book.word_count` as its direct word weight. It never recursively reads or sums the
referenced Book's Content Structure.

## Naming and identities

Behavior-selecting discriminants are named `kind`. Content Structure uses `kind`, Dock uses `kind`,
and Search exposes a result `category` plus its domain `kind`. Portable Text and Block `_type`
remain unchanged because `_type` is their serialized wire contract, not a database discriminator.

Content Structure, node, Dock, and Unit identities are UUIDv7. Navigation references a Zone Page
through the generic Unit target. The render projection adds its current Zone-scoped slug, so changing
the human-facing address does not invalidate the reference.

## Content Structure kinds

| Kind              | Owner | Content                            | Targets                  | Progress                        |
| ----------------- | ----- | ---------------------------------- | ------------------------ | ------------------------------- |
| `book.contents`   | Book  | Book, chapter Post, or Label Unit  | content                  | explicit Chapter completion     |
| `media.contents`  | Media | Media, Video, Audio, or Label Unit | content                  | explicit Video/Audio completion |
| `post.contents`   | Post  | Unit                               | content                  | none                            |
| `realm.taxonomy`  | Realm | Label, Tag, or wiki Post           | content                  | none                            |
| `wiki.navigation` | Realm | Label or mounted Wiki Post         | mounted Wiki Post, group | none                            |
| `zone.navigation` | Zone  | Unit                               | Unit, HTTPS URL, group   | none                            |
| `page-structure`  | Zone  | owned `zone_page` Unit             | content                  | none                            |

Within `book.contents`, a Label is always a structural display entry. Book outlines ignore any
body that its localization may have in another context. A Chapter is a structural entry whose body
is optional: its title and previous/next navigation remain available without Portable Text. A Book
occurrence is one ordinary leaf: selecting it opens that Book's canonical Unit detail and does not
project its nodes into the source Reader. `media.contents` applies the same rule to Media
occurrences. No source parameter, return link, or inferred container relationship is carried to the
target Unit. Editors allow Book/Label and Media/Label occurrences to receive explicit local
children. That authoring convention is a frontend rule rather than a backend hierarchy constraint.

Opening a Book or Media occurrence performs navigation only. It writes neither the source owner's
progress nor the target Unit's progress. Book and Label occurrences are progress-neutral; only
explicit Chapter occurrences in the current structure contribute to Book progress. A Chapter
placed beneath a Book or Label contributes normally, but the referenced Book's own structure is
never traversed or inherited. Media, Video, Audio, and Label follow the symmetric rule: only
explicit Video and Audio occurrences contribute. Completion remains occurrence-local by node ID;
the graph does not imply ownership, containment, edition, or anthology semantics.

## Chapter identity, Reader context, and takedown

A Chapter is an independently authorized Post Unit. `GET /api/v1/posts/:chapterId` resolves its
own Unit lifecycle, visibility, moderation, grants, restrictions, localization, attribution, and
reply thread. It does not require access to a parent Book. Draft localization content is returned
only to a caller who can update that Chapter's localizations; standalone Chapter access remains
governed by the Chapter Unit itself.

A Reader page is a contextual occurrence, not a second Chapter identity. It is addressed by
`GET /api/v1/books/:bookId/content-nodes/:nodeId` and
`/units/book/:bookId/read/:nodeId`. The request proves these contextual facts:

1. the caller may access the Book; and
2. the active node belongs to that Book's `book.contents` structure, targets a non-deleted,
   moderation-approved Chapter, and remains part of the current structure.

Inclusion in an accessible Content Structure publishes that occurrence's structural projection in
that container. The Reader does not recalculate the target Chapter's standalone Unit authorization.
It presents a published Chapter body, or a draft preview to a Chapter editor, unless the Book has
`metadata_only = true`; in that mode it still presents the occurrence title, navigation, progress,
and discussion context while omitting the body. This setting never deletes Chapter content and does
not affect the standalone Chapter endpoint.

Previous and next destinations are content node IDs because the same Chapter may occur more than
once or in more than one Book. Book outlines and Reader links use node IDs; feeds, search results,
collections, reply roots, and standalone shares use the Chapter Post ID. A Reader failure never
falls back to standalone Post rendering, and standalone Post rendering never guesses a Book
context. This removes authorization-dependent redirects and ambiguous multi-Book selection.
Book occurrences in an outline link directly to the target Book and are excluded from Reader
previous/next chapter ordering.

Changing a Book to draft therefore takes down the Reader context but does not implicitly mutate
independent Chapters. The management UI requires an explicit choice between the Book alone and the
Book plus manageable published Chapters. The latter creates a durable
`book_chapter_draft_job` in the same database transaction as the Book lifecycle change, so the
choice cannot be partially committed. An exact-version command endpoint also supports an already
draft Book. A worker walks occurrences that existed and were not rewritten after the captured
request boundary with `(structure_id, node_id)` keyset pagination, processes at most 25 occurrences
per transaction, re-evaluates
`unit.status.update` for every distinct Chapter batch, and records ordinary immutable Unit status
events. A later Book lifecycle transition cancels an outstanding job. Failed leases are reclaimed;
retries are bounded and observable in the job row.

The public API cutover is intentionally breaking at the v1 baseline: the removed
`GET /api/v1/chapters/:chapterId` lookup selected an arbitrary Book occurrence and coupled Chapter
content visibility to Book edit permission. Clients must use the standalone Post endpoint for a
Chapter identity or provide both Book and content node identity for Reader context. Existing Reader
URLs that put a Chapter ID in the final segment must be regenerated from the Book outline's node
IDs; there is no safe redirect when a Chapter has multiple occurrences.

### Workload and capacity

Capacity planning treats `content_structure_node` as a 500-million-row relation and also evaluates
3 billion rows. With a planning distribution of 100 active nodes per Book, those corpus sizes
represent roughly 5 million and 30 million Book structures. Exact Reader resolution starts from the
node primary key and verifies Book ownership, structure membership, and global target safety without
a corpus scan.
Book-scoped outlines and depth-first neighbor calculation read one structure through its leading
structure index; their work is `O(nodes_in_book)`, not `O(corpus)`. Track the per-Book node-count
distribution, response bytes, query latency, and sort memory. Large Book outlines remain one
structure-scoped response; any future pagination or materialized traversal is a separate network
contract decision based on measured payload and latency, not part of the authorization model.

Book-to-Book and Media-to-Media writes perform no direct or indirect cycle query. Target validation
is one Unit lookup plus the ordinary indexed structure write, so its database work does not grow
with a reachable cross-Unit graph at the 500-million-row baseline or 3-billion-row estimate. Book
and Media authoring pickers hide the owner Unit as a low-cost UI convenience only; this is not
validation or a persisted acyclicity invariant.

Parent and cross-Unit cycles are valid persisted input. Every in-process hierarchy walk is
iterative, maintains a visited node-ID set, and visits each node in the loaded local structure at
most once. Disconnected and cyclic nodes remain visible without following a referenced Unit into
another structure. Consequently a deep chain or cycle cannot cause recursion overflow, infinite
traversal, recursive content expansion, or work proportional to a reachable cross-Unit graph.

Chapter takedown work is independent of Book size on every transaction: two jobs are claimed at a
time and each advances at most 25 occurrences. One batch performs one indexed node window read, one
batched authorization read, and at most 25 lifecycle transitions, providing natural backpressure
through the worker loop. Repeated Chapter occurrences are idempotent because only a currently
published Chapter transitions. At an illustrative monthly takedown rate of 1% of Books, the job
relation receives about 50,000 rows per month at the 500-million-node baseline and 300,000 at the
3-billion-node estimate.

The partial `(structure_id, id)` B-tree adds one entry per active node. At approximately 48–64 bytes
per entry before fill-factor and bloat, raw index storage is about 24–32 GB for 500 million active
nodes and 144–192 GB for 3 billion. It is created concurrently so migration does not block node
writes. Monitor index size, WAL volume, replica lag, dead tuples, hot Book keys, worker lease age,
retry count, and pending-job age. Before the 3-billion-row estimate approaches a single-node storage
limit, partition nodes and jobs by a stable hash of the owning Book/structure so the keyset index,
worker claim queue, and Reader reads remain independently scalable.

Kinds are PostgreSQL `text` with a closed database check and a matching runtime discriminated
union. Adding a kind requires a policy, runtime schema, migration, and tests.

`page-structure` is deliberately not an ownership registry, page inventory, homepage selector, or
routing authority. Its nodes only describe an optional visual hierarchy. Multiple root nodes and
an empty or absent structure are valid.

A Label is a localized display Unit. Content Structure nodes do not embed search configuration.
Tags remain independent Units and relations; putting a Tag in a taxonomy does not assign it to
other Units.

## Content Structure history

Every mutation acquires a transaction-scoped advisory lock for the Content Structure UUID and
compares `baseRevisionId` with `content_structure_revision_head` before committing live state and
history atomically. Create, update, delete, and restore are explicit revision kinds. Restore creates
a new checkpoint revision with a `sourceRevisionId`; immutable past revisions are never rewritten.

Content Structure edits use an ordered, atomic command batch as the primary mutation model. A
batch contains at most 10,000 logical entries in `changes`; this limit does not constrain the total
tree size, the number of nodes referenced by a command, or the number of rows changed when applying
it. For example, a swap is one command and deleting a subtree is one command regardless of the
number of descendants. The planner applies the commands to the current snapshot in memory and
validates parent existence and sibling placement before any live row is written. It deliberately
preserves parent cycles. Invalid batches have no partial effects and a successful batch creates at
most one revision.

The single-node endpoints and Navigation document replacement are compatibility adapters over that
planner. Complete Book, Media, and Realm taxonomy drafts compile their semantic differences into
the same logical-command accounting: one changed desired member per command plus one command per
omitted subtree root. Consequently, a complete representation may contain more than 10,000 nodes
when its compiled change set remains within the batch limit. There is no independent aggregate-size
cap.

Collection Structure membership follows the same revision lock, base-revision check, plan-first,
and single-commit lifecycle with its own add, remove, move, and swap commands. Collection reads use
revision-bound cursor pagination. Content Structure reads currently return a complete tree because
flat pagination would not prove parent/child completeness; a future lazy-tree API must use
revision-bound child pagination keyed by `(structureId, parentId, position, id)`.

Current relational rows are authoritative. History stores semantic operations keyed by stable IDs:

- node insert, update, and delete;
- structure update and delete;
- both before and after values where inversion or conflict analysis needs them.

The first revision and every restore are full checkpoints. An ordinary delta becomes a checkpoint
when any limit is reached:

- delta depth: 32;
- one delta: 64 KiB;
- cumulative replay since checkpoint: 256 KiB;
- cumulative replay reaches the preceding checkpoint's serialized size.

This makes the common edit cheap while bounding both replay work and pathological deltas. Replay
byte size and checkpoint byte size are stored on each revision, so choosing a checkpoint does not
require materializing the entire tree on every edit. Exact content is immutable and content
addressed; a delta hash includes its base identity.

Dock documents are lower-frequency whole documents and use full checkpoints for every revision.
This keeps Dock restore simple and avoids a generic JSON-diff format with weak domain semantics.
Dock mutations acquire locks in one order—owner Block graph, Dock history, then live row—and restore
revalidates cross-resource Block references before publishing the historical document.

PostgreSQL advisory locks are transaction scoped and released automatically at transaction end:
[PostgreSQL advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS).

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

Current localization text is indexed in its authoritative PostgreSQL table. A validated Search
and Filter AST compiles to one bounded SQL query that combines PGroonga text predicates with
lifecycle, relationship, and viewer-authorization conditions. Stable sort values plus Unit ID
form the keyset boundary, and one deterministic localization card is selected per Unit. The index
contains all current localizations; an index hit is never an authorization grant.

## Tree and storage invariants

- Parent and child belong to the same structure and owner.
- No acyclicity or self-parent invariant is persisted or validated.
- Authoring UIs may hide obviously undesirable choices such as adding the owner Unit to its own
  structure. That filter is only a convenience; all readers remain correct when cycles exist.
- Live sibling order is `(position, id)` using the fractional-position contract.
- Soft-deleted nodes and aggregates are excluded from active reads.
- Active tree reads use `(structure_id, parent_id, position, id) WHERE deleted_at IS NULL`;
  reverse content lookups use `(content_unit_id, structure_id) WHERE deleted_at IS NULL`.

Adjacency lists remain the canonical hierarchy representation. Full bounded outlines are the
dominant read, so a closure table would add write amplification without current evidence. Runtime
consumers must use explicit visited sets rather than treating the adjacency relation as a tree.
