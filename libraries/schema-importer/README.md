# Schema importer

`@rezics/schema-importer` is the independent conversion tool. It consumes upstream
machine schemas, produces reproducible semantic/structural declarations, and
imports them through the [complete Drizzle model](../schema/README.md). It does
not generate an unrelated per-provider production database or execute upstream SQL.

## Source and file ownership

| Input | Reader | Output |
| --- | --- | --- |
| Schema.org **30.1 all terms** | `readers/rdf.ts` | Every definition, enum member, deprecated term, multilingual label, RDF node and statement; 940 class profiles follow full multiple inheritance. |
| RDF, RDFS, OWL, SKOS, PROV-O, Web Annotation, DC Terms/Type/Elements, BIBFRAME **3.0.1** | Same bounded RDF parser/canonicalizer | Complete pinned graphs, referenced datatypes, release/meaning/label identities. |
| Bangumi OpenAPI/JSON Schema, archive and vocabularies | `readers/json-schema.ts`, `readers/bangumi.ts` | Component and operation schemas, composition, references, keywords, exact syntax, all archive fields and vocabulary tree nodes. |
| MusicBrainz table/PK/FK SQL | `readers/postgres-ddl.ts` | Columns/types/defaults/nullability and complete table/key constraints, including composite foreign keys. SQL remains data. |
| VNDB Kana registry | `readers/provider-contracts.ts` | Endpoint fields, selectable nested references, enums/extensions retained in the document contract; undocumented type facets stay `unspecified`. |
| Open Library `.type` files | `readers/provider-contracts.ts` | Properties, expected types, multiplicity, reverse properties and exact document syntax. |
| Wikibase entity JSON | `readers/wikibase.ts` | Item/Property/Lexeme/Form/Sense/MediaInfo identity, statements, exact values, rank, ordered qualifiers and reference groups, revision-local occurrence IDs. |
| IIIF Presentation 3 | `readers/iiif.ts` | Ordered resource/annotation/canvas/body/target/selector occurrences with full original data. |
| Media Fragments URI | `readers/media-fragments.ts` | Temporal/spatial/track/named dimensions with exact strings and preserved extensions. |

`registry/sources.lock.json` pins 11 vocabularies. `sources/catalog/artifacts.lock.json`
is the single provider-schema pin owner, also used by main's native-mapping
inventory. All pinned raw inputs are checked into `registry/sources/` or
`sources/{provider}/inputs/`; `.gitattributes` protects exact source bytes. These
small control-plane artifacts are not content corpora. Provider native-field
coverage remains in main's source-contract owner and is distinct from declaration
preservation here.

The VNDB live schema pin was refreshed on 2026-09-18 after an upstream checksum
change. Fetch never accepts such changes automatically. A changed pin requires
regeneration and review of semantic/native coverage; a larger field count alone
is not acceptance.

`generated/{provider}/contracts.json` contains normalized definitions and full
keyword syntax. `registry/bundle.json`, `profiles.json`, `storage-bindings.json`
and `coverage.json` contain compiled vocabularies and complete dispositions.
`../schema/src/generated/terms.ts` is generated TypeScript. `schemas/` contains
JSON Schema contracts for portable exchange. Do not edit generated outputs.

## Commands

Run from the repository root. Ordinary conversion is offline.

```sh
task libraries:schema-importer:sources
task libraries:schema-importer:fetch       # restore 11 pinned vocabulary files
task libraries:schema-importer:fetch -- all # restore every pinned vocabulary/provider schema file
task libraries:schema-importer:convert -- all
task libraries:schema-importer:convert -- musicbrainz
task libraries:schema-importer:generate   # vocabulary artifacts/profiles/bindings only
task libraries:schema-importer:inspect -- https://schema.org/creator zh-Hant
task libraries:schema-importer:convert -- wikibase /absolute/entity.json /absolute/result.json
task libraries:schema-importer:convert -- iiif /absolute/manifest.json /absolute/result.json
task libraries:schema-importer:convert -- media-fragments 'https://example.org/video#t=1.25,9&xywh=percent:0,0,50,50'
```

Exchange readers convert explicitly supplied documents; there is no hidden dump
crawler. EntitySchema/ShEx parsing, OWL inference, every external datatype's value
space and complete source synchronization are separate capabilities, not implied
by preserving schemas or Wikibase values. Invalid/unsupported entity types fail
explicitly. Original lexical values, `somevalue`, `novalue`, absence and source
ordering must survive conversion. Unresolved external references stay explicit.

After installing the main migration history into the intended database:

```sh
export REZICS_SCHEMA_DATABASE_URL='postgresql://user:password@localhost:5432/rezics'
task libraries:schema-importer:import
task libraries:schema-importer:select -- RELEASE_UUID EXPECTED_VERSION
task libraries:schema-importer:export -- /absolute/export-directory
task libraries:schema-importer:diff -- /absolute/before.json /absolute/after.json
```

Import re-verifies compiled vocabularies and provider contracts against the pinned inputs before writing, then stages immutable releases, structured contracts and description profiles.
Selecting a release is an independent CAS operation (`0` means no prior selection).
A source schema update does not silently adopt content, overwrite translations,
change native cardinality or generate production DDL. Export includes selected
vocabulary releases and original bytes for deterministic reconstruction; it is not
an export of the complete REZICS corpus.

## Adding a schema source

1. Add the exact official artifact URL, digest and format to the owning pin manifest.
2. Implement a reader into `ConvertedContract` or the RDF bundle. Preserve every
   construct or report unsupported semantics; never infer missing constraints.
3. Register the source in `src/sources.ts` and the CLI dispatch. Give every source
   declaration a stable path, a content/version identity, references and keywords.
4. Add a reviewed native storage binding only when the referent/grain/invariants
   agree. Native Drizzle changes go through the main migration owner.
5. Regenerate the complete artifacts and qualify round-trip, rejected inputs and
   real PostgreSQL import/retry/query behavior.

## Verification

The main migration owner installs the complete schema. The importer PostgreSQL
harness uses disposable databases and verifies import/retry/export, raw and
structured graph preservation, source contracts, translation/meaning history,
selection concurrency, invalid references and portable relation transfer. Main
schema tests separately exercise new media/wiki/message/native constraints.
The [verification owner](../../docs/testing/schema.md) records the passing package checks, 17 PostgreSQL scenarios, 30 native integrity assertions, complete replay/drift and the remaining pre-existing main-service IAM failures. The former standalone 18-table checks are historical and are not reused as current acceptance.

Primary source specifications used: [Schema.org](https://schema.org/docs/datamodel.html),
[Wikibase JSON](https://doc.wikimedia.org/Wikibase/master/php/docs_topics_json.html),
[IIIF Presentation 3](https://iiif.io/api/presentation/3.0/),
[Media Fragments](https://www.w3.org/TR/media-frags/),
[RDF canonicalization](https://www.w3.org/TR/rdf-canon/).
