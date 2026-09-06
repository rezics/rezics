# Current stage — source-complete database schema

Priority: **the current implementation milestone**. Status: **in progress / not
qualified**. The scope clarification was requested by the maintainer on 2026-09-06.
This stage takes precedence over the program's earlier broad increment order.

The 2026-09-07 clarification also makes the following mandatory in this same
stage: **logical Unit with owner-local physical identities and no live global
`unit` parent; explicit fixed-structure/dynamic-relation classification; native
universe/world-setting, franchise and series models.** These gates remain unqualified.

## Required result

REZICS must natively represent the public catalog data of **VNDB, MusicBrainz,
Bangumi and book indexes**, including the novel/translation/serialization cases
represented by Novel Updates or an equivalent permitted provider. The provider
can change; the book-index capability cannot be dropped. Read the
[source-complete schema report](../../report/REZICS-source-complete-catalog-schema-20260906.md)
for the verified evidence, source-to-domain matrix and target physical owners.

The deliverable is implemented PostgreSQL tables/constraints/indexes, canonical
writes, native reads/queries/exports, source conformance and an explicit old-schema
conversion. It is not another plan, raw-payload archive, sparse importer, parser,
email/worker fix, or list of commits. Previously delivered supporting work remains
useful but does not complete any of the four source-schema gates below.

| Source-schema gate | Required coverage | Current state |
| --- | --- | --- |
| Bangumi | Subject kinds/grains, Episode, Person, Character, all documented catalog relations, indices, ordered wiki/Infobox and revisions, source statistics and Archive-only relationship data | Not qualified |
| VNDB | VN, release/patch, VN-local edition, producer, staff/alias identity, character, tag, trait, quote, all declared qualifiers/links/media/language metadata and taxonomy relationships | Not qualified |
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

1. **Complete the contract inventory, then write DDL.** P01/P03/P04 enumerate the
   pinned catalog object families, nested field paths, source vocabularies and
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
   serialization/release events; VN/software releases and local editions; programs
   and episode identities; MusicBrainz Work/Recording/Release Group/Release,
   credits/media/tracks/TOCs and required supporting catalog objects. Complete
   Area/Place/Event/Instrument/Label/Series/Genre/Mood metadata now where source
   contracts require it. They are not future feature placeholders.
   Implement shared grouping identities for universe, franchise and series now,
   with distinct membership predicates, continuity/canon/branch context, source
   support and named ordering profiles. Include native source-free commands.
4. **Integrate one canonical write/read path per owner.** Source-free manual
   creation and versioned source adapters call the same invariant-enforcing
   commands. Wire history/restore, merge, reference/slug resolution, filters,
   projection lifecycle and generated API/SDK. Only frontend adaptations needed
   to keep affected existing flows type-correct belong in this slice; broader
   redesign, scoring pilots and notification polish wait.
5. **Convert and retire the replaced catalog contract.** Inventory old Unit IDs,
   Book/Media/Software/Release grain, localized rows/aliases, credit/subject edges,
   compositions and historical references, including non-catalog consumers of
   the old global parent. Preserve uncertain/source-less entries.
   Replace old authorities through new forward migrations and reviewed bounded
   conversion; retire the live global `unit` parent and its runtime consumers.
   Do not maintain duplicate writable metadata or edit released SQL.
6. **Pass four-source database qualification.** Import permitted representative
   source graphs, query/export them from native tables, verify semantic roundtrips,
   rejection/conflict/withdrawal cases, and complete two interrupted/repeatable
   conversion rehearsals. Publish the field/object coverage and capacity evidence.
   No gate exits with known required fields marked raw-only/unmapped/unsupported.

Source-use rights affect the acquisition/display/processing mode, not whether the
schema must support a required field. Production inventory, credentials, AI
providers, marketing scope and human UI acceptance do not block local DDL and
fixture qualification. Production conversion/activation remains separately gated.

## Required schema acceptance cases

- The same UUID resolves through its physical owner without a global `unit` row.
  Concrete references reject missing/wrong-owner targets; concurrent ID ownership
  conflicts fail safely; stale/missing routing is bounded and the locator rebuilds
  from authoritative owner records. Existing ID/slug/merge addresses survive.
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
- VNDB `aid` and VN-local `eid` survive credits and release references; official,
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
