# Explicit native consumption languages

Implementation reference. This owner documents current code, identifiers and local
limits. The [selected target](../../../../../docs/architecture/content-language-support.md) and [implementation crosswalk](../../../../../docs/reference/current-implementation.md)
define the reconciliation boundary; existing fixtures do not qualify revised semantics.

Publishing, Music, Program and Software resources declare consumption languages
through the `catalog.content_consumption_languages` property. This is a separate
editorial statement from source-record language observations, named-form language,
original language, edition metadata and package localization. No source adapter
writes this statement automatically and no Main/Variant relationship is inferred.

One internally derived, owner-separated semantic identity addresses the field.
The first fact may initialize only an absent semantic head at version zero; a
previously withdrawn head cannot be reinitialized. Subsequent writes require the
exact owner revision and semantic-head version. Restore copies a reviewed earlier
value into a new immutable fact/revision and preserves intervening history. The
current native semantic head is authoritative; `unit_content_language_support`
and its existing reverse search table are written in the same transaction.
Reads fail closed if that projection diverges from the journal.

The property grammar is an array of languageTag/optional-channels objects.
Existing BCP 47 registry validation, canonical ordering and channel normalization
apply. Empty means no language assertion and performs no implicit inheritance.
History list reads expose only bounded revision metadata; one selected history
value is decoded separately. The API never accepts a semantic identity from the
client. Audio and Video retain their concrete owner authorization/history paths.

Evidence is limited to a serialization's TextVersion, a Program season/version's
Program, an Episode's Program/Season, a Music release's release group, or a
Software version's content identity. These are actual stored direct links, at most
two candidates, filtered through native private/read/rating policy. Empty candidate
statements are omitted. Multi-child coverage/occurrence lanes are not inferred or
materialized by this endpoint.

## Capacity

The field has at most 64 entries and four channels per entry: at most 449 value
nodes, one current semantic pointer, one current JSON projection and 64 reverse
index rows per edit. Typical two-language/two-channel input uses 11 value nodes.
The three begin/append/seal owner revisions and immutable history are explicit
write amplification; semantic and owner CAS bound concurrency on a hot resource.

At 500M resources with one such typical declaration, the shared native value-node
relations contain about 5.5B nodes; at 3B resources, about 33B. At an illustrative
100 bytes per node this is 550GB / 3.3TB of heap before indexes, history and WAL;
actual row and index overhead must be measured, not extrapolated from a small
fixture. The existing owner-partitioned catalog fact storage remains the capacity
and sharding boundary. Request work is bounded to one owner PK/head seek and at
most 449 indexed nodes regardless of corpus size. History uses semantic-version
keyset pagination (maximum 100 metadata rows) and never loads all prior values.
This packet establishes bounded request work and schema reuse, not throughput or
physical capacity qualification for the full corpus.
