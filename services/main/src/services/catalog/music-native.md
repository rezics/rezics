# Native music delivery boundary

This owner represents musical works, recordings, release families, actual releases,
carrier occurrences, track occurrences, ordered credits and incomplete disc
candidates independently. A candidate is never automatically an issued release.
Source provenance and immutable payload access belong to the source owner.

## Verified semantics

The [MusicBrainz release contract](https://musicbrainz.org/doc/Release) distinguishes
release identity from its family and recording, supports unknown tracklists,
regional release dates, label/catalog-number associations, packaging, language and
script. The two sides of a vinyl record or cassette belong to one medium; hybrid
formats may have multiple logical media for one physical disc. The native model
does not infer physical piece count from medium count.

[Disc IDs](https://musicbrainz.org/doc/Disc_ID) are many-to-many pressing evidence,
not globally unique recording identifiers. Native TOCs retain offsets and leadout;
attachments require a complete ordered prefix of at most 99 offsets. The
[artist-credit contract](https://musicbrainz.org/doc/Artist_Credits) keeps each
credited spelling and join phrase together. Track and recording lengths are
independent.

The SQL-only candidate and alternative-presentation semantics are pinned to
MusicBrainz commit `cff977f0ba8f06d5fa594e7590f6a134b1a5a22c`,
[`CreateTables.sql`](https://raw.githubusercontent.com/metabrainz/musicbrainz-server/cff977f0ba8f06d5fa594e7590f6a134b1a5a22c/admin/sql/CreateTables.sql).
Relationship direction and endpoint-specific credit spellings were checked against
its [JSON relationship serializer](https://raw.githubusercontent.com/metabrainz/musicbrainz-server/cff977f0ba8f06d5fa594e7590f6a134b1a5a22c/lib/MusicBrainz/Server/WebService/Serializer/JSON/2/Relationship.pm).

## Native access and changes

`music-domain.ts` supplies release/work/family metadata, media pages, labels, dates,
TOCs and alternative release/medium/track presentations. `domains.ts` retains the
existing source-free identity/credit/track commands and `readMusicTracks`.
`music-medium-attributes.ts` supplies reviewed immutable attribute policies,
allowed format/value pairs and paged carrier assertions. It validates applicability
again when the medium format changes. Only a trusted maintenance caller installs
policies; ordinary catalog authoring accepts already installed definition revisions.

`music-candidates.ts` owns source-free incomplete disc candidates, candidate track
pages and attached TOCs. `music-history.ts` reads exact native component row
revisions and restores release metadata as a new revision. Native history is
editor-only because old rows can reference private targets. The SQL history
trigger derives snapshots from native table rows, never from arbitrary source JSON.

`musicbrainz-adoption.ts`, `musicbrainz-object-adoption.ts` and
`musicbrainz-relations.ts` project core endpoint fields and governed relationships.
`musicbrainz-dump-candidates.ts` admits one bounded joined `release_raw` candidate
document with its `track_raw` and `cdtoc_raw` rows. It is not a general SQL dump
loader and does not claim that joining or scheduling the entire upstream dump is
implemented. Unchanged sources reuse identity; changed adopted records enter
review. A pristine referenced identity can accept its first own endpoint using
the shared initialization fence.

## Workload and growth assumptions

Capacity planning uses 500 million and 3 billion rows **per growing relation**, not
just per release. Working assumptions are 1,000 metadata/page reads per second,
100 catalog mutations per second across distinct owners, 1–20 media per ordinary
release, 1–100 ordinary tracks per medium, 0–32 ordinary carrier assertions, and a
skewed tail of large compilations. These rates are planning inputs, not benchmark
results. Interactive page targets are 100 ms database time and 300 ms service time
at the stated read mix; import transactions have independent bounded admission.

Pages contain at most 100 rows, CD detail at most 99 offsets, credit append batches
at most 128 members, and source documents at most 8 MB. A source document is not
loaded alongside a corpus-wide map. Policy configuration is explicitly bounded to
512 formats/value-format pairs per immutable policy. Corpus assertion count is
not capped at 100. Format compatibility uses an indexed anti-join with a one-row
conflict result; an extreme hot medium can still require work proportional to its
own assertions and needs a staged transition if statement timeouts recur.

At 80–200 bytes per ordinary structural row including its primary index, 500M rows
require approximately 40–100 GB and 3B require 240–600 GB, before reverse indexes,
replicas, WAL and free space. A revision body averaging 400 bytes plus 160 bytes
heap/key/index overhead costs about 280 GB at 500M revisions and 1.68 TB at 3B.
Five historical revisions per component multiply those history estimates by five.
Long names can dominate the mean and must be measured against the actual corpus.
Three synchronous copies triple retained storage; WAL and backup retention are
additional. History cannot be safely discarded as if it were a disposable cache.

At approximately 100 B-tree entries per 8 KiB page, both planning scales need
roughly five traversal levels. Request queries use owner/release prefixes and
keyset predicates, with cost O(log N + page size). A native update writes one
component row, its relevant indexes, one exact history row, and owner revision /
change metadata. A TOC admission writes at most 99 offset rows plus header and
attachment. No recurring whole-corpus recomputation is introduced.

Different owner IDs provide the partition/shard boundary for structural data and
history. A hot release serializes through its owner revision lock; increasing worker
concurrency cannot remove that contention. Use bounded import-worker concurrency,
queue admission and transaction timeouts; monitor owner lock wait p95, history/WAL
bytes per mutation, page latency, index growth and import retry rate. Partition
history and structural families by owner hash before a single node reaches storage
or maintenance limits. Cross-owner recording/credit references require routing and
referential-integrity work before physical separation; the present single-database
FK model does not claim distributed transactions or production throughput approval.

## Acceptance and remaining work

Focused checks cover parser semantics, native command contracts and SQL fixtures.
`check-music-domain.ts`, `check-musicbrainz-adoption.ts` and
`check-music-native-history.ts` target an explicitly selected isolated PostgreSQL
database and roll back their catalog rows. Their presence does not imply execution;
report actual fixture execution separately after the complete SQL overlays exist.

The full MusicBrainz source-schema gate remains open. In particular, this batch
does not complete SQL dump streaming/join orchestration, SQL alternative-tracklist
and medium-attribute adoption, identifier redirect adoption, cover/event-art
metadata, source taxonomy installation/hierarchy, complete alias metadata adoption,
or full reviewed release structural-update/reorder/withdraw/restore transitions.
Native source history and a metadata restore command do not qualify all structural
restoration. Supporting endpoint integration, source-free/cross-provider conformance,
representative skewed SQL plans and sustained load tests remain coordinated gates.
