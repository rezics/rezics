# Native content structure boundary

`book.contents` belongs to a Publishing TextVersion. Its explicit occurrences may
reference another TextVersion, a Post whose kind is `chapter`, or a Label. Nested
TextVersion references do not import the other structure or its progress.
`media.contents` belongs to the Program owner; Program, Audio, Video and Label
occurrences remain separate from native Program episode/version relationship
records. `page-structure` requires Post kind `page` and the exact ZonePage owner.
The persisted structure kind strings remain semantic identifiers.

The HTTP authoring paths are `/publishing/text-versions/:unitId/content-structure`
and `/program/:unitId/content-structure`; append `/nodes` for their projection.
Create an initially missing TextVersion structure through the typed generic
`/units/by-id/:unitId/content-structures` command with `kind: book.contents`.
The returned revision is the first draft precondition. Program drafts can also
initialize through their existing `uninitialized` precondition. Native writes
prove account participation against the concrete catalog owner inside the write
transaction, and retain the independent Content Structure CAS/history.

Chapter, Label, Audio and Video creation inserts one complete concrete owner row.
A native catalog's participation does not imply ownership of a newly authored
Chapter: absent an explicit Chapter ownership choice, new Chapters are owned by
the acting profile. Editing another Post/Label title requires that child's own
localization permission. Native named forms are edited through the native name
commands, not as a side effect of moving an occurrence.

Public projections remove unreadable content/target identities and detach a
visible node from a hidden parent node. A complete draft cannot edit an existing
child that its actor can no longer read. Names for native children use the owner's
active, unscoped, spoiler-free preview index and preserve the exact language tag;
no synthetic Book/Media subtype or Unit localization is written.

## Capacity contract

A complete tree/checkpoint contains at most 2,048 live nodes, enforced by input,
snapshot reads and post-mutation validation. Oversized trees fail instead of
returning a truncated hierarchy. A content identity can have at most 64 live
placements across structures; deleted nodes and deleted structures do not count.
The canonical SQL guard owns that cross-structure bound, including restoration.

At either 500 million or 3 billion corpus rows, each tree read seeks one owner
structure and at most 2,049 indexed node candidates. Owner metadata is resolved
through those explicit IDs; up to 2,048 native name preview seeks return one label
of at most 500 characters each (at most 4 MiB UTF-8 label data). Private read
checks use batches of at most 500 IDs. No query scans all owner tables or the
corpus. History replay retains its existing 32-delta/256 KiB checkpoint policy.

The 64 reverse-placement bound limits a content change's direct fan-out. Existing
counter maintenance can still recompute up to 2,048 nodes for each affected tree;
bulk writes can therefore multiply that work. This packet proves boundedness and
integrity, not corpus throughput. Deferred per-owner dirty queues and revision-
bound lazy child pagination are future optimization work, with the current hard
limits remaining in force until that replacement is qualified.
