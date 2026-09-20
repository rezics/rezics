# Source converter conformance

Owner: M07, with M02/M04/M09 for semantic interoperability. Native meaning is
defined by [catalog architecture](../architecture/database/catalog-model.md), not
by the union of providers. [Interoperability](../architecture/semantic-interoperability.md)
defines a separately activated full-index profile; first-stage domains require their elected source/native query and exchange contracts. Converter tests target the intended model without preserving old REZICS
wire/storage contracts; elected external source contracts still require conformance.

Use [native Work/release acceptance](native-work.md) for all creative domains and
[composition acceptance](content-composition.md) for imported local uses. A
provider's musical Work, recording, film cut, software release or book edition
requires an explicit native scope mapping; preserving source distinctions does
not exempt that domain from the common Work contract.

## Required provider surfaces

| Provider / profile | Source and native coverage; difficult cases |
| --- | --- |
| MusicBrainz | Work/recording/release group/release, media/tracks/credits, supporting entities, TOCs, labels/events, alternative presentations, incomplete candidates and redirects. |
| Cover Art Archive | Multiple artwork uses/types, main-front versus role, release origin for group representatives, representations/locations and source approval evidence. |
| VNDB | VN/content/releases, names/aliases, contribution contexts, character/voice roles, tags/traits/quotes, image/screenshot applicability, API/dump joins and complete aggregates. |
| Bangumi | Subject grain, names/descriptions, episodes, characters/people, multi-party voice relations, archive/API-only relationships, fixed profiles and elected infobox semantics. |
| Open Library and elected book sources | Explicit conceptual-work/text/ISBN-edition mappings to REZICS virtual Work evidence and external publications; contributors, translation/serialization, covers, series and native scenarios absent from one provider. |
| AO3-oriented creative input | Functional/content examples for native creation and export; elect acquisition/import formats explicitly rather than assuming a universal source API. |
| Schema.org full-index follow-on | Pinned normative vocabulary including retired terms, JSON-LD/Microdata/RDFa input profiles, multiple types, named/anonymous graphs, collections, Role structures and mixed vocabularies; native mapping and public JSON-LD are separate outputs. |
| Wikidata full-index follow-on | Complete statements and datatypes across Items, Properties, Lexemes/Forms/Senses and EntitySchemas; terms, sitelinks/badges, rank, snak states, qualifiers/reference groups, revisions, redirects, dumps and incremental reconciliation. Inventory each namespace's acquisition surface. |

The current [source artifact inventory](../../libraries/content-adapters/contracts/catalog/artifacts.lock.json) and [field inventory](../../services/main/src/services/catalog/source-contracts/fields.jsonl) are inputs to reviewed mapping. Declaration counts, raw dumps and old reports are not evidence that every field is supported.

The complete Schema.org/Wikidata inventories remain separately activated
implementation/verification deliverables. Selected Recipe/Book/domain exchanges
are first-stage profiles, with their own coverage; neither SEO output nor a VNDB
Wikidata link qualifies the full-index target.

## Live acquisition and validation

External-site compatibility follows current upstream APIs and official contract
surfaces, including VNDB, Bangumi, MusicBrainz and elected book sources. Each live
run fetches fresh inputs into ignored provider input/generated directories and
runs structural, field-disposition, parsing and native-mapping checks. API samples
qualify only the observed fields/surfaces; current official schema/dump contracts
cover additional elected surfaces explicitly. Downloads never execute upstream
SQL or package content.

Git owns acquisition definitions, scripts, authored native mappings and meaningful
synthetic regression cases. Fetched source documents, response samples, generated
field inventories and run reports are ignored. No fixed remote commit, API dataset
revision or expected content hash is a prerequisite for the next live run. Record
request URL/fieldset, acquisition time, response status and byte digest in the run
receipt for diagnosis/replay; these observations are not future-version pins.

A run must not mix partially refreshed inputs with a prior complete acquisition
and present them as one successful current dataset. Failed fetch, malformed data,
uncovered fields, changed shapes and conversion losses have distinct diagnostics.
Do not silently reuse stale cache or auto-accept a changed field to pass a check.
Repair the parser, mapping or explicitly elected coverage when drift is found.
Use bounded downloads/pagination and upstream rate limits; full-corpus acquisition
is separate from a bounded compatibility run.

Deterministic parser/domain tests remain independent of network availability.
They test authored semantic and failure cases, not frozen upstream compatibility.
A live failure leaves current-site qualification incomplete; an offline pass does
not override it. Normative vocabulary pins, native revision evidence and released
migration history are outside this external-site validation policy.

| Case | Required live-tool behavior |
| --- | --- |
| LIVE01 | Fetch each elected provider from current URLs on a new run even when an older local input exists; retain a run receipt and bounded input sizes. |
| LIVE02 | Change source bytes between runs without changing a committed expected hash; accept structurally valid acquisition and expose field/shape drift for mapping review. |
| LIVE03 | Reject failed HTTP, timeout, malformed/oversized payload and incomplete multi-input acquisition; no stale-cache success or mixed-generation inventory. |
| LIVE04 | Regenerate inventories in ignored storage from one complete acquired run; offline replay identifies that run and makes no current-site freshness claim. |
| LIVE05 | New, removed or shape-changed fields produce exact-path diagnostics; existing decisions cannot silently qualify changed semantics and unreviewed fields remain visible. |
| LIVE06 | Retain exact authored native evidence and rejected-state/semantic regressions independently of changing external bytes; provider downloads never execute code. |
| LIVE07 | Report actual source/surface/fieldset coverage and native gaps; acquisition/parse success cannot become full native-conformance success. |

## Per-field disposition

Every elected source field/object records its observed source contract/run, source
identity/meaning, native mapping where applicable, owning commands, queries,
exports and acceptance case. Track four independent dimensions:

| Dimension | Required outcome |
| --- | --- |
| Preservation | Exact retained input receipt and complete parsed semantics, or explicit incomplete/withheld/rejected outcome. |
| Source query | Supported operations and indexes, generation and completeness; distinguish source-indexed, raw-only and unsupported. |
| Native mapping | Native-mapped, source-only evidence/statistic, intentionally excluded-private/operational, or unresolved; mapped subsets retain residual source semantics. |
| Export | Exact profile and preserved, transformed, omitted or unrepresentable constructs with reasons. |

A raw-only value cannot claim source-query or native searchable coverage. A
source-indexed value without a native mapping can pass the source-query gate.
Unsupported/ambiguous infobox labels remain explicit evidence until their meaning
is defined. Rejected or unknown constructs stay in the scoped coverage denominator;
report inventory coverage separately from frequency-weighted record coverage.

Preserve source-specific vocabulary before applying standards normalization. Distinguish a source role from native authority, a source statistic from native votes, and source officialness from an evidenced issuing authority. Source user accounts, credentials and individual private activity are excluded from native account/participation creation.

## Stateful workflow

1. Dynamically acquire bounded current source inputs, validate their actual shape and record the run and fieldset completeness. Reuse that run locally for deterministic downstream diagnosis; later live runs fetch again.
2. Normalize through the provider adapter while retaining exact source references and unknown/absent/null/zero distinctions.
3. For semantic-interoperability profiles, seal the parsed source representation and index generation; query it before any native mapping exists.
4. Apply elected mappings through native commands and capture all newly produced identities/revisions; query expected objects, roles, context, version, media and evidence. Retain explicit source-only outcomes for unmapped subjects.
5. Export each elected source-preserving/native/vocabulary profile and compare its required distinctions and declared losses, not only row counts.
6. Repeat import, apply an update, withdraw, reapply and replay out of order.
7. Interleave independent source support, same-value human confirmation, rebind/pause, authority revocation and stale workers.

## Mandatory regressions

- Narrow API responses cannot erase fields from a complete dump; fieldset/surface precedence is explicit.
- Record-level and child-local identity survives reorder; reused/unstable source IDs do not alias new referents.
- Source redirects are not native merges; source bindings do not transfer permission or provenance.
- Source withdrawal retracts only owned support and cannot undo intervening human edits.
- Whole-record large applications stage bounded parts and dependencies; activation checks all epochs and complete correspondence.
- Missing relation parents, partial tracklists, unknown dates/languages and conflicting declarations survive export.
- Bangumi Infobox unions/nullability and fictional dates use reviewed native meanings, not arbitrary key renaming.
- VNDB dump tag/Wikidata joins and API/dump aggregate coverage are explicit, bounded and source-qualified.
- MusicBrainz secondary/alternative/candidate updates and media merge/split retain exact revisions and independent recordings/credits.
- Artwork removal, new encodings and changed remote locators preserve source/native selection boundaries.
- An upstream conceptual Work ID does not automatically create or merge a primary REZICS Work; retain reviewed correspondence, source-only and unresolved cases.
- Publisher ISBN/format/territory/language changes affect the mapped external publication, not the Work's identity or independently adopted community translations.
- Metadata-only sources do not manufacture identical-text assertions or dummy content; multiple same-language contributions and unknown correspondence survive roundtrip.
- Repeated book-content targets retain manifest-qualified occurrence identities through import/update/export; native virtual Work and multi-work text containers use explicit bibliographic export mappings.
- Observation alone does not advance a published native selection. Test native adoption and publication as separate transitions, including policy-authorized automatic proposals and revoked subscriptions.
- Source structure refresh preserves base/source/local correspondence and destination occurrence identity; source edits cannot silently replace local labels/order or published child versions.
- Repeat these flows for album tracks, audiovisual cuts/subtitles and game/software builds/localization, not only Book; community contributions and unrelated uses survive withdrawal.

## Schema.org and Wikidata acceptance

These are follow-on contract scenarios, not first-stage prerequisites or executed evidence. Their test authoring/execution follows the [phase policy](../plan/execution-workflow.md). Record each run's original input, model/vocabulary revision, processing options/context bytes, expected source representation, queries, native disposition and each export. Current external inputs follow live acquisition rather than fixed future-run pins.

| ID | Scenario | Required result |
| --- | --- | --- |
| SIO01 | Full vocabulary/profile inventory, including retired and mixed external terms | All scoped terms, syntaxes and datatypes have independent preservation/query/native/export outcomes; Item-only or JSON-LD-only coverage cannot claim full compatibility. |
| SIO02 | Schema.org Book/Product, multiple inheritance, Role intermediary and text where a referent is expected | Preserve all descriptions without an invented Work, Person or closed-world rejection; diagnostics and native mapping remain separate. |
| SIO03 | Equivalent admitted descriptions in JSON-LD, Microdata and RDFa | Each extractor preserves source locations/base/identity and the profile's semantic result; unsupported extraction remains an explicit coverage gap. |
| SIO04 | Named graphs containing identical triples, repeated blank-node labels across documents, aliases, relative/reverse IRIs and captured contexts | Scope anonymous nodes and statements correctly, preserve graph context and original spelling, replay without live context drift; context-fetch/expansion failures cannot look complete. |
| SIO05 | Unordered values, repeated literal/node list members, RDF collections/containers, JSON/language/direction-bearing literals and discarded JSON-LD null | Preserve grouping, cardinality, order only where defined and lexical data; no invented statement for ignored syntax; a plain RDF projection reports any loss under its selected profile. |
| SIO06 | Two same-property Wikidata statements with different dates, repeated qualifiers and structured references without URLs | Retain statement IDs and complete qualifier/reference groups; filters cannot combine qualifiers across statements or snaks across reference groups. |
| SIO07 | Value, somevalue, novalue, missing property, partial fieldset, failed fetch and erased payload | Each remains distinct through source query, mapping and export; existential unknown and explicit no-value never collapse into absent/null. |
| SIO08 | Preferred/normal/deprecated coexistence, changes and withdrawal | Complete source view retains all ranks; best-rank view follows the source rule; native acceptance requires its own decision and independent support survives. |
| SIO09 | High-precision quantity/bounds/unit, BCE dates, coarse precision/calendar and non-Earth coordinates | Preserve source representation and conversion rules; no floating-point authority, fabricated exact date, BCE off-by-one conversion or lost globe. |
| SIO10 | Property with statements; Lexeme with repeated-spelling Forms, multiple Senses and cross-lexeme references; EntitySchema | Preserve all entity kinds, parentage, terms and statements/shape revisions through separately qualified surfaces; no automatic Tag Sense equivalence or native schema execution. |
| SIO11 | External subject outside native domains; ambiguous Q ID/identifier/sameAs/redirect/edition correspondence | Subject is queryable without native identity; reviewed mappings may be multiple or unresolved; no automatic merge, permission transfer or fabricated Work parent. |
| SIO12 | Rare/dense/unknown terms, oversized values, reverse references and statements exceeding ordinary page size | Minimum operations have real indexes, correct typed rechecks and bounded continuation; every supported property is queryable, and unknown value semantics remain visible gaps. |
| SIO13 | Dump installation with overlapping changes, duplicate/out-of-order notifications and API fetch returning a newer revision | Receipts pin actual data revisions; no head regression or missing activation parts; dataset completeness and synchronized freshness are distinct. |
| SIO14 | Expired stream cursor, unavailable namespace, source delete/restore and HTTP/query omission | Report degraded coverage until reconciliation; omissions do not manufacture tombstones, and older replay cannot resurrect withdrawn support. |
| SIO15 | Source-preserving, native-semantic, Schema.org and Wikidata JSON/full-RDF/truthy exports | Enforce each profile's fidelity and declared losses; truthy cannot reconstruct full statements, native-only objects get no fabricated upstream IDs, no upstream writes occur. |
| SIO16 | Private source input or mapping, unrelated intake under a native proposal grant, revoked export, hidden counts/snippets and erased data restored from backup | Current source/native authority gates each command, view/part and mapping overlay; restore replays erasure frontier before serving; no stale-index disclosure or expanded grant. |
| SIO17 | Crash/cancel during large record, index generation switch or export; incompatible generation cursor | Old complete generation stays available; retry effects and receipts are idempotent, partial staging is not complete and stale cursors request restart. |
| SIO18 | Skewed statement/reference/list degrees, multilingual widths, sustained refresh, bulk bootstrap and restore | Measure the additional 500M/3B envelope, postings, memory, WAL, queue age and recovery; existing native workbook totals or toy fixtures do not qualify capacity. |

For SIO09/SIO10 include every datatype in the pinned inventory, including resource
references, mathematical expressions and musical notation. Raw payload preservation
does not prove typed query support. Full acceptance requires no unexplained loss
for valid in-scope constructs and explicit handling of malformed/unsupported inputs.
Coverage reports identify excluded namespaces and syntax profiles, rather than
quietly removing them from a claim about the complete target.

## Data acquisition

Investigate primary schemas, official dumps, public APIs and native source code. Pin artifacts, retrieval parameters, checksums, source contracts and normalization versions. Acquisition and data regeneration follow the [execution policy](../plan/execution-workflow.md). Public large datasets remain reproducible network inputs; deterministic CI uses committed compact fixtures. Record live-site failure separately from native deterministic behavior.

Primary source entry points: [MusicBrainz schema](https://musicbrainz.org/doc/MusicBrainz_Database/Schema), [CAA](https://musicbrainz.org/doc/Cover_Art_Archive/API), [VNDB Kana](https://api.vndb.org/kana), [Bangumi archive](https://github.com/bangumi/Archive), [Open Library](https://openlibrary.org/developers/api). These support source distinctions, not automatic acceptance of our converters.

[Interoperability source specifications](../architecture/semantic-interoperability.md)
own the Schema.org/Wikidata evidence and profile distinctions. Bootstrap from
current captured complete artifacts using bounded streaming; deterministic regressions must
not depend on public WDQS, changing remote contexts or live source availability.
