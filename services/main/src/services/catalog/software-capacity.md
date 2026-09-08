# Native software catalog workload and delivery boundary

The native owner distinguishes content, evidenced versions, releases, contextual
staff groupings, and release occurrences. A VNDB local `eid` cannot identify a
version. Native release queries are anchored to one readable content identity;
language, machine translation, platform and medium predicates correlate to the
same release. Date/territory occurrences and patch applicability remain separate.

Commands admit 128 components or 512 KiB per batch, one scalar record at up to
1 MiB, and return at most 100 occurrences with keyset pagination. Source documents
are bounded to 8 MB before parsing; complete corpus acquisition must stream records
and pause rather than enlarge these limits. Five animation contexts are a proven
per-release bound. Definition registries are bounded control data.

## Capacity assumptions

Plan for 500 million occurrence rows and a 3 billion row estimate independently
of the smaller release population. At a planning allowance of 160 bytes per hot
row plus 160 bytes of primary/reverse index entries, live occurrence storage is
160 GB / 960 GB before replicas, WAL and free-space reserve. Two immutable history
rows per live row averaging 512 bytes add 512 GB / 3.072 TB; long translated titles
can increase this substantially and are capped by byte budget. A 3x allocation
for replicas and 30% operational reserve yields approximately 2.62 TB / 15.73 TB.
These are explicit planning estimates, not measured production allocations.

Assume a read-heavy workload of 1,000 requests/s, 100 native mutations/s, hot
objects up to one million occurrences and a 100-row response at approximately
64 KiB. Read egress is approximately 64 MB/s before protocol overhead. One mutation
writes current data, a catalog change/revision and immutable history, so sustained
ingestion needs WAL and history capacity in addition to current-row throughput.
Each lookup seeks its owner prefix and an ID/revision cursor; reverse navigation
uses content/release or vocabulary/release indexes. No corpus scan or transitive
closure occurs on this request path. Actor visibility checks occur in SQL before
release pagination. Historical snapshots are restricted to the owner to avoid
revealing formerly private references.

Owner revision updates serialize writes to one release. At 10 ms/transaction a
single hot release cannot exceed approximately 100 serialized mutations/s; batch
ingestion, bounded worker concurrency and backpressure are required. If observed
lock wait p95 exceeds 100 ms or pending batches exceed the bounded scheduler
capacity, pause that owner and repartition workload. Owner-key routing can shard
current occurrences and their history together. The shared schema exporter owns
physical partition creation; this slice does not claim a 500M-row single-node
deployment, latency qualification, or demonstrated history maintenance throughput.

## Verified and unfinished scope

Deterministic contracts cover native version evidence, release carriers and
languages, partial dates, resolution and animation distinctions, source vocabulary
mapping, taxonomy/media/link semantic plans and dump row normalization. The
software-native PostgreSQL harness verifies identity/version ownership, correlated
filters, stale writes, immutable snapshots and scalar restoration on the integrated
disposable target. Its execution must be reported separately from unit tests.

The current slice now has native occurrence put/withdraw/restore, exact staff alias
and context joins, title/romanization derivation and scoped title claims, and a
real release source-update/compensation writer. Three apply/withdraw/reapply cycles
exercise changed and added release components, producer/link semantic deltas and
preservation of independent native catalog/channel metadata. Alias/participation
and software SQL fixtures remain separate evidence. User-reported playtime is a
qualified estimate with sample count and estimator, not a fixed intrinsic duration.

Unfinished scope remains explicit in `source-contracts/vndb-native-mapping.json`:
Complete remaining public dump
assembly, API/dump source-surface transitions and centrally staged applications
above the ordinary 128-change budget. A source-surface transition is rejected
until a reviewed combined projection can retain unobserved fields safely. Native
SQL fixtures do not establish full provider coverage, product integration or
production throughput. No full VNDB/plan completion claim is made.

## Exact participation workload

`software_participation` is a provider-independent content-local role identity.
Its revisions reference the exact Entity named form and participation-context
revision, with an optional Character on the same row for voice credits. A null
context means no separately evidenced context; VNDB voice rows do not invent one.
Supporting staff aliases must be adopted before a VN credit can bind their `aid`.
The import fails with an explicit dependency when that exact alias is unavailable.

The three growing families are participation identities, complete revisions and
source occurrences. Assume two revisions and one source occurrence per live role.
At 80 bytes per identity including its key, 400 bytes per revision including
actor/character reverse indexes, and 240 bytes per source occurrence including its
reverse index, 500M live roles require about 560 GB and 3B about 3.36 TB before
replication, WAL and free space. Three copies with 30% reserve require about
2.18 TB / 13.10 TB. These planning allowances exclude long notes; notes admit at
most 16 KiB and must be included in measured capacity before production admission.

Current and history pages seek `(content_id, participation_id, revision)` and
return at most 100 rows. Visibility checks on actor and character are correlated
indexed SQL predicates before pagination, without per-result identity queries.
Each edit locks one participation head, appends one complete revision and advances
that head; it does not copy or scan other credits or a million-credit content.
Source files remain limited to 8 MB and 4,096 staff plus 4,096 voice rows per
assembled record. Larger source owners require separately admitted occurrence
batches rather than increasing transaction size. Source import caches repeated
actors/aliases and governed role definitions within the admitted record.

Routing by content ID keeps heads/history together under the software owner's
partition/shard cutover. At a 10 ms child transaction, one hot credit can sustain
at most roughly 100 serial updates/s; distinct credits share the content authority
lock. Pause ingestion when lock-wait p95 exceeds 100 ms or the shared source task
budget fills. Local deterministic/SQL fixtures prove integrity and bounded query
shape, not production throughput, physical shard capacity or 500M-row timings.


The VN update fixture now runs three complete apply/withdraw/reapply cycles with
38 assertions, including actual native playtime qualifier reads and exact source
claims on restored title forms. It tests a reused `eid` with a new language,
an unchanged group renumbered to another `eid`, a retained local heading,
multiple voiced characters and a credit edit made after proposal creation. The
last edit is rejected atomically while preserving unrelated prior data. VN source
credit observations are read once per admitted snapshot and inserted in batches
of 128; no per-credit source-occurrence read loop scans an owner's lifetime.

Source child correspondence uses an explicit root epoch. Policy-only revisions
retain the epoch; a changed native root or mapping protocol starts another epoch.
Name bindings and occurrences include the mapping UUID and epoch in their keys;
context occurrences include the same checked immutable-root reference. The epoch
is read through the current claim and exact binding-revision primary key, never
by walking binding history. Cross-owner referenced names remain attributable to
the containing source root, while keeping their concrete native name foreign key.

Planning allowance: the mapping UUID plus 64-bit epoch adds 24 raw bytes per row,
or 12 GB at 500M occurrences and 72 GB at 3B. Counting the heap and two affected
index entries budgets at least 72 extra bytes per name occurrence (36 GB / 216 GB)
before page slack, replication and WAL. Bindings have another affected unique
index; allow at least 96 bytes each (48 GB / 288 GB). These are incremental lower
bounds, not measured PostgreSQL sizes. Native rebinds create new child identities
and evidence rows proportional to that admitted source record; historical rows
are never rewritten. The existing 128-change transaction admission remains the
upper bound on ordinary update fan-out. Peak reviewed-write targets remain
unqualified until the combined source worker benchmark measures the changed
index footprint, lock waits and WAL on representative skew. Root-source routing
keeps epoch reads local to each partition and permits source-record sharding
without a global historical scan.

Protocol refresh also stores the typed scalar mapper output before merging human
values. It is an immutable interpretation under the root epoch, with a separate
exact native-history FK; it is not a raw source document or an extensible fact
bag. Canonical content/release schemas validate every value on write and read;
SQL checks shape, required/allowed keys, broad JSON types and a 2 MiB ceiling.
Assuming 2 KiB average interpreted scalar data, 500M occurrence rows add about
1.024 TB and 3B add 6.144 TB before indexes/TOAST overhead. At three copies and
30% reserve the payload allowance is about 3.99 TB / 23.96 TB. This explicit
average must be replaced by measured source distributions before admission;
the allowed worst-case description is much larger and cannot use this estimate.

A same-target refresh reads at most 128 prior names, contexts, credits and
semantic supports per query, and rejects when their combined unique output
count exceeds 128. Native heads and compensation baselines are read in batches;
each actual mutation retains its canonical exact-revision and authority check.
Work is proportional to one admitted source record, independent of corpus size.
The source task capacity/lease remains the concurrency and backpressure owner.
Refresh qualification must include repeated protocol changes while retaining
human overrides; graph separation alone does not prove replacement semantics.

## Assembled staff and producer public dump packets

The staff/producer initializer and native update callback now consume bounded
assembled dump packets. Main and alternate staff aliases are checked against the
same parent and main alias key; producer relations preserve direction. External
link IDs join only packet-local rows and use the pinned `ExtLinks.pm` formatter
contract in `source-contracts/vndb-dump-link-formats.json`. Names, semantic values,
profile gender and links retain pointers into the original archived packet.

The pinned public dump omits private `staff.stype`, whose upstream vocabulary
includes groups, companies and repositories. Dump staff therefore starts as an
unresolved Entity; an existing independently classified Entity keeps its shape.
The separately reviewed Kana API describes staff identities as persons and
retains that classification. `staff.prod` is a linked producer profile relation,
without merging the two identities or inferring that they are the same entity.
Source status/deletion/redirect reconciliation is still an acquisition obligation.

Packets admit 1,024 staff aliases and 1,024 producer relations; external link joins
are bounded to 512 rows. A hash join costs O(A + R + L) time and space for one
admitted record, never an in-process whole-corpus map. The existing 8 MB byte and
128 ordinary native-change limits still apply; larger outputs require central
staging. Existing occurrence/history estimates above cover persisted growth at
500M/3B rows. No higher ingestion throughput or larger transaction admission is
implied by these record-local bounds.

DB59 `check-vndb-supporting-updates.ts` passed 211 rollback assertions across ten
source-surface/family cases, three apply/withdraw/reapply cycles each. This includes
native staff/producer dump links, directed subsidiary relationships, restored
names and descriptions, unresolved staff identity, and preserved independent staff
begin dates. Six scoped test files passed 32 tests and the backend TypeScript
check passed. Character/VN/release remaining dump joins, API/dump observation-scope
transitions and full provider coverage remain open.

## Character dump joins

The character initializer and update callback now consume `chars`, `chars_names`,
`chars_alias`, `chars_traits`, `chars_vns` and its selected image row. All localized
names retain their language; aliases retain spoiler levels and exact romanization
derivation. The source's private cached language does not invent a primary name
language. Unknown measurements and inherited apparent/actual sex/gender follow
the pinned `lib/VNWeb/API.pm` projection, with pointers to the actual contributing
dump columns. Instance relations and VN/release appearances retain their scope,
role, spoiler and occurrence multiplicity.

The packet caps names at 128, aliases at 1,024, traits and appearance rows at 4,096
each, and image dependencies at one. Work and memory stay proportional to one
admitted 8 MB packet; ordinary applications remain capped at 128 changes. The
existing 500M/3B role/name/semantic occurrence planning budgets apply independently
to each growing relation; this adds no whole-corpus join or scan. Additional image
dispersion/weight statistics and VN/release assembly remain unqualified.

DB59 `check-vndb-supporting-updates.ts` now passes 259 rollback assertions across
eleven surface/family cases, three apply/withdraw/reapply cycles each. Character
coverage reads back native original/romanized names, changed alias spoilers,
measurement values, restored image relations and exact
instance/trait/VN-release relation counts. Seven focused test files passed; these
fixtures do not qualify cross-surface source transitions or bulk acquisition.

## VN dump assembly and observation surfaces

The VN initializer and native callback now accept public dump packets with titles,
editions, staff and voice rows, exact global staff-alias dependencies, VN relations,
screenshots, image rows and external links. Staff/voice evidence points to joined
alias rows and original credit rows; the same alias and context resolution protocol
is shared with API imports. Current `c_image` and a distinct editorial `image`
remain separate image-purpose relations. Aggregate provider rating values remain
external statistics and do not create REZICS votes.

Admission caps titles/contexts at 128 each, staff and voice at 4,096 each, joined
aliases at 8,192, screenshots and VN relations at 4,096 each, image dependencies
at 4,098, and links at 512. Every join uses a packet-local map and rejects missing,
duplicate-key or unrelated dependency rows. Work is O(packet rows), remains inside
the 8 MB document and ordinary 128-change application bounds, and does not scan
the 500M/3B source corpus. The prior name/credit/semantic storage and shard-routing
budgets still apply. Large VNs require central staged processing, not larger local
transactions or a whole-dump in-memory join.

DB59 VN dump mode (`REZICS_VNDB_DUMP_FIXTURE=1`) passed 74 rollback assertions over
three apply/withdraw/reapply cycles. Native reads cover title authority/derivation,
staff/voice/context revisions, preserved human context headings, playtime, image
widths, release-scoped screenshots, URLs and sequel relations. API mode separately
passed its existing 38 assertions. Protocol refresh passed 49 assertions, including
an attempted API-to-dump switch through a new mapper epoch: it rejects before any
native retirement because a combined observation projection is still required.
Four affected test files passed 15 tests; backend and script TypeScript checks pass.
Release remaining media/link joins, anime metadata and source tag-vote aggregation,
source status/redirect interpretation and cross-surface combined projections remain
open. Complete public dump streaming acquisition is not implied by packet adoption.
