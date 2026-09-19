# Catalog source lifecycle

The source owner registers exact external identities, stores immutable observations,
and records reversible correspondence with independently owned catalog objects.
Provider adapters write native domain structures. An archive or a generic JSON
tree is not evidence that a field has native semantics.

[Schema.org and Wikidata interoperability](semantic-interoperability.md) also
requires an immutable parsed source representation and rebuildable semantic
indexes before native adoption. Their external descriptions remain queryable
without creating native identities. Parsed/indexed completeness, native mapping
and publication have separate states; current source rank or an upstream redirect
cannot replace the adoption and authority protocols below.

The [system flow](database/README.md#21-system-flow-and-consistency) separates a
new observation, native adoption and publication of a selected version. A source
record can inform several native scopes; neither source class names nor IDs
establish automatic Work equality. Source updates do not overwrite independently
adopted community content or refresh every importing composition. The selected
[refresh protocol](database/content-composition.md#import-and-refresh-commands)
uses exact base/source/destination correspondence and current authority. These
cross-domain flows require qualification beyond the current bounded application
slices documented below.

[Fact verification](information-indexing-and-verification.md) consumes exact
observations and versioned correspondence to create independently attributable
assessments. Observation, assessment, policy selection and native application are
different transitions. New evidence can invalidate affected quality indexes before
replacement, but cannot bypass this owner's native writer, predecessor or
human-override fences. Verification scheduling is separate from commercial
Subscribe; payment never establishes source authority or factual support.

## Identity and authority

`source-record-key.ts` fixes the source identity protocol: SHA-256 over UTF-8
`source + LF + objectType + LF + externalId`, with the first 128 bits represented
as UUIDv8 (version and variant nibbles fixed to `8`). Source and object type have
strict ASCII token grammars excluding LF; the final external ID is exact,
nonempty, well-formed UTF-8 without NUL. It is not Unicode-normalized. The database
checks the derivation. Registration compares the original tuple after its
primary-key lookup and rejects a hash collision instead of aliasing two records.
The natural tuple and ID cannot change. All record lookups know the partition ID.

Mapping identity is `(source_record_id, mapping_key)`, with a unique scoped path.
Owner bindings use this composite key and concrete native foreign keys. A binding
revision stores exactly one checked owner target and its immutable policy state.
Pause, resume and rebind append revisions; rebind leaves adoption paused. Deferred
checks verify that the binding, revision and target agree at commit. A newly
referenced object can be initialized from its own endpoint only while its stored
baseline native revision still matches. Subsequent user edits require review.

The worker commits an acquisition generation before fetching. A completion must
match that generation and its check-plan revision. Late completion records a
superseded check receipt without moving the head. Changed observations publish an
outbox event; identical observations update check metadata. HTTP 404 or a missing
query row is an error, not a tombstone. The exact endpoint's HTTP 410 is handled
as authoritative disappearance. Tombstones preserve canonical objects.

Observation events admit source fan-out tasks through the operational task-intent
owner. Each task handles at most 32 mappings, atomically commits proposal work,
its fan-out cursor, the next task and its terminal receipt, then acknowledges the
broker. Transactions have 25-second total, 10-second statement and 5-second lock
budgets. Applying a proposal rechecks source, binding, policy and native revisions;
the provider's canonical command must advance the actual native revision. A
withdrawal callback is admitted only while that applied native revision remains
current. Whole-record structural update/compensation requires an actual native
command; the lifecycle does not manufacture one or treat a scalar update as full
structural reconciliation.

## Native application evidence

`source-proposals.ts` supplies the exact proposal, mapping, action and prior
observed snapshot to native writers. `loadCatalogSourceDocument` reopens a
committed snapshot with checked reference capabilities without starting another
observation or changing acquisition generations. This distinction is required
when deriving a change from the previous and proposed archived documents.

`catalog_source_application` records applied and compensating revisions. Native
music and software change tables reference concrete immutable component histories
through foreign keys, including removed components. Source bytes are not a native
change manifest. Deferred guards require the corresponding proposal decision and
a complete contiguous manifest; all evidence is immutable. Music history keys are
checked against the exact component, and readers require editor access to every
disclosed native owner even after source rebinding.

Native named-form, authority, semantic, software context and participation changes
now have their own concrete revision foreign keys. Source-to-native baseline
relations keep an indexed current compensation frontier backed by immutable source
occurrences and exact application rows. Repeated apply/withdraw cycles do not walk
the full history. Withdrawal restores the prior observed snapshot and, for a
previously referenced stub, its original composite evidence key. A source proposal
cannot be reopened after its terminal decision, and a decided application's
manifest cannot accept later rows.

The application command currently admits at most 128 component changes. This is
a bounded atomic proposal slice, not qualification of an arbitrarily large
source-record update. Larger owners require staged application and paged manifests;
that remaining gate must not be hidden by increasing an in-memory array limit.

Each growing source application or baseline family has 64 source-key hash partitions and
source-prefixed primary/foreign keys, following PostgreSQL's
[partitioned-key rules](https://www.postgresql.org/docs/18/ddl-partitioning.html).
At 256 bytes of estimated heap/key/index storage per application header and
400 bytes per change, 500M rows require 128 GB and 200 GB respectively; 3B require
768 GB and 1.2 TB, before replicas/WAL/reserve. Four changes per application
multiply child storage by four; history storage is additional and owned by the
native domain. These are capacity estimates, not measured allocations. Use the
existing 100 reads/s, 20 writes/s, 32-client workload with 5x bursts; a read makes
one routed header lookup plus bounded pages over the registered native families. Updates write
one header, N change rows and their FK/index work in the canonical transaction.
The deferred completeness check runs once per application header; child insertion
requires its still-pending decision and a position inside the declared manifest.
Its work is O(F + N) for F registered families and at most N=128 changes. Observe
lock time, statement duration, WAL bytes/application and source
skew; keep source and native-history shard references checked at any cutover.

Reproducible rollback SQL checks are `scripts/check-source-native-applications.ts`
and `scripts/check-catalog-source-lifecycle.ts`, with the existing explicit
loopback disposable database guard. They cover immutable application evidence,
missing native history, incomplete manifests, compensation and reopened older
snapshots without head regression. They do not establish full-provider update
coverage or production throughput.

## Source-family capacity and partitioning

Each immutable binding revision names a correspondence revision. Policy-only
pause/resume retains it; changing the native target or mapping protocol creates
a new self-anchored correspondence. Source child names, software components and
participation occurrences include this key so that reinterpreting the same
archived snapshot cannot return children allocated for an earlier target.
Application headers separately preserve the previous observed snapshot and its
applied correspondence. The mapper receives a previous native snapshot only
when it belongs to the current correspondence; withdrawal restores both original
observation pointers. The database checks contiguous revisions, self-anchored
meaning, concrete target keys and exact application history references.

`source.binding.changed` is consumed through an operational receipt and the
current subscription fence. It may propose the existing stored head when a new
mapping protocol needs review, without fabricating a source observation or
borrowing a creator account. Superseded revisions and inactive subscriptions
produce no proposal. Admission is constant work for one binding and one owner;
the 32-binding observation fan-out remains the separate path for new snapshots.
Two extra 8-byte epoch values add at least 8 GB at 500M claim rows or 48 GB at 3B,
before index and tuple overhead; the exact child epoch indexes add further cost.
These are storage estimates, not production capacity qualification. The disposable
SQL correspondence fixture covers four graphs from one snapshot across pause,
resume, rebind and protocol revision; lifecycle checks cover idempotent same-byte
refresh proposals with no impersonated account.

Source proposal dependencies are prepared in a separate human intake transaction.
The preparer must own the root's editing authority and may share only a published
public dependency or a draft they created. Each row holds the proposal snapshot,
an exact issued source-reference pointer, the dependency's immutable binding
revision and one of eight concrete owner foreign keys. Positions 0..127 impose a
database-enforced maximum of 128 dependencies per proposal. Admission never
accepts arbitrary raw pointers as evidence or expands a source grant to foreign
writes. A missing dependency requires another intake step before approval.

Within the exact approved proposal transaction and its tracked savepoints, native
read checks admit only these non-revoked dependencies whose current binding still
matches. Reads lock the dependency, binding and preparer account to serialize
revocation, rebinding and account closure. Outside that transaction, ordinary
catalog visibility/authority still applies; a source proposal cannot edit the
dependency. Erased preparers cannot continue sharing private drafts. Immutable
dependency evidence remains, with one-way revocation. Twenty-one disposable SQL
assertions cover actual private reads, foreign-write denial, savepoints, forged
targets, bounded positions, stale snapshots, withdrawal of read delegation and
changed binding fences. Indexed catalog queries consume the same validated read
scope as native target reads. A selected grant never gains the account's unrelated
creator rights, even when the service or human principal uses that same Auth ID.

At an estimated 600 bytes including its three indexes, this growing dependency
family needs approximately 300 GB for 500M rows or 1.8 TB for 3B, before replication,
WAL and bloat. With six dependencies per changed proposal, the source workload
below implies about 52 writes/s at 500M sources or 312 writes/s at 3B, with a 10x
burst budget. Source ID is a candidate same-database partition key; a previously
suggested 64-partition layout needs measured query/maintenance qualification;
single-proposal reads touch at most 128 rows, and reverse maintenance uses the
dependency-binding/preparer indexes. These estimates require representative WAL,
hot-source and p99 tests before production activation.

The minimum baseline is 500,000,000 rows **per growing family**, also estimated at
3,000,000,000. These are planning estimates, not measured production row sizes.
Typical source ID text is 36 bytes, path 64 bytes, payload reference 160 bytes;
indexes assume UUID keys with normal B-tree tuple overhead and no extreme bloat.

| Family | Approx. heap plus index bytes/row | 500M rows | 3B rows | Partition key |
| --- | ---: | ---: | ---: | --- |
| Source records | 232 | 116 GB | 696 GB | `id` |
| Snapshots | 536 | 268 GB | 1.61 TB | `source_record_id` |
| Mapping claims | 488 | 244 GB | 1.46 TB | `source_record_id` |
| Owner bindings | 136 | 68 GB | 408 GB | `source_record_id` |
| Binding revisions | 240 | 120 GB | 720 GB | `source_record_id` |
| Proposals | 448 | 224 GB | 1.34 TB | `source_record_id` |
| Subscriptions | 192 | 96 GB | 576 GB | `source_record_id` |
| Check plans | 216 | 108 GB | 648 GB | `routing_bucket` |
| Check receipts / fan-out cursors | 136 | 68 GB | 408 GB | `source_record_id` |

Choose same-database source-ID partitioning from measured query, maintenance and
retention costs. An illustrative 256 partitions average 11.7M rows each at 3B;
that arithmetic neither selects 256 nor proves acceptable skew or maintenance. All source-record operations use its
ID; mapping/proposal/history pages use composite keyset indexes. Due plans use a
DB-checked 0..1023 bucket in the primary key, allowing the scheduler's bucket
predicate to prune its partition and use `(bucket,state,next_check_at,record)`.
Interactive lookups and ordinary due-work polls do not scan the source corpus or
all target history. Bootstrap, reconciliation and explicit rebuilds still have
work proportional to their covered records; paging bounds memory, not total work.
Hot source fan-out is
serialized per record, with pages of 32; increasing concurrency for unrelated
sources does not increase a single target's authority.

At a daily semantic change fraction of 0.1% and 1.5 mappings per source, 500M
records produce approximately 750K target checks/day (8.7/s average); 3B produce
4.5M/day (52/s). Budget a 10x burst plus retries. Each changed snapshot writes a
snapshot, source head and outbox row; each fan-out page additionally writes its
task intent, cursor, outbox and receipt. Each proposal adds bounded secondary
index maintenance. Measure actual WAL, replication lag and p99 latency before
accepting a workload; do not infer throughput from these row-size calculations.
Operational capacity reservations reject admission when task/outbox/receipt
budgets are exhausted; operators must resolve lag before increasing admission.

Payloads are capped at 8 MB, fetched with a 20-second request deadline and a
25-second total I/O signal extending through S3 upload. Worker concurrency must
include JSON materialization overhead (often several times encoded bytes),
archive/network buffers and database memory; four simultaneous maximum-sized
objects can use several hundred MB. Keep the existing worker concurrency limit
and measure RSS before increasing it. Large dumps must stream bounded records.

Provider request admission is a separate, strictly bounded three-row PostgreSQL
control table. It coordinates all replicas and defaults to at least 1.1 seconds
between admissions per provider. MusicBrainz's public web service requires at
most one request per second. [MusicBrainz rate limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)
A 500M-record refresh at one request/second would take about 5,787 days, and 3B
about 34,722 days. Therefore direct API checks are bounded enrichment, not a
full-corpus refresh solution. Eligible bulk snapshots/replication and their
manifests are still needed for source-wide freshness. Private acquisition scopes
are not admitted to the current public shared-check plan.

PostgreSQL unique constraints on a partitioned relation must include its partition
key. The checked natural ID and composite mapping/check-plan keys satisfy that
requirement. [PostgreSQL partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)
Partition creation must run before `catalog-source-integrity.sql`; rerun its
constraint-trigger installation when adding leaves. Payload retention and rights
withdrawal must delete/restrict applicable archive copies separately while keeping
only permissible immutable audit metadata. Old revisions cannot be removed while
referenced by current bindings or review evidence.
