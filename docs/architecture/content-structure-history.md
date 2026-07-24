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
use the ordinary Unit localization and Unit revision stream. Zone membership, hierarchy, ordering,
and the single home/root invariant belong to the Zone's singleton `zone.pages` Content Structure and
its independent revision head. A page mutation may update both aggregates in one database
transaction, but each optimistic-concurrency token and history stream retains its own meaning.

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

Hosted Book totals sum currently readable, published chapter occurrences by content language.
They remain explicitly separate from `book.word_count`, which is authoritative editorial catalog
metadata and may describe a Book whose text is not hosted by REZICS.

## Naming and identities

Behavior-selecting discriminants are named `kind`. Content Structure uses `kind`, Dock uses `kind`,
and Search exposes a result `category` plus its domain `kind`. Portable Text and Block `_type`
remain unchanged because `_type` is their serialized wire contract, not a database discriminator.

Content Structure, node, Dock, and Unit identities are UUIDv7. Navigation references a Zone Page
through the generic Unit target. The render projection adds its current Zone-scoped slug, so changing
the human-facing address does not invalidate the reference.

## Content Structure kinds

| Kind               | Owner | Content                       | Targets                | Progress        |
| ------------------ | ----- | ----------------------------- | ---------------------- | --------------- |
| `book.contents`    | Book  | chapter or chapter-group Post | content                | node completion |
| `post.contents`    | Post  | readable Unit                 | content                | none            |
| `realm.taxonomy`   | Realm | Label, Tag, or wiki Post      | content                | none            |
| `realm.navigation` | Realm | readable Unit                 | Unit, HTTPS URL, group | none            |
| `zone.navigation`  | Zone  | readable Unit                 | Unit, HTTPS URL, group | none            |
| `zone.pages`       | Zone  | `zone_page` Unit              | content                | none            |

Kinds are PostgreSQL `text` with a closed database check and a matching runtime discriminated
union. Adding a kind requires a policy, runtime schema, migration, and tests.

A Label is a localized display Unit. Content Structure nodes do not embed search configuration.
Tags remain independent Units and relations; putting a Tag in a taxonomy does not assign it to
other Units.

## Content Structure history

Every mutation acquires a transaction-scoped advisory lock for the Content Structure UUID and
compares `baseRevisionId` with `content_structure_revision_head` before committing live state and
history atomically. Create, update, delete, and restore are explicit revision kinds. Restore creates
a new checkpoint revision with a `sourceRevisionId`; immutable past revisions are never rewritten.

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

`@rezics/search` defines the engine-independent Search Feature input: one versioned SearchDocument,
server-established contexts, provenance-bearing injections, and untrusted interaction state. The
server owns four v1 templates—global, Book, Media, and Software—and the field registry. A document
may disable or arrange template capabilities and repeat Tag controls, but cannot introduce or widen
fields, operators, sorts, facets, page sizes, or result windows.

Only Zone management persists a custom SearchDocument in v1. Other surfaces use a system template
plus allowed contexts and injections. Realm search is the global template with a fixed hidden Realm
context; Tag links inject refinements into the same input boundary. Contexts, document constraints,
injections, defaults, and user state remain distinct by provenance and are composed by the compiler,
so browser state cannot replace a fixed context or injected predicate.

Normal and advanced modes and hidden-filter disclosure are renderer concerns over the same query
engine. Controls retain stable `controlKey` identity, including repeated Tag controls, through UI
state, compilation, facet results, and canonical input hashing. Search and Feed Blocks store only a
stable template-or-Zone Search Feature source; Content Structure nodes never embed a query schema.

## Meilisearch plus PostgreSQL

Meilisearch is the ranked full-text candidate generator. PostgreSQL is the authority for access,
relationships, current lifecycle state, and residual predicates:

1. compile safe push-down filters into Meilisearch so candidates remain a superset;
2. request bounded batches containing candidate UUID, rank, and projection revision;
3. join candidates to `search_unit_projection_source` and require the PostgreSQL revision to equal
   the indexed candidate revision;
4. apply authorization and relationship predicates in PostgreSQL;
5. preserve Meilisearch order with candidate ordinality;
6. use the same revision-checked candidate relation when PostgreSQL computes authorized facets;
7. continue bounded over-fetch rounds until the page fills, the index exhausts, or the scan budget
   is reached;
8. encode generation, request hash, page size, and per-category offsets in an opaque cursor.

Never send a large candidate list to PostgreSQL with an unordered `IN` clause, and never trust an
index hit as authorization. Meilisearch documents filter syntax and filterable attributes here:
[Meilisearch filters](https://www.meilisearch.com/docs/learn/filtering_and_sorting/filter_expression_reference).

## Tree and storage invariants

- Parent and child belong to the same structure and owner.
- A node cannot parent itself or an ancestor; service validation and a database constraint trigger
  both enforce this.
- Live sibling order is `(position, id)` using the fractional-position contract.
- Soft-deleted nodes and aggregates are excluded from active reads.
- Active tree reads use `(structure_id, parent_id, position, id) WHERE deleted_at IS NULL`;
  reverse content lookups use `(content_unit_id, structure_id) WHERE deleted_at IS NULL`.

Adjacency lists remain the canonical tree representation. Full bounded outlines are the dominant
read, so a closure table would add write amplification without current evidence. PostgreSQL's
recursive-query guidance covers stable ordering and cycle detection:
[PostgreSQL recursive queries](https://www.postgresql.org/docs/current/queries-with.html).
