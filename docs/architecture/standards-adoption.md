# Standards adoption and model profiles

Status: selected model with first-stage scope revised on 2026-09-20. Runtime
activation follows the [plan](../plan/README.md). [Schema modeling](schema-modeling.md)
owns the native model; [semantic interoperability](semantic-interoperability.md)
owns the separately activated full Schema.org/Wikidata source-instance target.

## Semantic Web reference

The [Semantic Web](https://en.wikipedia.org/wiki/Semantic_Web) is an important
conceptual reference: give data explicit machine-processable meaning and connect
descriptions across sources using identifiers, vocabularies and relationships.
Use primary specifications for technical decisions. [RDF](https://www.w3.org/TR/rdf11-concepts/)
defines graph statements and typed/language-tagged values; RDFS/OWL describe
vocabulary and entailment, and JSON-LD supplies one exchange syntax. These are
distinct responsibilities, not a requirement to implement one universal platform.

First-stage adoption is driven by the [elected domains](database/catalog-model.md#first-stage-compatibility):
stable identity, multilingual names, explicit relations/occurrences, provenance,
needed value semantics and reviewed exchanges. Preserve the existing vocabulary
compiler and useful mappings. Complete Schema.org/Wikidata source indexing,
all-syntax extraction, general SPARQL/OWL processing and unrelated specialty
workflows do not gate first-stage product delivery. A Resource remains a native
managed object; it is not coextensive with everything RDF can denote.

The families below retain their modeling dispositions. Implement a family's
operations when an elected product contract requires them; listing a family does
not activate its entire standard. Recipe is a native first-stage domain, with
[its own operations](database/recipes.md), rather than only a generic-model example.
Provider contracts and live compatibility checks follow current upstream APIs in
ignored run inputs; normative vocabulary pins remain compiler dependencies.

## Decision and evidence

Use external standards for their stated meaning and exchange responsibilities,
with reviewed mappings to native contracts. Do not choose an all-purpose ontology,
one table per class, or a universal triple store by default. Every existing product
domain needs a model disposition, including private and operational state.
Specialty operations may remain inactive without leaving source values unexplained.

The maintainer's 2026-09-19 survey was reviewed as research input, including its
limits and alternatives. Its 188 index entries include families, repeated topics
and 26 radar candidates; they are not 188 adopted or fully audited standards.
Primary references below own the supporting semantics. The temporary report is
not a build/document dependency and remains user-provided material.

Local inspection baseline: `e528fe0a824d7eefb1cad4397b942727392d70c1`.
The [source manifest](../../libraries/schema-importer/sources/manifest.json) contains
12 pinned artifacts: RDF, RDFS, OWL, Schema.org 30.1, SKOS, PROV-O, Web Annotation,
DCMI Elements/Terms/Type, BIBFRAME and SHACL. XSD support is an explicit implementation
subset, not a complete XML Schema processor. BIBFRAME artifact 3.0.1 does not rename
the BIBFRAME 2.0 conceptual model. Namespace snapshot dates are not specification
release dates. Existing [content adapters](../../libraries/content-adapters/README.md)
also cover provider/exchange formats outside this ontology manifest.

The six additional families ActivityStreams, DCAT, OWL-Time, QUDT, GeoSPARQL and
SOSA/SSN are selected modeling/profile work, not newly installed artifacts. This
documentation update changes neither their manifest pins nor qualified support.

## Required model responsibilities

| Family and primary source | Native responsibility and selected boundary |
| --- | --- |
| [RDF 1.1](https://www.w3.org/TR/rdf11-concepts/), [RDFS](https://www.w3.org/TR/rdf-schema/), [OWL 2](https://www.w3.org/TR/owl2-overview/), [XSD 1.1](https://www.w3.org/TR/xmlschema11-2/) | Terms, graph/dataset/source-node scope, typed values and retained axioms. Declare actual entailment/validation; a graph name is not automatically its author or accepted truth. |
| [Schema.org](https://schema.org/docs/datamodel.html), [Recipe](https://schema.org/Recipe) | Complete pinned vocabulary and usable generic descriptions, including unmapped classes. Preserve flexible values, multiple types and list/set/occurrence distinctions; specialized workflows have separate acceptance. |
| [SKOS and SKOS-XL](https://www.w3.org/TR/skos-reference/) | Concepts, schemes, labels and mappings. Concept hierarchy is not automatic class inheritance; preferred-label cardinality is not a limit on native aliases. |
| [PROV-O](https://www.w3.org/TR/prov-o/) | Exact inputs/outputs, activities, responsible agents and derivations. Provenance, signature validation, assessment and acceptance have different authorities. Private operators do not become public provenance by default. |
| [Web Annotation](https://www.w3.org/TR/annotation-model/), [Media Fragments](https://www.w3.org/TR/media-frags/) | Body, target, exact representation/revision, selector and state. Preserve coordinate units and failed/reviewed relocation rather than silently targeting latest content. |
| [DCMI Terms](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/) | Common metadata mappings. Elements, Terms and Type namespaces remain distinct; rights descriptions do not execute grants. |
| [BIBFRAME](https://www.loc.gov/bibframe/docs/bibframe2-model.html), [IFLA LRM](https://www.ifla.org/wp-content/uploads/2019/05/assets/cataloguing/frbr-lrm/ifla-lrm-august-2017_rev201712.pdf) | Work/content realization/publication/item and named-form grain comparisons. Native Work, BIBFRAME Work and LRM Work are not unqualified equivalents; source records remain separate. |
| [BCP 47](https://www.rfc-editor.org/rfc/rfc5646), [language matching](https://www.rfc-editor.org/rfc/rfc4647), [string metadata](https://www.w3.org/TR/string-meta/), [Unicode normalization](https://www.unicode.org/reports/tr15/) | Open content-language identity, direction, multiple same-language names and explicit fallback. Normalization, translation/transliteration and search/display selection are separate operations. |
| [ActivityStreams 2.0](https://www.w3.org/TR/activitystreams-core/) | Public activity exchange. Native commands, content revision, audit and delivery attempts retain separate models; ActivityPub federation is not implicitly activated. |
| [DCAT 3](https://www.w3.org/TR/vocab-dcat-3/) | Dataset, Catalog, Distribution and DataService. Dataset serialization is not a music release or commercial package. |
| [OWL-Time 2017](https://www.w3.org/TR/2017/REC-owl-time-20171019/), [EDTF](https://www.loc.gov/standards/datetime/) | Instants, intervals, precision, uncertainty and temporal reference systems. Valid/recorded/observed/result times differ; do not invent exact midnight for a year-only date. |
| [QUDT](https://www.qudt.org/pages/QUDToverviewPage.html), [UCUM](https://ucum.org/ucum) | Quantity kind, exact value, measurement unit and conversion profile. Preserve original units; dimensional compatibility is not universal semantic interchangeability. |
| [GeoSPARQL 1.1](https://docs.ogc.org/is/22-047r1/22-047r1.html), [GeoJSON](https://www.rfc-editor.org/rfc/rfc7946) | Feature versus geometry, CRS and axis interpretation. Unsupported CRS or fictional coordinates must not be mislabeled as a GeoJSON Earth geometry. |
| [SOSA/SSN](https://www.w3.org/TR/vocab-ssn/) | Observation, feature/property, procedure/instrument, result and distinct times. A crawl or source assertion is not automatically a physical observation. |

All rows need explicit representation and source-preservation dispositions.
Selecting their model responsibilities does not put every module on every write
path or promise complete inference, conversion, spatial queries or sensor workflows.
Pin normative documents, artifacts and profiles before admitting new implementations.

## Contract and tooling choices

| Evidence | Decision and applicability limit |
| --- | --- |
| [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/json-schema-validation) | Use an explicit structural-validation dialect, including whether `format` is annotation or assertion. Shapes do not prove current authority or transaction correctness. |
| [SHACL 2017](https://www.w3.org/TR/shacl/) | Keep the selected stable baseline. The current direct-triple export has documented losses; that is a limitation of that projection, not of every possible SHACL relationship-node model. Newer RDF/SHACL features need separate profiles. |
| [LinkML](https://linkml.io/linkml/intro/overview.html) | Its class/slot/mapping and multi-generator model is useful comparison evidence. Retain the existing typed TS authoring/compiler and one native IR; do not maintain independent LinkML and TS authorities. Reconsider a tool change only against actual missing capabilities. |
| [R2RML](https://www.w3.org/TR/r2rml/) | Useful for relational-to-RDF read/export mappings. It does not establish inverse update mappings, native commands or lossless arbitrary import. |
| [UUID](https://www.rfc-editor.org/rfc/rfc9562), [URI](https://www.rfc-editor.org/rfc/rfc3986.html), [URI Templates](https://www.rfc-editor.org/rfc/rfc6570.html), [HTTP](https://www.rfc-editor.org/rfc/rfc9110.html) | Identity, URL syntax, link expansion and protocol behavior inform the native address contract. UUID order is not commit order; a template alone does not choose routing precedence or authorization. |

Keep normative maturity, artifact version and tool compatibility independent.
Do not upgrade OpenAPI, RDF, SHACL or authentication implementations solely because
a later specification exists. A dated stable baseline is not a claim to be latest;
any new dialect needs affected consumer and conformance evidence.

## Domain exchange and conditional adoption

These are explicit research/adoption boundaries, not installed dependencies or
claims that all referenced formats have been implemented.

| Domain | Existing or candidate profile families | Required distinction |
| --- | --- | --- |
| Publishing and scholarly records | Existing Open Library/BIBFRAME paths; LRM/LRMoo, MARC/MODS, JATS/TEI, CSL, DataCite/Crossref, CRediT and selected SPAR modules | Native Work, translation/text, publication, copy, citation rendering and source record have different grains. ONIX/MADS and authority manuals need precise source/schema review before field mappings. |
| Names and identifiers | Existing namespace policies; DOI/ISBN/ISSN, ORCID/ROR, ISRC/ISWC, repository-qualified Wikibase identities | Identifier syntax or authority-directory presence does not establish identity equality, account control or permission. Preserve collision and assignment histories. |
| Music and audiovisual media | Existing MusicBrainz/CAA/Bangumi/VNDB paths; IIIF, Media Fragments, timed text, IPTC/PBCore; DDEX/EBUCore upon elected exchange | Work, recording/cut, track occurrence, platform listing, asset, encoding and delivery are separate. Repeated credits/tracks and original spelling survive mappings. |
| Software and Hub | Existing providers/registry contracts; [CodeMeta](https://codemeta.github.io/), [CFF](https://citation-file-format.github.io/), [purl](https://packageurl.org/), [SPDX](https://spdx.dev/), [CycloneDX](https://cyclonedx.org/specification/overview/), SWHID/OSV | Project/repository, release, package coordinate, build/artifact and attestation differ. Version comparison follows its ecosystem; digest equality does not grant rights or execution. |
| Documents and accessibility | Existing Block/Portable Text; CommonMark, EPUB, IIIF, Web Annotation, JATS/TEI | Authoring structure, source syntax and published representation differ. Preserve language, alternatives, captions, structure and exact selectors; metadata is not an accessibility certification. |
| Community and identity | ActivityStreams; ActivityPub/WebFinger/WebSub only when federation is selected; existing OIDC/OAuth/WebAuthn owners | Public actor, private principal, representation, public activity and transport delivery remain distinct. This revision does not activate federation or replace the authorization engine. |
| Quality, alignment and rights | Existing assessment/acceptance; DQV, SSSOM, ORG, ODRL, signature/credential profiles when needed | Confidence, signature, source rank, factual acceptance and executable authority must not collapse into one trust flag. |
| Preservation and datasets | DCAT/PROV; [RO-Crate](https://www.researchobject.org/ro-crate/specification/1.1/), [BagIt](https://www.rfc-editor.org/rfc/rfc8493), WARC/PREMIS/METS, CSVW, Arrow/Parquet as elected profiles | Packaging/fixity, semantic meaning, query layout and retention are separate. Private erasure/recovery obligations still apply to snapshots and exports. |
| Operations and collaboration | Native jobs/leases/receipts/outbox; CloudEvents/Trace Context/OpenTelemetry; CRDT/local-first only for selected content | Trace IDs are not operation IDs. Mergeable content does not prove slug uniqueness, publication admission or revoked authority. |
| Specialty extensions | FoodOn, LRMI, Darwin Core, health/industrial/financial profiles and other radar candidates | Retain explicit generic/source dispositions. A candidate reference is not adoption, domain completeness or permission to execute a new business workflow. |

The detailed native owners remain authoritative. Do not create another parallel
provider importer because a format is absent from the ontology manifest, or copy
the survey's optional catalog into mandatory runtime dependencies.

## Artifact, mapping and support records

An admitted source records normative document/status, artifact URI/version/commit,
retrieval date, bytes/hash, namespaces/dependencies, parser profile, licenses and
known limitations. Specification, vocabulary, source data and implementation-tool
rights are separate records. Historical definitions remain interpretable after
upstream retirement. Ordinary compilation uses pinned local inputs.

Coverage records independent, versioned dimensions: artifact preservation,
vocabulary indexing, source-instance parsing/preservation, generic instance
operations, native mapping, validation/entailment, queries, exports, workflows and
executed evidence. No single supported boolean or vocabulary count substitutes
for this matrix. Missing artifacts and inactive runtime profiles remain explicit.

Every mapping records direction, grain, reference policy, language/value/collection
semantics, authority and residuals. Use explicit exact, native-specialized,
descriptive-only, source-preserved, derived-projection, lossy or unsupported
dispositions. Simplifying an identified credit into `schema:actor` must report any
lost role, language, version, qualifier, source or occurrence information.

Extend existing manifest/registry/traceability outputs rather than introducing
duplicate handwritten inventories. Test evidence pins fixture, model/source/profile,
tool versions, environment, expected and actual results. Counts from
[the 2026-09-18 evidence](../testing/schema.md) describe that scope and revision only.
The [new acceptance cases](../testing/model-contracts.md) have not been executed.
