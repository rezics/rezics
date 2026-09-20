# Content adapters and provider contracts

External-site compatibility follows [live validation](../../docs/testing/source-conformance.md#live-acquisition-and-validation): fetch current API/contracts, retain ignored run inputs and diagnose declaration drift. Normative vocabulary pins remain in schema-importer.

These sources describe **external content**, not REZICS's schema design. This owner
contains shared parsers, format contracts and exchange conversion. Standards/model
compilation belongs to [`schema-importer`](../schema-importer/README.md).

| Source | Input contract/reader | Native content writer |
| --- | --- | --- |
| Bangumi | OpenAPI/JSON Schema, archive declarations and source vocabularies | Main catalog's `bangumi-*` acquisition/planning/adoption owners |
| MusicBrainz | Table/key SQL interpreted as provider format documentation | Main catalog's `musicbrainz-*` acquisition/dependency/adoption owners |
| VNDB | Kana field registry | Main catalog's `vndb-*` acquisition/planning/adoption owners |
| Open Library | `.type` documents and reverse-property declarations | Main catalog's `openlibrary-*` acquisition/planning/adoption owners |
| Wikibase | Items/Properties/Lexemes/Forms/Senses/MediaInfo JSON | `readers/wikibase.ts` preserves structured occurrences; native adoption is a separate mapping decision |
| IIIF | Presentation 3 manifests/collections | `readers/iiif.ts` preserves ordered resource/selector occurrences; a Canvas is not a binary file |
| Media Fragments | URI temporal/spatial/track/named selectors | `readers/media-fragments.ts` retains exact strings and explicit dimensions |

The existing native provider workflows remain in the
[main catalog owner](../../services/main/src/services/catalog/README.md). Shared
reader reuse does not imply all external fields have approved native mappings.
Provider schemas can reveal missing capabilities and drive conformance tests,
but cannot create native tables or decide native referent/identity automatically.

`contracts/catalog/sources.json` contains acquisition definitions with current
upstream URLs and no expected upstream-content hashes. Each network preparation
fetches every selected input anew. Raw responses and their observed digests/times
are stored under ignored `contracts/catalog/inputs/runs/<run-id>/`; `current.json`
is replaced atomically only after all selected inputs are acquired and parsed.
Failed runs retain diagnostics and cannot publish a partial current acquisition.
A provider-only capture cannot supply an all-provider conversion. This capture
is bounded local observation, not a transaction spanning all upstream services.

Conversion verifies the recorded run's bytes, retains VNDB unordered-link/key
normalization separately from raw evidence, and writes ignored `generated/`
inventories. Offline replay identifies its captured run and makes no claim that
it has contacted the site again. New fields and changed shapes still require
reviewed native dispositions; acquisition/parse success is not native conformance.

The main source owner generates ignored declaration files and run reports from the
same acquisition. Git retains scripts, current URL definitions, authored mapping
expectations and native evidence. There is no provider-contract database schema
or native DDL/migration command in this package.

```sh
task artifacts:prepare # restore vocabularies, fetch current providers, generate local outputs
task libraries:content-adapters:fetch-contracts -- all
task libraries:content-adapters:contracts -- all # replay the completed local acquisition
task services-main:catalog:sources:live -- --inspect # fresh inputs and explicit pending mappings
task libraries:content-adapters:convert -- wikibase /absolute/entity.json /absolute/result.json
task libraries:content-adapters:convert -- iiif /absolute/manifest.json /absolute/result.json
task libraries:content-adapters:convert -- media-fragments 'https://example.org/video#t=1.25,9'
```

Conversion preserves unknown/no-value distinctions, repository-qualified external
IDs, original numeric/time lexical values, occurrence order, qualified references
and raw records. It does not equate source rank with acceptance, guess unidentified
referents, execute downloaded SQL or grant application capabilities. Unsupported
entity profiles fail explicitly. The source contract inventory is not a claim of
complete content acquisition, native adoption or corpus-scale indexing.
