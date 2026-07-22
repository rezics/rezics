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

A stable UUID is required for durable references, but it does not by itself make an entity an
aggregate root. Zone Pages keep stable UUIDv7 identities while participating in the Zone page-set
invariants for the single home page, route namespace, ordering, and cross-page reference checks.
They therefore remain Zone-owned page-set entities. If page editing later needs independent
concurrency or restore, that lifecycle boundary should move to a Zone Page or Zone Page Set revision
stream instead of adding a special Unit-history slot.

Content Structure and Dock still reference an owner Unit for authorization, discovery, and deletion
policy. Their immutable history payloads share the content-addressed `revision_content` store; they
do not share Unit revision slots or heads.

## Naming and identities

Behavior-selecting discriminants are named `kind`. Content Structure uses `kind`, Dock uses `kind`,
and Search exposes a result `category` plus its domain `kind`. Portable Text and Block `_type`
remain unchanged because `_type` is their serialized wire contract, not a database discriminator.

Content Structure, node, Dock, and Zone Page identities are UUIDv7. A Zone Page navigation target is
stored by UUID and projected through the API with its current Zone ID and slug, so changing a slug
does not invalidate the reference while the client can still navigate to the current route.

## Content Structure kinds

| Kind               | Owner | Content                       | Targets                           | Search labels | Progress        |
| ------------------ | ----- | ----------------------------- | --------------------------------- | ------------- | --------------- |
| `book.contents`    | Book  | chapter or chapter-group Post | content                           | no            | node completion |
| `post.contents`    | Post  | readable Unit                 | content                           | yes           | none            |
| `realm.taxonomy`   | Realm | Label, Tag, or wiki Post      | content                           | yes           | none            |
| `realm.navigation` | Realm | readable Unit                 | Unit, HTTPS URL, group            | no            | none            |
| `zone.navigation`  | Zone  | readable Unit                 | Unit, Zone Page, HTTPS URL, group | no            | none            |

Kinds are PostgreSQL `text` with a closed database check and a matching runtime discriminated
union. Adding a kind requires a policy, runtime schema, migration, and tests.

A Label is a localized display Unit. A searchable Label node may contain a trusted
`SearchConfiguration`; ordinary content nodes and navigation nodes may not. Tags remain independent
Units and relations. Putting a Tag in a taxonomy does not assign it to other Units.

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

## Search configuration

`@rezics/search` is the engine-independent contract shared by Search Blocks, Feed Blocks, and
searchable Content Structure Label nodes. It separates four concerns:

1. trusted scope, categories, invisible constraints, defaults, sorts, facets, and result limits;
2. a complete UI-control allow-list with component, mode, operator, option source, option policy,
   and optional localized Label Unit;
3. untrusted execution state from the browser;
4. a compiler that rejects fields, operators, modes, values, and sizes not permitted by the trusted
   configuration.

Tag filters support `any-of`, `all-of`, and `none-of`. `constraints` are server authority and cannot
be replaced by browser input. `defaults` are initial user-changeable values. `optionPolicy` only
controls which choices the UI may submit; it is not a result predicate.

The web Block renderer reads this schema directly. It renders the configured text input, selection,
multi-selection, boolean, date range, value range, operators, static options, and returned facets.
Search and Feed Blocks use the same execution endpoints and compiler; their presentation and
pagination policy remain Block concerns.

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
