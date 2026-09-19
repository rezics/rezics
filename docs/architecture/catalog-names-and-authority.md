# Named forms, identifier claims and scoped authority

The [integrated value/model contract](schema-modeling.md#shared-value-contracts)
extends this target across every Resource owner, including currently closed
metadata-localization paths. Content languages are independent of UI locales;
the selected target is not the old seven-value enum. Retain explicit base direction
where supplied, exact original spelling and derivation from a specific name revision.
Unicode normalization, translation/transliteration, display fallback and search
comparison are separate operations. Report the actual selected language and fallback
reason; no fallback creates a stored translation. Slug lookup uses its separately
versioned [address namespace policy](unit-slug-addressing.md#assignment-contract).

Named forms keep an owner-local immutable identity, a current complete projection and
immutable complete revision rows. Each edit advances only that form's revision;
withdrawal and restoration append state revisions. Credits and source observations
can reference `(owner_id, id, revision)` exactly. Two identical spellings, two names
in one language, and duplicate identifier assignments do not merge identities.

Content language uses the pinned IANA parser. Script/region specificity and scoped
private-use namespaces survive canonicalization. Unknown/unprovided language remains
null; language detection, likely subtags and source trust do not establish original
language or authorization. Name origin, translation method, alias lifetime, sorting,
source primary-for-locale preference and spoiler level are independent values.

An authority assertion targets an exact name revision and retains a named authorizer,
role, territory, channel, context, validity interval, source evidence and review
evidence. A source-reported official claim with no known authorizer stays a source
claim. Verified assertions require both evidence and runtime write authority over
the authorizing Entity. A changed name does not inherit an older approval; revoking
or re-reviewing an assertion preserves its history. Display selection is separate.

Identifier normalization is a versioned namespace policy. ISRC validates syntax;
ISBN and GTIN validate check digits; MusicBrainz identifiers validate UUID syntax.
Unknown namespaces preserve exact spelling and explicitly remain unvalidated.
These checks establish code syntax, not correct assignment. The nonunique lookup
index deliberately retains collisions, with visible candidates keyset-paginated.

Source-local aliases bind a source record, namespace and local key to a named-form
identity. Immutable snapshot occurrences pin the actual form revision and source
path. Repeated identical observations are idempotent; reusing a key for another
identity or changing evidence inside one snapshot is a conflict.

## Capacity and workload

The planning baseline is 500 million rows per corpus relation and a 3 billion-row
estimate, independently for current forms, revisions, identifiers, authority and
source occurrences. Assume eight forms per ordinary owner, a long tail of 100,000
aliases, five retained revisions per form, 95% owner-local list/history reads and
5% exact namespace lookups; ingest bursts reach 2,000 edits/s with 200 concurrent
writers. Read targets are p95 below 100 ms for bounded pages, a deployment target
requiring measurement rather than a claim from unit fixtures.

Requests touch one owner/form prefix, one exact source key, or one identifier
namespace/value prefix. Pages are at most 100 rows; text is capped at 128 KiB per
name and ordinary names are assumed 160 bytes. Each edit writes one head and one
history row, updating only that head's indexes. It does not copy all names, fan out
to credits, refresh authority rows or scan source snapshots. Concurrent writes to
one name serialize; independent form edits share the owner authorization lock and
do not increment its global revision. Creation currently uses the owner revision
guard, so exceptionally hot owners must batch and backpressure create commands.

At an assumed 480 bytes per ordinary name revision plus 80 bytes of primary/index
overhead, 500M revisions occupy approximately 280 GB before free space/WAL/replicas;
3B occupy 1.68 TB. Current-name indexes add approximately 120 bytes/row (60 GB or
360 GB); a worst-case 512-byte identifier key plus tuple overhead approaches
720 bytes/row (360 GB or 2.16 TB). These are sizing estimates, not measured storage
or throughput. Large text is TOASTed and exact-name text is not in B-tree keys.
At 2,000 edits/s and ~2 KB logical head/history/index writes, logical write volume
is about 4 MB/s before WAL, checkpoint and replication amplification. Provision
and observe actual WAL bytes/transaction, replica lag, page latency and lock waits.

Physical ownership is the routing boundary: partition histories by owner hash and
route owner reads to a single partition/shard; preserve owner in all foreign keys.
Identifier lookup can route by namespace/value hash with a bounded claim directory
when owners move to multiple shards. No whole-corpus in-memory map or deep offset
is required. Split a shard before measured working indexes exceed its cache/storage
budget or p95 latency exceeds target; backpressure ingest when replica lag exceeds
the operational budget. Evidence retention never requires revision rewriting.

## Evidence and deterministic checks

Primary references: [MusicBrainz aliases](https://musicbrainz.org/doc/Aliases),
[alias style](https://musicbrainz.org/doc/Style/Aliases),
[MusicBrainz identifiers](https://musicbrainz.org/doc/MusicBrainz_Identifier), and
[W3C language tags](https://www.w3.org/International/articles/language-tags/index.en.html).
These establish alias locale/sort/lifetime distinctions and language-tag scope;
the native revision/authority protocol is REZICS policy rather than a copied source
table.

`names.test.ts` exercises language precision, private-use identity, source claims,
stale/scoped authority, dates and identifier normalization. The isolated
`check-catalog-names.ts` fixture verifies edit/withdraw/restore history, SQL mutation
rejection, collisions, source alias keys, evidence and authorizer permissions. It
requires the disposable migration fixture flag and an isolated loopback
`rezics_atlas*` database, and rolls back its data. Fresh target DDL installation and
that SQL fixture are separate from parser/unit evidence.
