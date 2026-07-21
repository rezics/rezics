# Content Structure and History

Status: accepted and being implemented on `codex/content-structure-history`.

## Decision

Content Structure is the shared ordered-tree capability for Unit-owned structures. Books, Posts,
Realms, and Zones bind one or more structures through a persisted container. A container has a
stable identity, an owning Unit, and a text `purpose`. Nodes have their own stable identity and may
reference any Unit unless the selected purpose applies a narrower content rule.

`purpose` is deliberately stored as PostgreSQL `text`, not as a PostgreSQL enum. The application
defines a discriminated union of supported purpose schemas and the database applies an equivalent
check constraint. Adding a purpose therefore requires an explicit schema, policy, migration, and
test instead of allowing an unvalidated string to acquire accidental semantics.

The initial purpose schemas are:

| Purpose            | Owner | Content rule                  | Target rule                   | Search scope | Progress        |
| ------------------ | ----- | ----------------------------- | ----------------------------- | ------------ | --------------- |
| `book.contents`    | Book  | chapter or chapter-group Post | content                       | yes          | node completion |
| `post.contents`    | Post  | any readable Unit             | content                       | yes          | none            |
| `realm.taxonomy`   | Realm | Label, Tag, or wiki Post      | content                       | no           | none            |
| `realm.navigation` | Realm | any readable Unit             | Unit or HTTPS URL             | no           | none            |
| `zone.navigation`  | Zone  | any readable Unit             | Unit, Zone page, or HTTPS URL | no           | none            |

The content Unit is the node's semantic/display payload. Navigation targets are separate, narrow,
typed fields; a navigation label can therefore be a Label, Tag, wiki Post, or another suitable Unit
without pretending that the label is necessarily the destination.

Navigation documents remain an API and Block presentation contract. Realm and Zone navigation are
persisted as Content Structures and projected to/from `NavigationDocument`; the former
`realm_navigation` and `zone_navigation` JSON stores are removed. Menu Blocks continue to refer to
the stable navigation structure UUID.

## Labels, Tags, and wiki Posts

A Label remains a lightweight Unit whose localized title is its content. It is useful for clean
group headings and navigation copy and avoids creating fake Tags or heavyweight Posts. Tags retain
their independent assignment, vote, and Realm-policy relations. Placing a Tag in
`realm.taxonomy` describes taxonomy presentation; it does not assign the Tag to another Unit.

A wiki Post can be a taxonomy node when a long-form explanation is useful. It does not replace the
Tag or Label identity. The Realm taxonomy purpose contract owns the future work for exposing wiki
descriptions; the generic tree node does not acquire Realm-specific fields.

## Tree invariants and ordering

- A node and its parent belong to the same structure and owner.
- A node cannot parent itself or one of its ancestors.
- Soft-deleted nodes do not participate in the live tree.
- Siblings use the existing case-sensitive fractional-position contract and are read with the
  stable `(position, id)` order.
- Mutations serialize through Unit History's transaction-level advisory lock. The service validates
  the expected component revision before changing live rows.
- Database foreign keys enforce ownership and parent scope. A constraint trigger is the final
  cycle guard for every writer, including workers and bootstrap code.

PostgreSQL documents recursive CTE path tracking and built-in cycle detection for hierarchical
data, and notes that explicit stable ordering is required rather than relying on traversal output:
[recursive queries and cycle detection](https://www.postgresql.org/docs/current/queries-with.html).
Transaction-level advisory locks are released automatically at transaction end and are suitable
for short application-defined critical sections:
[explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS).

## History is the only version service

Content Structure does not have an independent version number. Every edit creates (or participates
in) the owning Unit's revision. A component head maps `(unit, component role)` to the Unit revision
that most recently changed it. Clients use that Unit revision UUID as the optimistic-concurrency
token for the specific component, so an unrelated title edit does not make a structure edit stale.

History mutation coordination is a service-layer transaction protocol, not merely HTTP
middleware:

1. acquire the Unit History transaction lock;
2. compare every expected component head;
3. execute the domain mutation;
4. persist typed component changes and the Unit revision;
5. update global and component heads;
6. commit live state and History atomically.

HTTP adapters only validate and pass identity/context. The same coordinator is mandatory for
workers, bootstrap, and other non-HTTP writers.

History slot roles are text so a Unit revision can carry dynamic roles such as
`content-structure/<structure UUID>`. Fixed roles such as `main` and `localizations` remain
registered application contracts. An untouched slot inherits its content and origin revision from
the parent revision.

At the migration boundary, every live structure owned by a Unit with an existing History head is
materialized as a full checkpoint slot on that current revision. The migration also updates the
revision byte size and component head atomically. Consequently, historical reads and restores work
immediately after deployment, and the first later edit always has a real delta base.

This follows the production model described by MediaWiki Multi-Content Revisions: slots can change
independently or atomically, untouched slots inherit content, and content models own their diff
behavior. Its physical relationship is `revision <- slot -> content -> blob`, with the origin
revision retained per slot:
[MCR overview](https://www.mediawiki.org/wiki/Multi-Content_Revisions),
[MCR database schema](https://www.mediawiki.org/wiki/Multi-Content_Revisions/Database_Schema).

## Semantic deltas and checkpoints

The relational tables are the authoritative current state. History stores Content Structure
changes as a discriminated operation union keyed by stable structure and node IDs:

- structure create/delete;
- node insert/delete;
- node update, including parent, position, content Unit, rating, document key, or target changes.

Each update/delete operation records both `before` and `after` state where applicable. This makes
inverse operations and three-way undo deterministic and avoids treating an entire node array as one
JSON replacement. Unknown operation shapes are rejected at the History boundary before replay.

The first content object is a full checkpoint. Later content objects normally store a semantic
delta pointing to an immutable base content object. A new checkpoint is written when the replay
depth reaches the configured bound or when a single delta crosses the configured large-delta byte
threshold. Historical reads materialize the nearest checkpoint and replay at most the bounded
number of deltas. Restore creates a new revision; it never rewrites old history.

The schema migration attaches one full Content Structure checkpoint and dynamic slot to each
existing owner's current Unit revision, then accounts for those bytes in that revision. This is a
one-time migration of current state into History, not a second version system. It ensures the first
post-migration delta, a read of the migration-boundary revision, and a restore to that revision all
share the same materializable base.

Exact physical content objects remain content-addressed and immutable. Their hash covers the
encoding, base address, and payload, so an identical operation against a different base cannot be
mistaken for the same content. History APIs expose materialized logical content, not storage
encoding details.

## Projection rules

Only purpose schemas explicitly marked as search scope may project a content Unit into an owner's
search scope. Only `book.contents` nodes may participate in the current node-completion progress
model. Navigation and taxonomy occurrences must never affect search ownership or completion.

## Performance envelope

Live tree reads use the partial index
`(structure_id, parent_id, position, id) WHERE deleted_at IS NULL`; reverse lookups use
`(content_unit_id, structure_id) WHERE deleted_at IS NULL`. Ordinary inserts and moves write one
node plus a small History delta. Full-tree work occurs only for bounded historical materialization,
checkpoint creation, explicit replacement, or restore.

No closure table or materialized path is maintained initially. Navigation, taxonomy, and book
outlines are read mostly as complete bounded trees, for which an adjacency list avoids write
amplification. If measured workloads later require frequent ancestor/descendant queries over very
large structures, a derived projection may be added without changing the canonical model.
