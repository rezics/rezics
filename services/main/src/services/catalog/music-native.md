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

Music components now have an explicit current-head pointer and a monotonically
incremented component sequence. History pagination resolves its opaque revision
cursor to that sequence; source journals compare component sequences rather than
UUID timestamp order. Capture alone can advance heads or append history. The
replacement target starts these heads at component creation; there is no runtime
fallback that guesses old native current state from historical UUIDs. Composite
identifier key tokens escape `~` and `/`, avoiding namespace/value collisions.

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

`musicbrainz-release-delta.ts` and `musicbrainz-object-delta.ts` apply archived
release/work/recording/release-group changes through native writers, and compensate
exact journaled heads. Names and scalar assertions use their own native histories.
Original immutable source occurrences remain unchanged across reapplication;
indexed source baselines point at the currently compensated native revision.
Newly added media/tracks can be removed and reapplied with the same native identity.
The ordinary atomic mapper admits 128 affected structural/name/semantic entries;
larger scopes require staged activation and remain an explicit unfinished gate.

`musicbrainz-alternatives.ts` admits a bounded joined SQL alternative release,
medium and tracklist on an already evidenced physical release. Shared alternate
track rows stay shared and are immutable; editing their presentation replaces the
occurrence's value reference. This does not manufacture recordings. Alternative
source update registration and SQL dump streaming remain separate work.

MusicBrainz ISO language codes are converted by `musicbrainz-language.ts` using
the generated 204-entry map from 7,923 pinned iso-codes records. The source commit,
SHA-256, copyright and LGPL license accompany the artifact; the generator checks
the full input digest. Every output still passes the native IANA-backed BCP47
validator. In particular, `hbs`, `tgl` and `twi` retain `sh`, `tl` and `tw` rather
than locale-preference substitutions. This fixes actual `jpn`/`eng` adoption.

The source delta fixture passed on the isolated DB53 target before the explicit
head/sequence overlay: duplicate events/labels, release edits, new medium/track
identity across three repeat apply/compensate cycles, protected human corrections,
changed/new names and text assertions, independent object updates, work languages,
release-group types, and a shared SQL alternate track value. The new head/sequence
DDL requires coordinated generated-migration replay and repeated SQL verification.
Backend and script TypeScript checks and 80 focused music tests passed. Unit tests
that import archive modules need the ordinary test environment variables; the
fixture archive itself is in memory and no image binaries are fetched.

`music-structure.ts` now supports complete checked row edits, collision-safe
reorder, dependency-ordered removal and restoration for release headers, media,
tracks, labels, regional events, presentation occurrences, TOC attachments and
medium/track identifiers. Batches admit at most 128 rows; exact history IDs fence
every child, including writes that did not increment the aggregate revision.
Compensation reverses only the recorded before/after heads. Its savepoint rolls
back intermediate reorder rows and history if any check fails. Immutable source
occurrence support links each archived path to its actual native history row,
so duplicate label/event rows remain distinguishable.

The source-occurrence relation has a source/snapshot/owner/component/path primary
index and owner/history reverse index. Assuming 300–700 bytes per occurrence with
both indexes, 500M entries occupy approximately 150–350 GB and 3B approximately
0.9–2.1 TB before replicas/WAL. Each observation adds one row and two indexes;
queries are snapshot/component prefix pages of 128, O(log N + page size), with
no recurring corpus scan. Reorder maximum-position probes use the release/medium
position indexes rather than scanning the release's complete track lifetime.
The existing owner hash partition/shard and history retention requirements apply.

Current component heads cost approximately 200–400 bytes each including their
primary index: 100–200 GB at 500M components and 0.6–1.2 TB at 3B, before replicas,
WAL and free space. A native row mutation adds one exact history row and advances
one head under the same transaction; it does not scan earlier revisions. The
component sequence replaces the history timestamp-order lookup index. Reads use
the head primary key or the owner/component/key/sequence unique index. Large key
tokens have a 1,536-byte bound; source occurrence compound index width stays below
PostgreSQL's B-tree tuple limit at that bound. Monitor write amplification and hot
owner lock waits under the existing owner-hash partition and shard cutover plan.

`check-music-structure.ts` passed against the isolated PostgreSQL fixture on
2026-09-07: track swaps and compensation, exact child conflict after an independent
human correction, dependency rejection, complete rollback and remove/restore.
All fixture rows rolled back. Source-occurrence DDL acceptance still requires
the coordinated generated batch; these observations do not certify source coverage.

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

### Exact source interpretation foundation (2026-09-07, SQL qualification pending)

Names, music components, Entity/Reference profiles and generic numeric source
baselines now retain a source mapping key and immutable correspondence epoch.
Reusing identical bytes after rebinding does not reinterpret an older occurrence.
Ordinary writers use the checked current epoch; journal publication uses the
proposal's exact expected binding revision. This does not enable cross-owner
reclassification; that remains a separately reviewed workflow.

Generic evidence support remains distinct from adoption correspondence. An
explicitly curated wiki value, page relation or standalone evidence claim may
have a null correspondence pair. Automatic mappers use
`catalogSourceSupportColumns`, and delta/baseline lookups require the exact pair.
Neither a half-pair nor unbound curated support qualifies as an automatic mapper's
original interpretation. Source support rows are immutable except for one-way
evidence withdrawal. Identifier support also pins the exact immutable identifier
claim revision, rather than whichever value the identifier currently holds.

Identifier changes use eight concrete owner journal tables and the existing
owner baseline family; they never masquerade as named forms or semantic facts.
An application remains bounded to 128 changes. Its fixed owner/family journal
reads add eight indexed probes; no corpus scan or history-chain traversal is
introduced. The complete journal read path needs measured latency qualification
before claiming an interactive service-level target.

Capacity assumptions for these additions: at most 128 native changes per source
transaction; provider requests keep the shared rate budget; an offline admission
target of 100 source records/second is a workload hypothesis, not measured
throughput. At its worst 128 changes/record, admission would demand 12,800 native
journal writes/second and must be limited by the existing capacity reservations,
bounded queues and connection budgets. Stable unchanged identifiers do not create
new claim revisions. Source distributions must include popular shared artists,
terms, repeated snapshot bytes and long-lived owners with many epochs.

Estimate an identifier journal entry at 160–280 bytes including its primary
index: 80–140 GB at 500 million entries, 0.48–0.84 TB at 3 billion, before WAL,
replicas and free space. A mapped support row adds approximately 24–32 bytes of
epoch/revision columns and an estimated 80–144-byte correspondence index entry:
52–88 GB incremental storage at 500 million supports and 312–528 GB at 3 billion.
Actual row/index sizes and representative skewed plans remain to be measured.
Existing snapshot audit indexes are retained alongside epoch-selective indexes.
Each update adds immutable history and one exact baseline advance; memory is
bounded by one admitted application. Source-record partition routing and archival
cutover apply to journal/support history; neither relation is a bounded registry.

Existing referenced source records and governed term concepts use shared locks;
new correspondence creation remains exclusive. This avoids serializing all
imports on an already-known popular taxonomy term, while a concurrent rebind
still waits. Deadlock/retry behavior across independently owned references and
maintenance costs at the stated cardinalities require the coordinated load test.

Definition terms are optional links from exact class/vocabulary revisions to
native Reference concepts. Labels and their histories belong to the concept;
constraints remain validation policy. MusicBrainz's reviewed SQL taxonomy fields
include UUID identity, name, parent, child order and description; the upstream
schema is pinned in the source inventory. Inline names now have a native query
path. Full SQL taxonomy hierarchy installation and native source callback
qualification are not established by this foundation checkpoint.

Artist-credit fragments retain independent identity and may be reused. Their
optional immutable `created_for_music_id` records a creation context for scoped
construction, rather than granting access through the account's creator ID.
Beginning, appending and sealing such a fragment require current write authority
over that context; standalone creation requires direct creator authority.
Published reuse and actual readable native referencers govern later reads.
The context lookup is one music-identity primary-key probe, and the context/id
index supports bounded draft pages. Estimate 16 bytes of row data and 48–80 bytes
of index storage per contextual fragment: 32–48 GB at 500 million fragments,
192–288 GB at 3 billion, before replicas/WAL. Source admission still caps one
credit batch at 128 members and 512 KB; larger credits use bounded append batches.

On 2026-09-08, `check-music-credit-access.ts` passed 14 rollback-only PostgreSQL
checks on the isolated DB59 target: selected grants cannot use account creator
rights for unrelated drafts or sealed credits; contextual creation/append/seal
requires the root's write authority; native readers expose a referenced credit
while hiding an unreadable recording; an authorized public native referencer
exposes its sealed credit; creation contexts are immutable and cannot target a
retired identity. These are SQL authorization checks, not UI acceptance.
Native component writes gather at most 128 credit identities and 256 explicitly
named history rows. Current reference proofs use owner/component/key head probes;
no credit-to-whole-catalog reverse scan or unrestricted history search is used.

`musicbrainz-dependencies.ts` now plans at most 128 distinct root references from
one checked release/work/recording/release-group document. A direct human intake
transaction materializes the referenced artists, recordings, families, labels,
areas and vocabulary concepts, then prepares exact pending-proposal read grants.
The archive owner verifies bytes, receipt, source identity and snapshot before
planning. Proposal callbacks resolve those dependencies read-only, including
definition-to-concept links; they never initialize foreign catalog owners or attach
taxonomy concepts under the root proposal grant. Intake failures roll back the
whole bounded preparation transaction. Existing private dependencies can be shared
only by their direct creator under the common dependency policy.

On 2026-09-08 the DB59 delta fixture passed with title/alias changes enabled,
new artist and recording dependencies, rejection before dependency preparation,
then native application and repeated compensation. The fixture invokes the
offline `createMusicBrainzNativeWriter` factory over exact preloaded snapshot IDs
and archive receipts. It covers release/work/recording/release-group updates;
supporting endpoint update dispatch and null-before correspondence refresh still
fail explicitly pending their persisted interpretation writers. Initial referenced
release-group materialization retains the existing minimal native family header;
it is not full inline family metadata adoption. The test does not establish those
remaining semantics or production capacity.

Dependency preparation holds at most one 8 MB source document and 128 distinct
root reference descriptors. It makes one indexed correspondence/identity lookup
per dependency and one exact proposal-dependency insert, with no corpus scan.
Nested recording credits remain bounded by the source document/credit batch
limits and can materialize their own evidenced artist references during direct
intake. Very large nested documents need staged admission before operational
activation. The existing source correspondence, owner partition and 500M/3B
storage/routing estimates apply; representative skewed load remains unqualified.

ISRC, ISWC and ASIN adoption now uses the shared identifier normalization policy
and records the exact native claim revision at its archived source path. Their
native update writer adds, withdraws and reapplies claims with exact journal
compensation, preserving unrelated or independently supported claims. DB59 SQL
qualification on 2026-09-08 covers changed ISRC/ISWC active values and restoration
of the originals across two apply/withdraw cycles, plus ASIN addition across the
release fixture's repeated cycles. Identifier lists admit at most 128 combined
before/after occurrences; native identifiers remain many-valued and are never
treated as automatic identity merge instructions. Identifier redirect adoption
and larger staged applications remain separate coverage.

### Pure source interpretations (next coordinated migration pending)

`music_component_source_occurrence.source_value` stores the checked full native
interpretation separately from the exact native history pointer. The source
writer validates component shape/keys when recording and reading it, preserves
that value across replay, and reuses archived credit fragments rather than
minting another identity for the same interpretation. PostgreSQL validates the
known native composite type, required and primary-key fields and native check
constraints. The existing immutable evidence trigger and exact history FK remain.

Entity/Reference profile occurrences likewise carry a pure `source_profile` and
explicit `observed_fields`. Unobserved native defaults never become source-owned
nulls. Profile binders compare immutable source interpretations rather than the
merged native snapshot; the history pointer may therefore retain independent
human fields. Read boundaries reparse the owner profile shape and field scope.
MusicBrainz derives scope from present endpoint fields; VNDB staff captures only
its observed gender field. This is the prerequisite for safe mapper refresh;
the null-before MusicBrainz factory is still explicitly unqualified.

These columns add no corpus index or scan. A 400-byte mean music interpretation
adds approximately 200 GB at 500M occurrences or 1.2 TB at 3B, before TOAST,
replicas/WAL and free space. A profile interpretation plus field scope averaging
600 bytes adds approximately 300 GB or 1.8 TB respectively. Source-write guards
inspect the bounded native component's system-catalog metadata and constraints,
not catalog rows; measure this additional admission cost and cache/compile the
bounded validation plan if it exceeds the ingest budget. The existing owner/source
partition and retention plan applies. Runtime contract tests pass; SQL acceptance
requires the centrally generated migration and rerun of rollback-only fixtures.

### Supporting native updates and relation bundles (2026-09-08)

The offline factory now dispatches artist, label, area, place, event, instrument,
series, genre, mood and URL updates. Fixed profiles use explicit source field
scopes and retain independent human values; names, text assertions, IPI/ISNI/label
codes and governed relationships use their native revision owners. Relationship
updates preserve direction and endpoint credit spellings, and apply/compensate
their private qualifier facts as an exact bundle. Initial adoption now records
qualifier source support as well as the relation's support. Reapplication resolves
the relation's current baseline from its previous occurrence when the same
semantic identity spans both source snapshots.

`check-music-supporting-updates.ts` passed 176 tracked assertions across ten
supporting object kinds (including SQL-only mood) and two apply/withdraw cycles, including changed relationship
credits and dates, and an independently authored artist field retained in native
history but absent from pure source ownership. `check-catalog-profile-source.ts`
passed 30 checks across Entity/Reference and three cycles. The names-enabled
release/object delta fixture also passed with changed relation qualifiers.
These tests installed the reviewed interpretation columns/guards inside each
fixture transaction and rolled back both DDL and rows. They qualify owner logic,
not generated migration replay. Ordinary source admission and profile parser
tests remain separate deterministic checks.

The [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API) makes inclusion
selection explicit, so an omitted profile field never silently clears an earlier
observation. The [PostgreSQL JSON conversion rules](https://www.postgresql.org/docs/current/functions-json.html)
ignore unknown keys and can coerce scalar types; the music SQL guard therefore
checks the exact key set and normalized typed result separately.

Changed area-code sets, series classification and native reclassification still
fail explicitly pending their exact native journals. Null-before mapper refresh,
taxonomy hierarchy installation, CAA/EAA artwork metadata, redirect persistence,
SQL dump orchestration and full source counter dispositions remain unqualified.
The machine-readable mapping inventory retains those gaps and `qualified: false`.

The 176-check supporting fixture also passes against the actual centrally migrated
DB61 target without any fixture DDL. On that target, the names-enabled core source
fixture passes with an independent native script-code edit preserved while the
source changes the barcode, including subsequent compensation. Music component
merging compares pure old/new interpretations field by field against the current
native row, retaining unchanged native fields and rejecting actual conflicts.
Existing references may be preserved without reading their targets; changing or
restoring a reference still requires its proper authorization. The credit fixture
passes 17 checks, including scoped editing around a hidden recording reference and
rejection of a new hidden target. Initial work/recording/family source headers now
record independently compiled source values instead of inherited native fields.

One additional live-head primary-key probe per admitted component supports the
merge; the operation stays bounded by 128 components. This improves preservation
of human fields but does not yet implement the null-before whole-mapper refresh.

The supporting factory now accepts a null-before archive for a separately prepared
new target. It checks the immutable prior binding, refuses to treat a same-target
mapper replacement as an empty owner, and neither reads nor mutates the former
target's native rows. New source profile fields fill only absent values or agree
with current values; conflicting curated fields require review. Curated names
remain separate, and source facts, identifiers and relations have exact repeatable
initial-application compensation. Series classification and nonempty area-code
initialization still require their native journals and fail explicitly.

The actual DB61 supporting fixture now passes 284 tracked checks: the original ten
supporting-object update cases, plus nine new-target rebind cases, each applied and
withdrawn twice. It verifies unchanged former-target revisions and preservation
of curated new-target names. Paused rebinding is explicitly reviewed and resumed
before application. This qualifies new-target initialization for the exercised
semantics; same-target mapper refresh remains open.
