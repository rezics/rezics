# Current stage — source-complete database schema

Priority: **the current schema milestone**. Status: **autonomous implementation
authorized; complete schema acceptance remains open**. The initial scope
clarification was requested by the maintainer on 2026-09-06.
This stage takes precedence over the program's earlier broad increment order.

The 2026-09-07 clarification also makes the following mandatory in this same
stage: **logical Unit with owner-local physical identities and no live global
`unit` parent; explicit fixed-structure/dynamic-relation classification; native
universe/world-setting, franchise and series models.** These gates remain unqualified.

## Design-review gate

**Latest maintainer clarification, 2026-09-07:** autonomously organize and advance
implementation with native agents and isolated worktrees. Online research and
learning inform decisions; update documents when implementation evidence exposes
a problem. This supersedes the earlier documentation-only pause. Review the
relevant design before accepting each slice; an open unrelated design question
does not block independent implementation or qualify the whole milestone.

The selected direction is a [provider-independent native catalog](../../report/REZICS-Catalog领域边界与实施分期-20260906.md#23-provider-independent-native-model)
for objects REZICS elects to index. Four-source coverage is a required conformance
suite, not the boundary or union of native abstractions. `edition` is not a
mandatory universal layer; the existing `software_edition` slice remains subject
to replacement after referent/variant/credit-context semantics are established.
Cross-domain distribution composition and organizational grouping are separate
required capabilities. [Generic source binding/subscription](../../report/REZICS-source-integration-and-review-20260906.md#44-generic-source-bindings-and-subscriptions)
and its scheduled event/queue protocol apply across owners.

The [event transport architecture](../../architecture/event-streaming.md) is now
accepted: NATS JetStream, preferred Debezium Server outbox relay and Bun consumers.
This closes component selection, not the remaining schema/reference/routing or
execution qualification artifacts below. PostgreSQL retains business plans,
outbox, checkpoints and application receipts; broker state is not a second
authority for canonical data or permission.

During implementation, resolve the following concrete design artifacts
in their owning reports/plans, without creating competing specifications:

| Artifact | Required decision/evidence |
| --- | --- |
| Native semantics and source dispositions | Provider-independent identity, versions/variants, publication/distribution, grouping, carrier/resource and occurrence rules; complete required source-path mappings, ambiguity handling and source-free/cross-provider cases. |
| Identity and reference matrix | Every retained catalog/platform consumer, permitted target family, owner key, concrete FK/checked alternative, deletion/merge/restore behavior and bounded locator publication/repair. Include scoped occurrences and exact revisions. |
| Definitions, revisions and adoption | Predicate roles/cardinality/target shape, vocabulary membership and value rules; immutable revisions/current heads, fixed-field evidence, binding/subscription/policy revisions, withdrawal and staged restore. |
| Physical keys and capacity | Compatible PK/UNIQUE/FK and partition/routing keys for all growing families; source-key uniqueness, reverse lookup/fan-out, hot-owner transactions, retention and 500M/3B amplification. Explicitly resolve the review's source mapping/binding key conflicts. |
| Execution and acceptance specification | Scheduled checks, durable events/jobs, deduplication/fencing, pause/rebind races, canonical writes, source conformance, semantic edit/export/restore and representative capacity/EXPLAIN scenarios. |

The [schema review disposition](../../report/REZICS-source-complete-catalog-schema-20260906.md#43-design-review-disposition)
tracks unresolved work. Principles selected in this update do not make these
artifacts complete. Record researched decisions and verify them with actual
schema replay, type/behavior checks and representative capacity evidence. Legacy
offline conversion and production reopening stay separate.

## Breaking replacement baseline

**Maintainer decision, 2026-09-07; supersedes earlier compatibility and conversion
sequencing in this program.** The maintainer reports that the website is already
stopped and that the legacy dataset is approximately **400,000 records in total**.
These are supplied operating assumptions, not a production inspection by the agent.

- This refactor may be completely destructive. Existing APIs, SDK contracts,
  routes, schema/table layouts and persisted record formats impose **no backward
  compatibility requirement**, including the currently released v1+ contracts.
- Design and implement the final model directly. Rewrite affected backend,
  workers, frontend, generated API/SDK and tests to that contract; remove replaced
  code, the global `unit` parent and its dependencies. Do not build legacy
  adapters, compatibility views/aliases, dual writes, CDC, online backfills or
  mixed-version support to keep the old application running.
- Old data will be handled by **separate offline migration software** reading a
  frozen legacy export and writing the new contract. That tool owns old-to-new
  mappings, ID preservation/remapping, unresolved records and reconciliation.
  It is not an application runtime dependency or a prerequisite for new-schema
  implementation, removal of old tables, or the current schema acceptance gate.
- Fresh-database installation, native/manual and source-fixture conformance,
  new-model integrity/history/restore, integrated new consumers and required
  deterministic/capacity checks define implementation acceptance. Production
  legacy import and reopening the site are separate P11/P12 work.
- Existing UUIDs, old URLs, old payloads and historical storage representations
  need not remain accepted by the new application. New identities/references
  still obey their own stable-identity, privacy and referential-integrity rules.
- The approximately 400k legacy import is a bounded one-time task. It does not
  replace the 500M-row / 3B-row capacity-planning requirements for the new model.
- Released SQL/checksum history remains an audit artifact under CONTRIBUTING;
  retaining it does not require retaining its schema at runtime or converting
  old rows inside new DDL. Generate the replacement schema through repository
  tooling. Rehearsing legacy transfer is not a condition for destructive target DDL.

This document correction does not execute a database reset, delete the legacy
export, run the separate migration program or reopen the site. It removes those
operations from the critical path of implementing the new system. See
[P11's separate acceptance tracks](11-migration-and-cutover.md).

## Required result

REZICS must natively represent the public catalog data of **VNDB, MusicBrainz,
Bangumi and book indexes**, including the novel/translation/serialization cases
represented by Novel Updates or an equivalent permitted provider. The provider
can change; the book-index capability cannot be dropped. Read the
[source-complete schema report](../../report/REZICS-source-complete-catalog-schema-20260906.md)
for the verified evidence, source-to-domain matrix and target physical owners.

The deliverable is implemented PostgreSQL tables/constraints/indexes, canonical
writes, native reads/queries/exports, source conformance and complete replacement
of old runtime contracts. Offline legacy conversion is separate. It is not another
plan, raw-payload archive, sparse importer, parser,
email/worker fix, or list of commits. Previously delivered supporting work remains
useful but does not complete any of the four source-schema gates below.

| Source-schema gate | Required coverage | Current state |
| --- | --- | --- |
| Bangumi | Subject kinds/grains, Episode, Person, Character, all documented catalog relations, indices, ordered wiki/Infobox and revisions, source statistics and Archive-only relationship data | Not qualified |
| VNDB | VN, release/patch, scoped edition/participation observations, producer, staff/alias identity, character, tag, trait, quote, all declared qualifiers/links/media/language metadata and taxonomy relationships; no prescribed native Edition layer | Not qualified |
| MusicBrainz | Complete selected catalog schema: musical entities, supporting entities/vocabularies, credits/attributes, media/tracks, identifiers/redirects, dates, TOCs, source annotations/statistics and incomplete catalog candidates | Not qualified |
| Book indexing | Work where evidenced, text/translation version, publication/edition, serialization, volume/chapter composition, identifiers, contributors, classifications, publishers and source release/update links/statuses | Not qualified |

“Not qualified” is not a percentage estimate. Native foundation DDL now exists;
complete domain structures, four-source mapping/conformance and global-parent
consumer conversion do not. A subset cannot be renamed “full coverage” by reducing
the denominator.

Four-source coverage is necessary but not sufficient. The shared model must also
pass owner-identity cutover and source-free grouping acceptance even when an
upstream source has no equivalent field. See the
[physical identity contract](../../report/REZICS-source-complete-catalog-schema-20260906.md#41-logical-unit-and-owner-local-physical-identity)
and [relation classification](../../report/REZICS-内容结构关系与查询模型-20260906.md#24-fixed-structural-relations-and-dynamic-semantic-relations).

## Mandatory references and live API examples

These URLs are implementation inputs, not optional reading postponed until an
importer happens to need them. Pin each applicable artifact/revision and retain
the mapping inventory. The compact [source baseline](source-contract-baseline.json)
records this audit's hashes and outcomes.

| Purpose | URL |
| --- | --- |
| Bangumi rendered API docs | https://bangumi.github.io/api/ |
| Bangumi API repository / ownership note | https://github.com/bangumi/api |
| Bangumi authoritative OpenAPI | https://github.com/bangumi/server/blob/master/openapi/v0.yaml |
| Pinned inspected OpenAPI | https://github.com/bangumi/server/blob/60fdc32daf1d717f8446bad75fd2c3dc44805642/openapi/v0.yaml |
| Pinned Subject schema | https://github.com/bangumi/server/blob/60fdc32daf1d717f8446bad75fd2c3dc44805642/openapi/components/subject_v0.yaml |
| Pinned ordered Infobox schema | https://github.com/bangumi/server/blob/60fdc32daf1d717f8446bad75fd2c3dc44805642/openapi/components/wiki_v0.yaml |
| Bangumi User-Agent guidance | https://github.com/bangumi/api/blob/master/docs-raw/user%20agent.md |
| Bangumi Archive contract and latest manifest | https://github.com/bangumi/Archive ; https://raw.githubusercontent.com/bangumi/Archive/master/aux/latest.json |
| Bangumi roles, relations and platforms | https://github.com/bangumi/common |
| Bangumi wiki syntax/parser | https://github.com/bangumi/wiki-syntax-spec ; https://github.com/bangumi/wiki-parser-go |
| Actual subject and relation reads | https://api.bgm.tv/v0/subjects/253 ; https://api.bgm.tv/v0/subjects/253/persons ; https://api.bgm.tv/v0/subjects/253/characters ; https://api.bgm.tv/v0/subjects/253/subjects |
| Actual episode reads | https://api.bgm.tv/v0/episodes?subject_id=253&limit=3&offset=0 ; https://api.bgm.tv/v0/episodes/519 |
| Actual book/volume evidence | https://api.bgm.tv/v0/subjects/870 ; https://api.bgm.tv/v0/subjects/870/subjects |
| Actual person/character/context reads | https://api.bgm.tv/v0/persons/3914 ; https://api.bgm.tv/v0/characters/77 ; https://api.bgm.tv/v0/characters/77/persons |
| Actual revision list read | https://api.bgm.tv/v0/revisions/subjects?subject_id=253&limit=3&offset=0 |
| Actual read-only POST search | https://api.bgm.tv/v0/search/subjects?limit=3&offset=0 |
| VNDB API and machine-readable fields | https://api.vndb.org/kana ; https://api.vndb.org/kana/schema |
| VNDB dump and source contracts | https://vndb.org/d14 ; https://code.blicky.net/yorhel/vndb |
| MusicBrainz schema/API/dumps | https://musicbrainz.org/doc/MusicBrainz_Database/Schema ; https://musicbrainz.org/doc/MusicBrainz_API ; https://musicbrainz.org/doc/MusicBrainz_Database/Download |
| Pinned MusicBrainz SQL catalog | https://github.com/metabrainz/musicbrainz-server/blob/cff977f0ba8f06d5fa594e7590f6a134b1a5a22c/admin/sql/CreateTables.sql |
| MusicBrainz relationship vocabulary | https://musicbrainz.org/relationships |
| Open Library source/API/type contracts | https://openlibrary.org/developers/api ; https://openlibrary.org/type/work ; https://openlibrary.org/type/edition |
| Actual book-index reads | https://openlibrary.org/works/OL15626917W.json ; https://openlibrary.org/works/OL15626917W/editions.json?limit=2 |
| Novel Updates requirements reference | https://www.novelupdates.com/series-finder/ ; https://www.novelupdates.com/series/absolute-sword-sense/ |

The thirteen Bangumi API calls returned 200. Eight matched the literal bundled
OpenAPI; five exposed the two documented Infobox/nullability discrepancies. A
narrow validation-only overlay matched all thirteen. Production mapping must
implement and test those exceptions explicitly, retaining the original contract.
Novel Updates page reads returned 403; Open Library Work/Edition reads returned
200. Do not claim an implemented Novel Updates connector or a full corpus import.

Minimal repeatable public read in PowerShell (no token or source mutation):

```powershell
$bangumiHeaders = @{ 'User-Agent' = 'edge/REZICS-schema-audit (2026.09.06; +https://www.rezics.com)' }
Invoke-RestMethod -Headers $bangumiHeaders -Uri 'https://api.bgm.tv/v0/subjects/253'
Invoke-RestMethod -Headers $bangumiHeaders -Method Post -ContentType 'application/json' -Uri 'https://api.bgm.tv/v0/search/subjects?limit=3&offset=0' -Body '{"keyword":"狼与香辛料","sort":"match","filter":{"type":[1]}}'
```

## Implementation order and ownership

1. **Resolve slice design and contract inventory, then verify its DDL.** Define
   native capabilities and source-free cases before mapping providers onto them.
   P01/P03/P04 enumerate the pinned catalog object families, nested field paths,
   source vocabularies and
   relationships. Classify each as fixed structure, dynamic semantic relation,
   typed value or derived/source observation. Each maps to a named native
   table/column or typed fact/relation definition, with identity, cardinality,
   scope, conversion, unknown-value, query/export and fixture rules.
   API plus Archive/dump/taxonomy contracts form
   the denominator; an API-only inventory must not omit dump-only catalog facts.
2. **Implement shared schema foundations.** Owner-local physical identities and
   domain membership implementing the logical Unit protocol, bounded ID routing,
   identified named forms/revisions, open content languages, typed identifiers,
   source records/observations/bindings, governed property/role definitions,
   identified relation revisions/participants/qualifiers/evidence, and ordered
   composition/occurrences. Use real owner-key FKs and validated concrete target
   alternatives; no mandatory global identity parent. Inventory all existing Unit
   consumers before declaring a target reference family complete. Keep
   Auth/private accounts separate from catalog creators; only the necessary P02
   reference integration is on this critical path, not a new account-management UI.
3. **Implement the actual domain tables.** Publishing Work/text version/publication/
   serialization/release events; software versions/variants and releases, with
   scoped source participation contexts where independent versions are unproved;
   programs and episode identities; MusicBrainz Work/Recording/Release Group/Release,
   credits/media/tracks/TOCs and required supporting catalog objects. Complete
   Area/Place/Event/Instrument/Label/Series/Genre/Mood metadata now where source
   contracts require it. They are not future feature placeholders.
   Implement shared grouping identities for universe, franchise and series now,
   with distinct membership predicates, continuity/canon/branch context, source
   support and named ordering profiles. Include native source-free commands.
   Specify checked cross-domain distribution composition without duplicating
   existing domain structural authority or forcing empty hierarchy levels.
4. **Integrate one canonical write/read path per owner.** Source-free manual
   creation and versioned source adapters call the same invariant-enforcing
   commands. Wire history/restore, merge, reference/slug resolution, filters,
   projection lifecycle and generated API/SDK. Adapt retained frontend flows
   directly to the new contract and pass affected type checks; broader
   redesign, scoring pilots and notification polish wait.
5. **Replace and retire the old runtime contract.** Inventory code/schema
   dependencies on the old Unit, Book/Media/Software/Release, localization,
   credits, composition, history and non-catalog references. Rewrite or remove
   these consumers against the new model in the same implementation; do not
   translate old API payloads at runtime. Drop the old global `unit` parent and
   obsolete structures without waiting for the separate legacy migration tool.
   Validate installation on an empty database and the integrated new contract.
   Keep released SQL as historical evidence, not duplicate writable authority.
6. **Pass four-source database qualification.** Import permitted representative
   source graphs, query/export them from native tables, verify semantic roundtrips,
   rejection/conflict/withdrawal cases and new-contract interruption/replay cases.
   Publish the field/object coverage and capacity evidence. Rehearsals of the
   approximately 400k legacy transfer belong to the separate offline tool.
   No gate exits with known required fields marked raw-only/unmapped/unsupported.

Source-use rights affect the acquisition/display/processing mode, not whether the
schema must support a required field. Production inventory, credentials, AI
providers, marketing scope and human UI acceptance do not block local DDL and
fixture qualification. Production conversion/activation remains separately gated.

## Required schema acceptance cases

- Manual and independent provider mappings express the same native semantics.
  Revised/translated text, a parallel-language publication, repeated content,
  a mixed-media boxed release and a cross-media franchise remain distinguishable.
  Changing provider does not require duplicating the domain schema. Edition-local
  identifiers are interpreted by scope/evidence, never by their field name alone.
- One source record can supply multiple target scopes and one Unit can use
  multiple sources. Compatible subscriptions share acquisition; pause/rebind
  fences already queued work. Unchanged checks do not create canonical updates;
  crashes, retries and out-of-order observations cannot duplicate or regress state.
- The same UUID resolves through its physical owner without a global `unit` row.
  Concrete references reject missing/wrong-owner targets; concurrent ID ownership
  conflicts fail safely; stale/missing routing is bounded and the locator rebuilds
  from authoritative owner records. New-contract ID/slug/merge addresses obey
  the new model; retaining legacy addresses is not an acceptance requirement.
- Fixed containment/track references can be read through the relation interface,
  but only their owner command can change them. New governed semantic roles do
  not require a second fact store or removal of reference/value constraints.
- Same-name universe, franchise and series remain separately identifiable. A
  franchise can contain two continuities; `about` does not imply `set_in_universe`.
  Multiple memberships and ordering profiles survive query/edit/export/history/
  restore without inheriting rights or propagating reviews, scores or progress.
- Bangumi subject 253 retains 26 main episodes and 31 total source episodes as
  separate metrics; episode `sort`, meaningful `ep`, type, disc and duration text
  remain distinct. A fractional source number is not coerced to an integer.
- Manga series 38379, novel series 870 and art book 235125 are not merged by title.
  Nested edition blocks become scoped publication facts with their original
  ordered source structure, not overwritten global publisher/title fields.
- Actor + character + subject/release conditions bind to the same contextual
  relation. Do not infer a voice language from an actor's name or nationality.
- VNDB `aid` and snapshot-scoped VN-local `eid` survive contextual credits and
  evidenced version/release mappings. Reorder, removal and reuse of a local `eid`
  do not silently retarget old evidence. Official,
  MTL, spoiler and lie qualifiers keep their separate scopes. Quotes are not lost.
- One recording on two releases has two track occurrences, retaining their own
  IDs, names, numbers, artist credits and durations. Medium IDs/TOC and source
  redirects remain resolvable without turning every track into a social Unit.
- MusicBrainz release dates can differ by territory or have unknown territory;
  relationship start/end precision, ended state, instruments and credited-as text
  survive native roundtrip. Supporting object families are queryable, not raw blobs.
- A book can have multiple identifiers, names, publishers and source records;
  serialization status, original completion and translation completion are
  independent. Chapters, publication volumes and translation releases are not
  interchangeable counts. A concrete publication can exist without an invented Work.
- Conflicting sources coexist with protected human corrections. Withdraw one
  source without removing independent support or moving users' reviews/history.
- An unrecognized incoming schema/enum produces a bounded explicit unresolved
  result. It is not silently discarded or used to lower the conformance target.

## Checks and definition of done

- Real schema/migrations and typed commands exist for every required owner. The
  mapping manifest identifies actual tables/columns/definitions and actual tests.
- All four source-schema gates pass; all required field/object dispositions are
  accounted for. Raw preservation and partial samples are reported separately.
- Owner-identity conversion and universe/franchise/series model gates pass as
  well. The live target has no global `unit` table or substitute universal parent,
  and no runtime FK/read/write dependency on it. Account for existing catalog,
  Entity/Auth, community, personal state, address, history/merge and search owners;
  released SQL and restricted recovery archives are historical evidence only.
- Native read/query/edit/export and revision/withdrawal behavior pass; fixed
  request/document limits do not impose hidden lifetime limits on imported owners.
- Released migration checksums are intact. Generate with
  `task services-main:db:generate -- <name>` and run full replay/schema checks.
  Use the existing `rezics-dev` PostgreSQL and its container `psql` for local SQL
  inspection/verification; use only the supported disposable shadow for generation.
- Record 500M/3B growth for every growing relation and child fan-out, representative
  query plans, million-item owner behavior, bounded memory/WAL/admission and an
  explicit partition/shard cutover path. P10 owns measured resource qualification.
- Backend, affected frontend, filter, i18n and generated API/SDK checks pass.
  Human rendered acceptance remains separate under repository policy.

Progress reports must lead with catalog DDL/table owners, source mapping coverage,
native data-flow evidence and remaining schema blockers. Supporting maintenance
commits and general test counts cannot replace that report.

## Implementation ledger — 2026-09-07

### Current integrated batch and pause

The maintainer requested a temporary stop after this batch and a new-session
continuation prompt. [NEXT_SESSION.md](NEXT_SESSION.md) records the unchanged
full-product objective, retained draft, owner paths and concrete remaining work.

`20260907082947_catalog_native_source_event_batch.sql` integrates reviewed native
music/physical releases and disc candidates, software/VN metadata and revisions,
program/publishing structures, supporting entities/reference profiles/groupings,
mixed-media distribution manifests, governed facts/relations, names/identifiers/
authority histories, source bindings/acquisition/proposals and event execution.
Full source-family mapping and product integration are still not qualified.

Source natural-key identity now has a deterministic UUID and database proof;
bindings carry source-record-scoped compound keys. The migration has 1,088 source
hash partitions and 256 operational range partitions. Reviewed pre-diff source
replacement and before-canonical child creation preserve the supported Atlas
workflow. Canonical verification reconstructs owned static/dynamic triggers in
a rollback transaction and compares their definitions and enabled state.

Validation: 47 migrations / 3,884 statements replayed from an empty target;
canonical PostgreSQL definitions and partition checks pass. The affected backend
and scripts typecheck; 246 targeted backend/tooling tests and the shared reference
package's three tests pass. Nine isolated native/source SQL harnesses cover
semantics, names, entities/grouping, distribution, software, physical music,
music history, program/publishing and source lifecycle. Source-event rollback
checks and the 12,016-context / 36,048-revision / 24,032-observation skew fixture
also pass. These checks are local integrity/planner evidence, not full-corpus,
frontend or production qualification. No global test suite or browser QA ran.

Integration repaired actual PostgreSQL failures: history snapshots now match
column names rather than physical column order after ALTER TABLE; correlated
semantic state reads retain SQL qualification; internal references select their
owner/ID without weakening strict serialized schemas; withdrawn grouping members
use current semantic state; and fixture definition kinds match real SQL policy.

The pinned Debezium relay and the Bun source task chain were exercised with
real PostgreSQL/NATS, including offset/restart recovery, lost acknowledgments,
deduplication and pause cancellation. Acquisition registration is still limited
to selected principal endpoints; complete native structural update/compensation,
retention rebuild/GC, all source families and production qualification remain.

The P02 Profile/Entity/Auth draft is preserved only on
`codex/delivery-participation-20260907` at
`acdf5a5c5618f0d20d19a8281dbf7c38887050ea`. It is not merged because its downstream
consumer migration and SQL lifecycle verification remain unfinished. The global
`unit` table, retained platform owners, public API/SDK and Web conversion are
next-session work. Neither this batch nor the handoff marks the plan complete.

This ledger records scoped execution. Historical tables or successful selected
observations do not qualify the whole provider-independent model.

### Autonomous implementation wave

`20260907063641_operational_contexts_and_events.sql` replaces `software_edition`
with provider-independent participation contexts, complete immutable revisions,
validated current heads and exact snapshot-local source occurrences. All active
callers use the new commands; a release no longer takes an `editionId` pointing
at a staff-list context. Manual edit/history/restore, VNDB source claims and
changed-snapshot review stay distinct. PostgreSQL rejects wrong references,
unfinished heads and history mutation. Shared owner authority locks allow
independent context edits while exact context revision locks reject stale edits.

The same generated migration installs the P10 transactional outbox, task intents,
application receipts, finite storage admission and 192 physical partitions. The
catalog writes an exact `source.record.observed` event with each new snapshot;
unchanged observations do not emit, and admission failure rolls back the snapshot.
See [native verification](../../../services/main/src/services/catalog/README.md#context-verification-and-capacity)
and [event durability](../../../services/main/src/services/events/durability.md)
for executable commands, measured evidence, 500M/3B estimates and operational limits.

The final generated target replayed all 46 migrations (3,097 statements) from
empty PostgreSQL. Atlas reports no schema differences; canonical functions and
triggers match, including all 192 partition ranges and 384 inherited guards.
The affected backend/script TypeScript check and targeted catalog, transport,
durability, coverage and schema-contract tests pass. No global test suite or
frontend/browser acceptance was run. Ordinary development data was not migrated
or reset; all SQL qualification used task-owned disposable databases.

The new `catalog:sources:coverage` gate pins reviewed field dispositions and
schema/write/query/export/fixture evidence. Initial results are deliberately
incomplete: 22 reviewed declarations, 15 native gaps, 3 source-only observations,
4 exclusions and 8,390 missing dispositions out of the 8,412-declaration
superset. Zero complete native mapping evidence is claimed. `--inspect` succeeds
for internally consistent bookkeeping; normal qualification fails while gaps
remain. A declaration count is still not the native semantic denominator.

Next integration priorities are source-record natural-key routing and composite
binding/revision keys; exact source acquisition/subscription/adoption fences;
provider-independent distribution occurrences and remaining owner references;
complete source dispositions and canonical semantic coverage. The baseline
consumer audit found 104 direct `unit` FK declarations across 36 schema files,
with 21 public kinds and only seven native catalog owners. Retiring the global
parent therefore still requires retained platform owners and all their consumers.
No four-source, global-parent-cutover, full grouping or production gate closes
because of this wave.

### Earlier foundation

- `20260906171239_catalog_native_foundation.sql` adds 87 native tables: seven
  owner-local identities and their names, identifier claims, typed facts/value
  nodes, relation participants/scopes, operation records, source bindings/support,
  plus definitions, acquisition evidence, routing and grouping/order structures.
  Native owner identities do not reference the old `unit` parent; the old system
  still does. A temporary collision fence protects both identity stores.
- `20260906174358_catalog_value_integrity.sql` enforces append-only/sealed values,
  root type and prefix checks, and source-snapshot immutability. Both migrations
  were applied to `rezics-dev`; the complete migration/schema replay passed.
- Canonical internal commands and reads passed 34 local assertions, including
  source-free grouping classes/order, same-relation conditions, multiple value
  batches, privacy, owner/FK rejection, sealed values, stale edits and concurrent
  identity allocation. Fixtures were rolled back or precisely cleaned up.
- A 50,000-relation / 100,000-participant rollback fixture exercised rare-target
  conjunctions with visibility enabled: warm `EXPLAIN (ANALYZE, BUFFERS)` recorded
  SQL execution of 0.493 ms for 50 matching rows and 0.248 ms for zero mismatched
  rows. These exclude API/transport and the preliminary owner access lookup;
  they are local plan evidence, not a 500M/3B capacity qualification.
- A reproducible compiler pins 46 upstream artifacts and emits 8,412 declaration
  entries. It also includes internal/private declarations and vocabulary shape;
  this count is not the catalog mapping denominator or native coverage.

The next work remains complete source-field dispositions and native adapter
coverage on the domain structures, then complete definition
governance, revision/restore, source adapters and old-consumer integration. No
four-source gate, final Unit cutover, full grouping gate or production gate has
been marked complete. See the [native module](../../../services/main/src/services/catalog/README.md)
for implemented boundaries, workload assumptions and verification commands.

### Typed domain slice

`20260906183824_catalog_domain_structures.sql` adds 50 actual domain tables and
owner/shape FKs. Publishing Work/text/publication/serialization, musical work/
recording/release group/release/medium/track, alternate tracklists/TOCs, programs/
episodes, scoped VN editions and required reference entities now have structural
owners. `20260906185206_catalog_credit_streaming.sql` adds batchable, sealed shared
credits with database-maintained counters and immutable member values. Both were
applied locally and passed full schema replay; 31 additional local domain assertions
passed. Native fixture data was rolled back.

The domain assertions cover independent publications, plural/colliding identifiers,
original credit names and join phrases, shared recordings with distinct occurrences,
partial regional dates, separate episode counts/fractional numbering, VN-local
edition rejection, installment cycles and 520-member credit groups spanning several
batches. They do not yet prove complete four-source field coverage, source adoption,
historical restoration or old-schema conversion. The complete stage remains open.

### Initial source adoption slice

`20260906192903_catalog_source_adoption.sql` adds snapshot-scoped review proposals;
`20260906195437_catalog_publication_work_coverage.sql` adds explicit publication
coverage of evidenced Works without manufacturing text-version identities;
`20260906203828_catalog_reference_observations.sql` adds checked snapshot evidence
for source identities first encountered inside another source record. All three
were generated through the supported task, applied to `rezics-dev` without a
reset and passed complete migration/schema replay.

The following actual public responses passed rollback-only PostgreSQL checks:

| Input | Verified native result |
| --- | --- |
| https://api.bgm.tv/v0/subjects/253 | Independent 26 main / 31 total episode counts, names, repeat identity, changed-snapshot review, protected local correction and private-target denial |
| https://openlibrary.org/works/OL15626917W.json and https://openlibrary.org/books/OL24574991M.json | Separate Work/publication identities, direct coverage, plural identifiers, partial 2010 publication date and repeat identity |
| https://api.vndb.org/kana/vn with filter `["id","=","v17"]` and the explicit selected fields in `check-vndb-adoption.ts` | VN content and local editions; supplied staff `aid`, edition `eid` and voice context values retained as source observations |
| https://musicbrainz.org/ws/2/release/f922ec87-4758-421d-a839-3193455345ff?fmt=json&inc=recordings+artist-credits+release-groups+labels+discids | Release/media, 12 distinct track occurrences, recording/track length separation, shared credits and checked inline source identity evidence |

All supplied fields in these examples roundtrip through typed value rows and
snapshot support. This is **selected-record observation preservation plus the
listed structural projections**, not complete semantic conversion. VNDB staff
and voice contexts, for example, are not yet the final canonical contextual
relations. Source-shaped export currently reflects adopted observations, not a
completed canonical-edit export protocol. Archive transport was an in-memory
test double; the database and public HTTP reads were real.

The final backend suite passed 253 files / 1,474 tests; backend and script
TypeScript checks passed. MusicBrainz's live database check also passed after
reference hardening. The reference writer now rejects evidence
with another ID, invalid array positions or a fabricated receipt. Temporary
fixture rows were rolled back. These checks do not establish complete source
coverage, API/SDK integration, historic restore, global-parent retirement or
500M/3B operational capacity. No source-schema gate changes to qualified.
