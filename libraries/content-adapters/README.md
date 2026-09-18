# Content adapters and provider contracts

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

`contracts/catalog/artifacts.lock.json` lists 45 exact-byte SHA-256-pinned inputs
and the live [VNDB `/schema`](https://api.vndb.org/kana#simple-requests) endpoint.
`contracts/{provider}/inputs/` restores them by URL. Every network preparation
fetches the latest VNDB response and validates its structure and inherited fields,
without claiming a fixed checksum; only its unordered external-link arrays and
JSON object keys are normalized. New VNDB fields still need a reviewed inventory
and coverage update. The other 45 inputs retain exact upstream bytes. Generated
contract inventories live in `generated/`; both directories are ignored by Git.
The inventories preserve fields, syntax, references and unknown facets
for adapter development. There is no provider-contract database schema and no
native DDL/migration command in this package. Native field dispositions remain in
main's source-contract owner with their independent evidence requirements.

```sh
task artifacts:prepare # fresh checkout: fetch pins and regenerate both packages
task libraries:content-adapters:fetch-contracts -- all
task libraries:content-adapters:contracts -- all
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
