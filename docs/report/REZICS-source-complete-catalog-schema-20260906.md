# Source-complete catalog schema: current-stage contract

Date: 2026-09-06; target clarified 2026-09-07. Status: corrected stage scope and researched target schema;
the complete catalog schema described here is **not yet qualified**. A first native
foundation, typed domain structures and initial four-source sample projections
are implemented; see the [implementation ledger](../plan/operational-refactor-20260906/00-source-complete-schema.md#implementation-ledger--2026-09-07).
Selected-record typed observation roundtrips do not establish complete canonical
field/relation coverage. The live old `unit` parent and its consumers still need
the coordinated cutover; no final schema gate is qualified.
Code inspection baseline: `4fbb0ce67`. This report owns the source-to-domain
mapping and physical-schema milestone. [Source operations](REZICS-source-integration-and-review-20260906.md)
continues to own acquisition, rights, continuous adoption and review.

## 1. Correction to the delivery priority

The current stage must deliver a database model that can fully represent the
public catalog data of **VNDB, MusicBrainz, Bangumi and a book-index source**.
Novel Updates is a book-index/serialization reference, not a mandatory website
dependency. Open Library supplies a concrete, accessible Work/Edition baseline;
Bangumi supplies additional novel, manga, volume and edition evidence.

The earlier operational program let independent worker, privacy, language-parser
and governance improvements become the main implementation stream. Those changes
are useful supporting work, but they do not satisfy this stage. One function
migration, a raw import, an external-link table or a passing general test suite
does not establish that these catalogs fit the database.

The next implementation work is the [schema milestone](../plan/operational-refactor-20260906/00-source-complete-schema.md).
No further unrelated product/operations work should displace it. Fix supporting
code only when necessary to exercise the new schema, preserve existing data, or
pass an affected deterministic check.

“Fully represent” means every in-scope catalog object, field, repeated value,
identifier, relationship, qualifier, order, partial date, language, source
revision and lifecycle state has a native owner and a tested import/read/query/
edit/export path. A source payload retained only in JSON/object storage is
evidence, not native conformance. Typed extensible facts are valid native storage
when their definition, value type, cardinality, scope, query and revision
semantics are implemented; arbitrary unvalidated JSON is not.

Private provider credentials/accounts and provider-internal moderation, edit
voting and operational queues are not catalog objects to clone. Source ratings,
tag counts, collection counts and permitted annotations remain source-scoped
observations, not invented REZICS users or votes. Media descriptors and rights
references are in scope; catalog compatibility does not require distributing
novel text, VN executables, music recordings or image binaries without eligibility.

## 2. Verified source contracts and exact entry points

### Bangumi: documentation, source and live requests

- [Documentation](https://bangumi.github.io/api/)
- [API repository](https://github.com/bangumi/api)
- [Authoritative v0 OpenAPI source](https://github.com/bangumi/server/blob/master/openapi/v0.yaml)
- [Pinned inspected OpenAPI](https://github.com/bangumi/server/blob/60fdc32daf1d717f8446bad75fd2c3dc44805642/openapi/v0.yaml)
- [Pinned Subject component](https://github.com/bangumi/server/blob/60fdc32daf1d717f8446bad75fd2c3dc44805642/openapi/components/subject_v0.yaml)
- [Pinned Infobox component](https://github.com/bangumi/server/blob/60fdc32daf1d717f8446bad75fd2c3dc44805642/openapi/components/wiki_v0.yaml)
- [User-Agent guidance](https://github.com/bangumi/api/blob/master/docs-raw/user%20agent.md)
- [Archive format](https://github.com/bangumi/Archive), [latest archive manifest](https://raw.githubusercontent.com/bangumi/Archive/master/aux/latest.json)
- [Role/relation/platform dictionaries](https://github.com/bangumi/common)
- [Wiki grammar](https://github.com/bangumi/wiki-syntax-spec), [reference parser](https://github.com/bangumi/wiki-parser-go)

The API repository explicitly identifies `bangumi/server` as the owner of the
synced v0 specification. External component references were resolved from one
repository commit, not treated as absent schemas. The bundled specification's
SHA-256 is `1c60608e97a53129b6fa646e0813a2e02f2efcebbd0f9e3beb08488c02297c66`.
The upstream `/v0` path is Bangumi's contract, unrelated to REZICS's supported
v1 compatibility baseline.

Live verification completed at `2026-09-06T15:16:31.605Z`, using public reads and
User-Agent `edge/REZICS-schema-audit (2026.09.06; +https://www.rezics.com)`:

| Request | HTTP | Observation |
| --- | --- | --- |
| [GET subject 253](https://api.bgm.tv/v0/subjects/253) | 200 | Anime subject; `eps=26`, `total_episodes=31`; ordered string/list Infobox values |
| [GET its persons](https://api.bgm.tv/v0/subjects/253/persons) | 200 | 130 related person records, including role and episode-scope text |
| [GET its characters](https://api.bgm.tv/v0/subjects/253/characters) | 200 | 97 characters; a character can have several actors within this subject |
| [GET its related subjects](https://api.bgm.tv/v0/subjects/253/subjects) | 200 | 28 cross-object relations, including books, music and games |
| [GET three episodes](https://api.bgm.tv/v0/episodes?subject_id=253&limit=3&offset=0) | 200 | Three returned rows out of reported total 31 |
| [GET book subject 870](https://api.bgm.tv/v0/subjects/870) | 200 | Novel series, `series=true`, `volumes=24`, nested edition/publisher Infobox block |
| [GET its related subjects](https://api.bgm.tv/v0/subjects/870/subjects) | 200 | 48 related records; volume/version relationships must retain their scope |
| [GET character 77](https://api.bgm.tv/v0/characters/77) | 200 | Structured fictional-character fields; `blood_type=null` |
| [GET person 3914](https://api.bgm.tv/v0/persons/3914) | 200 | Public professional identity; `blood_type=null` |
| [GET episode 519](https://api.bgm.tv/v0/episodes/519) | 200 | Source episode identity, subject reference, numeric order and duration text |
| [GET character/person contexts](https://api.bgm.tv/v0/characters/77/persons) | 200 | Eight contextual actor associations with subject references |
| [GET three subject revisions](https://api.bgm.tv/v0/revisions/subjects?subject_id=253&limit=3&offset=0) | 200 | Three returned revision summaries out of reported total 44 |
| [POST subject search](https://api.bgm.tv/v0/search/subjects?limit=3&offset=0) | 200 | Three book-category results of different grain; this is a read-only POST query |

The search body was
`{"keyword":"狼与香辛料","sort":"match","filter":{"type":[1]}}`.
The results included a manga series (38379), a novel series (870), and an art book
(235125). A common title or `type=1` is insufficient to identify one publication.
The search response reported `total=1000`; it is not a complete-source denominator.
Counts above describe this observation, not permanent source totals.

Response validation used `@apidevtools/json-schema-ref-parser` 14.2.1, Ajv 8.20.0
and `ajv-formats` 2.1.1. External references were bundled before checking response
bodies. Ajv strict-schema mode was disabled for OpenAPI metadata; data coercion,
default insertion and additional-property removal were not enabled. This checks
the declared response constraints, not native REZICS mapping or corpus completeness.

**Literal document validation did not pass for every successful response.** Eight
of thirteen responses matched the bundled response schema. The other five exposed
two concrete defects:

1. `WikiV0.items.properties.value` declares `type: object` together with an
   `anyOf` whose branches are string and ordered array. Actual data uses the
   documented string/list forms. The contradictory outer type must not become a
   REZICS storage restriction.
2. Character/PersonDetail `blood_type` is described as nullable, but its schema
   requires an integer/enum; both sampled detail responses returned null.

A validation-only experiment removing that incompatible outer object type and
allowing null for these two blood-type fields matched all thirteen responses.
This is evidence for a narrow versioned adapter correction, **not an implemented
production adapter** or permission to weaken all source validation. Record the
original schema, discrepancy, local rule and regression fixture separately.
`PersonDetail.last_modified` is documented as currently reflecting latest user
comment time; it must not be used as a reliable wiki-change watermark.

The inspected Archive manifest names `dump-2026-09-01.210329Z.zip`, 435,891,841
bytes, with source-provided SHA-256
`5d02c90e8317c47f17f912b614f25c7611cd08297bf428450ebf7a00a9821a39`.
The manifest and format were inspected; the full archive was not downloaded or
imported. API and Archive are complementary contracts, not excuses to skip either
schema analysis or direct API validation.

### VNDB

Use [Kana API](https://api.vndb.org/kana), [live schema](https://api.vndb.org/kana/schema),
[dump documentation](https://vndb.org/d14) and [source repository](https://code.blicky.net/yorhel/vndb).
The fetched schema SHA-256 is
`4821b4815b6b316ae61e9556e480e4915a607451f3f5c7ad1e239aa02b632d0f`.
Its catalog query families are `/vn`, `/release`, `/producer`, `/character`,
`/staff`, `/tag`, `/trait`, **`/quote`**. `/ulist` belongs to user-owned activity.

The schema explicitly includes VN-local `editions.eid`, staff `aid`/alias IDs,
staff `eid`/role/note, character-VN-release role/spoiler, trait `lie`/spoiler,
tag rating/lie/spoiler, language-specific titles/officialness and release-language
`mtl`. The adapter must retain these distinctions. Source `ta` is labelled
Tagalog and `ck` Cherokee: map them at this pinned source boundary to `tl` and
`chr`. Public BCP 47 `ta` remains Tamil. Do not copy the older schema checksum
from prior research as if it were the current artifact.

### MusicBrainz

Use [database schema](https://musicbrainz.org/doc/MusicBrainz_Database/Schema),
[API](https://musicbrainz.org/doc/MusicBrainz_API),
[dump contract](https://musicbrainz.org/doc/MusicBrainz_Database/Download),
[relationship types](https://musicbrainz.org/relationships), and the
[pinned SQL definitions](https://github.com/metabrainz/musicbrainz-server/blob/cff977f0ba8f06d5fa594e7590f6a134b1a5a22c/admin/sql/CreateTables.sql).
The inspected SQL SHA-256 is
`92d1981a0d4f5032bca1565d27fafa8a0eac4d11b7f34feab71bfde8a00ecb13`.
It contains 374 table declarations, including internal and derived tables; that
number is **not** a requirement to clone 374 REZICS tables.

The catalog scope includes Artist, Label, Area, Place, Event, Instrument, Genre,
Series, URL, Work, Recording, Release Group and Release; the pinned SQL also has
Mood and its relationships. It includes MBIDs/redirects, aliases, annotations,
typed attributes, artist-credit groups and ordered credited names/join phrases,
release labels/catalog numbers, country-specific and unknown-country dates,
medium/track IDs, track number text versus position, data tracks, durations,
ISRC/ISWC, DiscID/TOC and relationship attributes/credited-as text.
IPI/ISNI and public CD-stub metadata also need source-scoped identifier/candidate
representation; do not force an incomplete stub into an accepted Release identity.
The documentation identifies schema v31; bind actual dump imports to their
reported schema sequence as well as the selected source commit. Do not infer
production availability of every API route from a development SQL file.

### Book indexing: required capability, replaceable provider

Use [Open Library APIs](https://openlibrary.org/developers/api),
[Edition type](https://openlibrary.org/type/edition),
[Work type](https://openlibrary.org/type/work), and
[schema source](https://github.com/internetarchive/openlibrary/blob/dc153f22c728ad4e2e414867363805a032c64a6b/openlibrary/core/schema.py).
Both [Work OL15626917W](https://openlibrary.org/works/OL15626917W.json) and
[its editions](https://openlibrary.org/works/OL15626917W/editions.json?limit=2)
returned HTTP 200. The edition OL24574991M demonstrated a Work reference,
year-only publication date, language reference, publisher, ISBN array, pagination,
table of contents, classifications and source-record references.
The source language reference `/languages/eng` needs an explicit provider/ISO
vocabulary mapping to BCP 47 `en`; it is not passed blindly to the IANA tag parser.
Preserve the original code and mapping revision, as with VNDB's vocabulary.

[Novel Updates Series Finder](https://www.novelupdates.com/series-finder/) and
its series pages are references for web/translated-novel indexing. Direct page
retrieval returned 403 in this audit, so no complete HTML/API contract is claimed.
Do not bypass that response or claim a working Novel Updates adapter. Preserve
the required capability: original and translated titles, author/illustrator,
original language, publishing/serialization status, volumes/chapters, translators
or groups, translation status, original/translated publishers, editions, source
release links, tags/genres and update dates. Open Library alone does not prove
web-serialization/translation-update coverage; those cases require their own
permitted input fixtures and source mapping.

## 3. Required source-to-domain coverage

| Source family | Native domain ownership and essential distinctions |
| --- | --- |
| Bangumi Subject | Publishing, program, music or software ownership based on kind **and grain evidence**; source series/volume/episode metrics remain distinct |
| Bangumi Person/Character | Public catalog Entity and typed character details; real person/company/group and fictional character/mecha/organization are not Auth accounts |
| Bangumi Episode | Identified program/text content or music occurrence as appropriate; source ID, `sort`, meaningful `ep`, type, disc, duration text and dates survive |
| Bangumi relations/wiki | Identified contextual relations, ordered participants and episode qualifiers; ordered typed Infobox entries including nested edition blocks; raw wiki and revision evidence retained |
| Bangumi indices and Archive-only relationships | Public catalog indices/ordered entries retain external curator attribution; Archive person/character relationships retain participant type, relation code, spoiler and ended state even when no equivalent v0 endpoint exists |
| VNDB VN/Release | VN content identity separate from distributable release/patch; VN-local editions are scoped identities; platforms, media quantities, engines, resolutions and language/MTL/official flags retained |
| VNDB staff/characters/taxonomies/quotes | Alias identity used by credits; actor-character-VN context; release/role/spoiler/lie qualifiers; tag and trait vocabularies with taxonomy identity; attributed quotes linked to VN/character |
| MusicBrainz musical entities | Work, Recording, Release Group and Release independent; ordered artist credits; recording reuse does not erase release-specific track text/credits |
| MusicBrainz supporting catalog | Area/Place/Event/Instrument/Label/Series/Genre/Mood/URL, aliases, relationships and attributes; these are required source data, not deferred general-purpose product platforms |
| MusicBrainz composition/identifiers | Identified medium and track occurrences with MBIDs; position versus displayed track number; data tracks, duration, release-country dates, catalog numbers, ISRC/ISWC and DiscID/TOC |
| Book indexes | Optional evidenced Work, text/translation version, concrete publication, serialization and volume/chapter occurrences; plural identifiers, publication/translation states, contributors, classifications and release links |
| Shared source metadata | Typed source statistics, taxonomy observations, text/media descriptors, provenance, raw code, mapping/schema revision, null/unknown values and source withdrawal/redirect state |

Full stage coverage cannot be reduced to CJK VNs, one Bangumi subject or core
MusicBrainz Recording/Release alone. CJK focus remains a later presentation/
campaign choice. Finite sample data proves cases, while the complete pinned
field/object inventory defines the coverage denominator.

## 4. Physical schema contract to implement

**Maintainer clarification, 2026-09-07:** this stage includes owner-local physical
identities, the fixed-structure/dynamic-relation distinction, and native universe,
franchise and series modeling. These are required schema outcomes even where a
source has no matching field; they are not postponed product experiments.

The current schema has concrete blockers, not merely missing importer code:

- Existing supported resource types still depend on the global `unit` identity/lifecycle
  table. Moving only heavy metadata leaves that central identity dependency in
  place and does not fulfill the selected target below.
- `book.isbn13` is a single globally unique value and `publication_date` is a
  complete SQL date; source editions carry plural identifiers and partial dates.
  An uncertain legacy Book, a series, a text version and a concrete publication
  cannot be equated by the existing table name.
- `media` has broad kind and count fields; `audio`/`video` do not supply
  MusicBrainz Work/Recording/Release Group/Release/Medium/Track semantics.
- Current localized metadata uses a finite language set and one primary slot per
  Unit/language. The new IANA consumption parser has not replaced those tables.
- Existing fixed credit/subject role contracts do not provide arbitrary governed
  roles, ordered credit groups, revision-addressable relations and all n-ary scope.
- The existing 64-entry language document and eight-context Entity measurement
  bound cannot become lifetime limits on source-complete names or contextual facts.
  New owners must use bounded commands/pages without silently truncating history.
- External display links are not source records, immutable observations, field
  provenance or revisioned adoption bindings. Native record/snapshot/binding/support
  tables now exist, while source adoption and full revision-target integration remain pending.

These gaps must be resolved by the catalog DDL and coordinated owner cutovers.
Do not label them complete after adding a JSON column or a source URL.

Use one PostgreSQL business database and `public` schema initially. The following
are target physical owners, not claims about existing tables. The implementation
must turn each row into DDL, constraints, indexes, canonical commands and mapping
fixtures before describing it as supported. Preserve Unit IDs where the referent
is unchanged; do not create empty Work parents or merge source-less legacy Books.

### 4.1 Logical Unit and owner-local physical identity

Unit is the shared logical contract for stable UUID identity, typed references,
lifecycle operations and applicable platform capabilities. It is not a mandatory
physical parent row. Publishing, music, program, software, public Entity, grouping
and existing platform owners keep their own authoritative identity/lifecycle
records, with one owner per identity. Same-object extensions reference that owner;
an MV can combine capabilities without creating two independent identities.
Semantic class, public API kind and storage owner are distinct concepts.

The final target has no global `unit` table, renamed universal entity parent or
mandatory parent registration that all domains must join or reference. Merely
partitioning the old parent also does not complete this change. Initially all
owner tables remain in one PostgreSQL database and `public` schema; separate
databases or services are not required.

- Preserve existing UUIDs and supported v1+ ID/slug addresses. Internally resolve
  a Unit reference to a validated owner and ID before dispatch. Only registered
  server-side owners select SQL tables; a supplied class/kind is not proof of
  physical ownership or permission.
- Owner-local extensions and cross-owner endpoints in this single database use
  concrete target keys/FKs and checked target alternatives. Each reference family
  must name its actual constraints, lookup, deletion and restore policy before
  DDL acceptance. A TypeScript union or unchecked `(type, uuid)` pair does not
  establish referential integrity; a normal FK cannot target a union of tables.
  [PostgreSQL foreign keys](https://www.postgresql.org/docs/18/ddl-constraints.html#DDL-CONSTRAINTS-FK)
- ID-only lookup uses a rebuildable, partitionable owner locator, with bounded
  lookup/batch resolution. It carries routing information, not canonical titles,
  visibility or lifecycle, and is not an FK parent. Owner identity and migration
  records are its recovery source. Missing, conflicting or stale entries fail
  closed or enter bounded repair; they never cause a scan of every owner table.
  Admission must detect conflicting UUID ownership, including imported IDs;
  per-owner uniqueness alone does not prove global uniqueness. The executable
  contract must cover concurrent creation, locator publication and repair before
  claiming global ID resolution.
- Keep slug addressing and permanent merge redirects under their existing
  semantic authorities; migrate their target references. Merge/restore and owner
  moves retain the original ID and checked routing generation. Routing metadata
  must never become a second authority for permissions or canonical identity.
- Inventory all existing consumers: catalog, Entity/Auth bindings, community,
  reviews/lists, tags, private progress, addresses, history, merge and search.
  Replacing the catalog alone while these still require a live global parent is
  not completion. [P11](../plan/operational-refactor-20260906/11-migration-and-cutover.md)
  owns bounded conversion, writer fencing and retirement. Released migrations
  remain intact; a restricted old-data archive is not an active identity service.

PostgreSQL inheritance does not supply cross-child unique/FK guarantees, and
partitioned uniqueness must include the partition key. Neither mechanism is an
implicit implementation of the logical Unit contract. Retain real local
constraints; future cross-database extraction needs an explicit reference protocol
and separate qualification. [Inheritance caveats](https://www.postgresql.org/docs/18/ddl-inherit.html#DDL-INHERIT-CAVEATS),
[partitioning limits](https://www.postgresql.org/docs/18/ddl-partitioning.html#DDL-PARTITIONING-DECLARATIVE-LIMITATIONS)

### 4.2 Required owner families and relationship storage

The [fixed/dynamic relationship inventory](REZICS-内容结构关系与查询模型-20260906.md#24-fixed-structural-relations-and-dynamic-semantic-relations)
owns the classification rules and examples. Every source mapping must name its
category, authoritative owner and invariant-enforcing command. A unified relation
read interface must not introduce a second writable edge for a structural fact.

| Owner/table family | Required physical contract |
| --- | --- |
| Owner-local identity and domain membership | Stable logical Unit IDs; each physical owner holds identity/lifecycle and its extensions reference that owner key. No global `unit` parent. Explicit unresolved grain is allowed for legacy/source ambiguity. Cataloging a creator never grants login/representation rights. |
| `named_form`, `named_form_revision`, display selection | Identified multiple names per language, scoped to content/edition/territory; exact original text, kind, origin, translation method and evidence. A display choice references a form, not a second writable title. |
| Definition/revision and typed fact tables | Governed field/type/cardinality/unit definitions; typed scalar columns and ordered structured value nodes for long-tail source facts. Parsed wiki entries preserve repeated keys, order and nested tuples; common queried domain fields remain typed domain columns. |
| Owner-local relation families, revisions, participants, qualifiers, supports | Shared logical relation protocol with identified n-ary relations, governed roles, ordinal/credited-as text, owner/context, precise target revision, partial dates, lifecycle and independent evidence supports. Shared definitions do not imply one universal physical `catalog_relation` table. Supported shape is versioned code. |
| Source records/observations/bindings | Namespace + source object type + native ID uniqueness; immutable observation headers/checksums, schema/mapping versions and payload references; revisioned scoped bindings. Typed Unit/occurrence/name/relation target FKs with exactly-one-target constraints, not unchecked `target_type + uuid`. |
| Identifier claims | Namespace, normalized and original value, target scope, validation and evidence; plural ISBN/GTIN/ISRC/ISWC/MBID/source aliases. Identifier equality is evidence, not automatic Unit equality. |
| Publishing | Domain membership; optional `publishing_work`, `publishing_text_version`, `publishing_publication`, `publishing_serialization`, ordered contents and `publishing_release_event`/links. Translator and translation state belong to the actual text/version; publisher/date/format/page count belong to the relevant publication. Book-index records need not host text. |
| Software/VN | Software content identity plus VN-specific extension, `software_release`, scoped editions, platforms, media/distribution, language support and release-to-content membership. A patch, work, release and edition-local number are different referents. |
| Program | `program`, program versions and episode/content identities, hierarchy/occurrences and distinct expected/aired/cataloged counts. Bangumi's episodes and music tracks do not share one undifferentiated episode-count field. |
| Music | `music_work`, `music_recording`, `music_release_group`, `music_release`, artist-credit group/names, release labels/events, media and track occurrences, TOC/disc identifiers and typed relationship attributes. Existing Audio remains content, not a file or universal replacement for these identities. |
| Supporting catalog | Public Entity details plus catalog Area/Place/Event/Instrument/Label and governed Series/Genre/Mood/Tag/Trait owners. Reuse common protocols where semantics match; implement location/event/instrument facts required by MusicBrainz now. Ticketing, logistics and generic event products remain out of scope. |
| Grouping: universe, franchise and series | Independently addressable identities using shared grouping capabilities and governed semantic classes. Distinct `set_in_universe`, `part_of_franchise`, `part_of_series` and `about` relations, continuity/canon/branch and source context, and named ordering profiles where relevant. No mandatory Work parent, rights inference or automatic propagation of scores/progress. Implement now, including source-free creation. |
| Composition/occurrences | Stable occurrence IDs distinct from Unit IDs; owner/parent/order indexes, source position text and normalized ordering, local mutation commands and segmented checkpoints. Formal containment is concurrency-safe and acyclic. A track/medium can have a source ID without becoming a social Unit. |
| Language support/authority | Open BCP 47 content tags; per-version/channel declarations and identified translation derivations; officialness assertions bind an exact form/release/revision, authorizer when known, territory/time, evidence and review state. Unknown authority remains unknown. |
| Source statistics/excerpts/media descriptors | Preserve source scales/counts/timestamps separately from local votes; attributed quotes/annotations have explicit owner, scope and rights. Large eligible payloads use object storage with checksum and access/retention metadata; structured relationships and queried fields remain in SQL. |
| External catalog indices | Source-owned public catalog lists and ordered entries with permitted external curator attribution and notes. Do not impersonate that curator with a native Profile or import private user shelves. |

Shared protocols do not justify concentrating all growing facts, text and history
in one unpartitionable row store. Physical growing families carry a stable owner/
routing key; partitioned unique/FK keys include that key. Cross-owner references
and reverse indexes need explicit routing. Do not derive storage ownership from
mutable tags or interface language.

Each replaced writer must be removed in the same owner cutover. In particular,
the old single ISBN/opaque format fields, fixed localized title slots, fixed
business-role checks and broad Media/Release semantics cannot remain competing
authorities beside the new model. P11 accounts for original values, IDs, history
and visibility before any destructive forward removal.

## 5. Schema qualification and capacity

The executable coverage manifest must enumerate every pinned catalog field path,
object family, enum/definition and relationship with: source revision, local table/
columns, identity/grain rule, value conversion, null/precision semantics, owner
command, query/export path, fixture and disposition. Known required fields cannot
be declared complete as `raw_only`, `unmapped` or `unsupported`. Rights restrictions
may disable acquisition/display of actual material; they do not excuse missing
schema semantics, which can be tested with permitted fixtures.

Qualification must include same-title manga/novel/publication separation; nested
edition blocks; actor/character/subject and release scope; partial dates and
unknowns; multiple names/authorizers; shared recordings across releases; ordered
credits/join phrases; medium/track IDs and text numbering; source redirect/rebind;
quotes; identifiers that collide; and source-less legacy Books. Roundtrip through
the native tables and canonical readers must preserve these cases. Unknown source
enum/schema changes pause that mapping rather than silently dropping fields.

The same gate requires a same-name universe/franchise/series fixture, two
continuities within one franchise, and a commentary item that is `about` a
universe without being set in it. Preserve independent memberships, evidence,
ordering and behavior targets through native edit/query/export/history/restore.
Prove owner-routed Unit lookup, wrong-owner/dangling-reference rejection,
concurrent ownership conflict handling and locator rebuild from authoritative
records. The final target must have no runtime FK/read/write dependency on the
retired global `unit` table. Schema inventory plus actual service-path tests are
required; a document or table-name search alone does not qualify this gate.

For every growing family, model 500M and 3B rows separately, plus child fan-out.
Illustrative object-scale amplification at N identities (decimal, excluding
indexes, payloads and revisions):

| Family | Rows | Illustrative bytes/row | At N=500M | At N=3B |
| --- | --- | ---: | ---: | ---: |
| Owner-local identities, summed across owners | N | 160 | 80 GB | 480 GB |
| Named forms | 8N | 160 | 640 GB | 3.84 TB |
| Typed facts | 12N | 160 | 960 GB | 5.76 TB |
| Relations | 20N | 240 | 2.4 TB | 14.4 TB |
| Participants | 3 per relation = 60N | 144 | 4.32 TB | 25.92 TB |
| Source records | 2N | 128 | 128 GB | 768 GB |
| Observation headers | 6 per source record = 12N | 160 | 960 GB | 5.76 TB |
| Fact supports | 2 per fact = 24N | 96 | 1.152 TB | 6.912 TB |

These are planning inputs, not measured widths or deployment qualification. P10's
ledger must add actual distributions, revision/support multiplicities, indexes,
WAL, rates, skew, concurrency, network, cache and rebuild/backup reserve. Use
selective owner/reverse indexes, keyset pagination, bounded admission/batches and
owner-routed partition/shard cutovers. Test million-occurrence/credit/name owners;
a 64-entry request or document limit is not an admissible lifetime catalog cap.
A monthly scan of 3B source objects already needs about 1,157 objects/s, so the
initial 50 normalized objects/s target is not a full-scale sweep claim.

Identity splitting does not remove routing cost. An illustrative locator budget
of 64 B heap + 48 B index per ID adds 56 GB at 500M IDs and 336 GB at 3B, excluding
bloat, WAL, replicas and backups. Charge grouping identities to N and their member,
context, order-profile and evidence rows separately; a million-member franchise
is a hot-owner case, not a bounded configuration set. Locator lookup is keyed,
batch resolution has explicit count/byte caps, and rebuild proceeds by owner/key
checkpoints into a new generation. P10 must measure indexed read/write rates,
concurrent publication, cache misses, stale-routing repair, p95/p99 latency,
WAL/index amplification and cutover headroom before choosing physical buckets.
No request or recurring repair may rebuild all identities or all descendants.

The current milestone is complete only after physical DDL/migrations, all four
coverage matrices, native roundtrips and queries, legacy conversion rehearsals,
affected API/SDK/type checks and representative plans pass. Production rights,
live inventory, recovery and human product acceptance remain activation gates;
they must not redirect local development back to unrelated maintenance.
