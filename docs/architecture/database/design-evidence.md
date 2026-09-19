# Design evidence and limits

This document records the research basis for the selected [system architecture](README.md), [native Work](native-work.md) and [composition](content-composition.md) contracts. It owns source interpretation, not another implementation plan. The original domain matrices record September 13-14, 2026 research; the integrated-model assessment below is dated September 19. Publication dates, standards approval, prototypes, vendor load tests and reported production deployments are different evidence.

## Integrated model assessment, 2026-09-19

The maintainer's broad standards survey was evaluated against local revision
`e528fe0a824d7eefb1cad4397b942727392d70c1` and selected primary references.
Its index is research input, not a conformance count or an instruction to adopt
all candidate frameworks. Durable decisions live in [modeling](../schema-modeling.md),
[standards/profile adoption](../standards-adoption.md), [storage](resource-storage.md),
[Space](../space-composition.md) and [addressing](../resource-addressing.md).
No maintained contract depends on the temporary research attachment.

| Decision | Evidence and tradeoff | Qualification boundary |
| --- | --- | --- |
| Resource terminology; stable logical owner with replaceable physical binding | [Web architecture](https://www.w3.org/TR/webarch/) separates identity and representation. Resource is a selected native term, not an academically mandated name or a claim that all RDF resources are native objects. | Existing code/wire spellings are recorded in the implementation reference; owner changes require explicit correction, while physical changes preserve logical owner. No global parent is introduced. |
| TS declarations compiled to one native IR | [LinkML](https://linkml.io/linkml/intro/overview.html) demonstrates rich declarations and multiple outputs; retain existing TS/compiler ownership rather than add competing schema authorities. | Compare features and codecs; generated shapes do not prove command, authorization or transaction correctness. |
| Separate StorageBinding and ExchangeMapping | [R2RML](https://www.w3.org/TR/r2rml/) concerns relational-to-RDF mappings; [Beyond Relations](https://vldb.org/cidrdb/papers/2025/p15-deshpande.pdf) explores reversible physical mappings and CRUD. | Neither provides a completed arbitrary bidirectional native writer. First qualify finite reviewed mappings and logical/operation equivalence. |
| Open language/typed values with explicit comparisons | [RFC 4647](https://www.rfc-editor.org/rfc/rfc4647), [Unicode normalization](https://www.unicode.org/reports/tr15/), [UCUM](https://ucum.org/ucum) and [JSON Schema validation](https://json-schema.org/draft/2020-12/json-schema-validation) address different layers. | Language fallback is not translation; unit parsing is not inferred physical conversion; structural format checks do not establish factual truth. |
| Single database, documented table families and scoped addresses | [PostgreSQL partitioning](https://www.postgresql.org/docs/18/ddl-partitioning.html) and [URI Templates](https://www.rfc-editor.org/rfc/rfc6570.html) expose key/uniqueness and reverse-matching limits. | Fixed family/table/partition counts and 3B-object estimates are not performance evidence. Route/link equality depends on admitted versions and current access. |

[MODEL01-MODEL40](../../testing/model-contracts.md) are the selected, unexecuted
verification cases. No code, source pin, database or benchmark was changed by
this documentation selection; the earlier schema/compiler evidence keeps its scope.

External results establish precedents and tradeoffs. They do not prove that REZICS's combination preserves its invariants, meets its SLOs or fits the 500M/3B workload. Qualification includes semantic and relational integrity, concurrency, revocation, retries, recovery and capacity; it is not limited to constants and query plans.

The selected [identity/access research basis](../identity-and-access.md#research-basis-and-qualification-limits)
owns mixed grantees, representation and membership evidence; [connected-app sources](../connected-apps.md#sources-and-limits)
own OAuth/MCP and external identity privacy, and [experience design](../identity-and-access-experience.md)
owns progressive disclosure. These owners distinguish adopted semantics from
adapter, SQL, workload and human-usability qualification without copying a second
evidence matrix here.

[Schema.org and Wikidata interoperability](../semantic-interoperability.md) owns
the primary specifications reviewed September 15, 2026, the selected source-model
and native-mapping distinction, and export limits. Its
[capacity envelope](../semantic-interoperability-capacity.md) is a separate planning
estimate; no runtime or full-provider qualification follows from those sources.

## Native Work and classification

| Primary source | Evidence and selected use | Limit / REZICS obligation |
| --- | --- | --- |
| Gnoli, [Is an all-purpose classification possible?](https://link.springer.com/article/10.1007/s11229-025-05011-9), Synthese, April 15, 2025 | Conceptual research on stable concept definition across disciplinary perspectives. Supports separating identity from classification viewpoint. | Does not decide identity continuity for remakes, translations or forks. Apply the native scope rules and cross-domain cases. |
| Maculan, Soares and Marques, [Faceted Classification Theory](https://periodicos.ufmg.br/index.php/advances-kr/article/view/66915), August 26, 2026; [full paper](https://periodicos.ufmg.br/index.php/advances-kr/article/view/66915/52365) | Integrative literature review and conceptual synthesis linking decomposition, multidimensionality, explicit relations and evolution. Supports the faceted method. | A conceptual framework, not a benchmark of a REZICS-like service or proof of one universally optimal taxonomy. |
| Monterroza-Rios, [Toward a General Taxonomy of Artefacts](https://link.springer.com/article/10.1007/s13347-026-01069-6), June 20, 2026 | Competing eight-rank proposal based on constitution, structure, mechanisms and function, illustrated with physical artefacts. | Preliminary, with further validation acknowledged. Do not impose exclusive dominant categories on mixed-media Works without supporting cases. |
| UDC Consortium, [UDC Scope](https://udcc.org/index.php/site/page?view=about_scope); Getty, [AAT editorial guidelines](https://www.getty.edu/publications/vocabularies-editorial-guidelines/aat-guidelines/1_about_aat/1.1/), revised November 22, 2024 | Mature examples of analytico-synthetic classification and separate facets for types, materials, styles and roles. | Vocabulary and indexing precedents; AAT's visual-cultural scope does not supply all music/game/software semantics. |
| W3C, [SKOS Reference](https://www.w3.org/TR/skos-reference/), Recommendation, August 18, 2009 | Stable concepts, multilingual labels, semantic relations and scheme mappings. Supports controlled vocabulary contracts. | Concepts, particular Works, structural types and permissions remain distinct. A broader concept is not automatically a structural parent or a grant. |
| IFLA, [LRMoo approval announcement](https://www.ifla.org/news/newly-available-object-oriented-lrm-conceptual-model/), December 13, 2024; CIDOC CRM, [1.1.1 release](https://cidoc-crm.org/lrmoo/ModelVersion/version-1.1.1), October/November 2025, and [declarations](https://cidoc-crm.org/extensions/lrmoo/html/LRMoo_v1.1.1.html) | IFLA endorsed 1.0 in April 2024; the 1.1.1 page states CIDOC CRM SIG approval. Work, expression, manifestation, creation, parts and derivation span literature, music, films and visual art. | Keep approval statements separate. Native Work adds platform maintenance/adoption semantics. LRMoo's one-Work-per-Expression rule requires explicit component mapping for native multi-work text containers. |
| Library of Congress, [BIBFRAME 2.0 overview](https://www.loc.gov/bibframe/docs/bibframe2-model.html), April 21, 2016; Schema.org, [CreativeWork](https://schema.org/CreativeWork) | Alternate bibliographic and broad web-description models. Useful interchange targets. | Their Work/realization/derivation boundaries are not automatically identical to native Work or LRMoo. Schema.org's retrieved page identifies itself as a development vocabulary view. |
| O'Neill, [Humphry Clinker study](https://www.oclc.org/content/dam/research/publications/library/2002/oneill_frbr22.pdf), 2002; MusicBrainz, [Work](https://musicbrainz.org/doc/Work) | The case study found that distinguishing expressions could require inspecting books. MusicBrainz documents translation as a distinct Work example. | Retain unknown correspondence and source-specific grain. MusicBrainz marks this overview as not reviewed by its documentation team; it is not a universal musicological identity rule. |

## Identity and composability

Physical data independence concerns placement and access paths. Logical data independence concerns changing representations/schema behind a stable model. Object identity concerns which referent persists. An `{owner,id}` value is a mechanism, not proof of all three. Here owner means a stable logical responsibility domain; table, database and shard placement are separate mappings. A logical identity correction is not ordinary physical relocation.

| Primary source | Evidence and selected use | Limit / REZICS obligation |
| --- | --- | --- |
| Deshpande, [Beyond Relations](https://vldb.org/cidrdb/papers/2025/p15-deshpande.pdf), CIDR 2025; [award record](https://www.cidrdb.org/cidr2025/awards.html) | Argues for entity/relationship abstraction above tables; ErbiumDB is a PostgreSQL-backed prototype. It received a CIDR Best Paper award. | Prototype components and mapping correctness remain research questions. An award is not production or REZICS capacity evidence. |
| Relay, [Global Object Identification](https://relay.dev/graphql/objectidentification.htm); GitHub, [global node IDs](https://docs.github.com/en/graphql/guides/using-global-node-ids); Kubernetes, [API resource versions](https://kubernetes.io/docs/reference/using-api/api-concepts/#resource-versions) | Common object lookup and separation of identity from changing state are established interface practices. GitHub REST exposes GraphQL-compatible `node_id`, not its ordinary numeric `id`. | API shape proves neither internal table layout nor FK integrity. Kubernetes resource versions support concurrency/watch semantics with limited history, not permanent immutable revision retrieval. |
| Pedreira et al., [Velox](https://vldb.org/pvldb/vol15/p3372-pedreira.pdf), PVLDB 2022, and [Composable Data Management System Manifesto](https://www.vldb.org/pvldb/vol16/p2679-pedreira.pdf), PVLDB 2023 | Reusable execution components and explicit interfaces reduce duplicated data-engine infrastructure; the manifesto is a vision paper. | Query operators and engine interfaces are not REZICS domain-feature eligibility or actor authorization. This does not mandate application microservices or replacing PostgreSQL. |
| Substrait, [cross-language relational algebra](https://substrait.io/) | A common plan interchange contract reduces pairwise integrations. | Does not prove integration complexity becomes O(owners + features). Semantic exceptions, applicability and test combinations can still be multiplicative. |
| Ginter and Leis, [Active Data Lakes](https://www.vldb.org/pvldb/vol19/p1372-ginter.pdf), PVLDB 19(6), 2026 | Prototype experiments decouple physical formats from interoperable access. Supports evaluating replaceable representations. | A memory-resident scan reports 22% virtualization overhead relative to Zstd Parquet; other settings benefit. Bounded abstraction still costs CPU, memory, I/O or coordination. |
| Montana et al., [Not Your Usual Type(s)](https://arxiv.org/abs/2607.13339), submitted July 14, 2026; marked accepted at CDMS@VLDB | Author-reported experience operating millions of jobs motivates schema, constraint and lineage contracts across languages/engines. | Workshop paper/preprint and pipeline-contract experience, not proof of arbitrary resource authorization or a main-track REZICS system result. |
| Curino et al., [Schism](https://www.vldb.org/pvldb/vol3/R04.pdf), PVLDB 2010; Vitess, [VSchema 24.0](https://vitess.io/docs/24.0/reference/features/vschema/) | Workload-aware placement and routing indirection are concrete precedents for retaining logical interfaces while placement changes. | Cross-partition transactions, uniqueness and reverse queries still need design. Do not infer automatic transparent arbitrary-schema changes or require database splitting now. |

## Composition and system operations

| Primary source | Evidence and selected use | Limit / REZICS obligation |
| --- | --- | --- |
| W3C, [EPUB 3.3](https://www.w3.org/TR/epub-33/); IIIF, [Presentation API 3.0](https://iiif.io/api/presentation/3.0/) | EPUB separates resources, navigation and default reading order. IIIF separates presentation membership and Range navigation, with both embedded and referenced structures. | These are publication/presentation standards, not SQL schemas. REZICS chooses local explicit occurrences and shared content; reference-based structures are not inherently slow. |
| OASIS, [DITA technical committee](https://www.oasis-open.org/committees/dita/); DITA-OT, [content-reference processing](https://www.dita-ot.org/dev/reference/preprocess-conref.html) | Structured reuse can be resolved through a controlled processing stage. Supports explicit import/assembly operations. | A publishing processor does not by itself supply REZICS version pinning, actor permissions, local-edit reconciliation or durable retries. |
| Helland, [Immutability Changes Everything](https://www.cidrdb.org/cidr2015/Papers/CIDR15_Paper16.pdf), CIDR 2015 | Architectural discussion of immutable data and version naming. Supports independently referable published states and shared unchanged content. | Immutability does not imply perpetual disclosure, zero storage cost or correct erasure. It does not require whole-system event sourcing. |
| W3C, [PROV-DM](https://www.w3.org/TR/prov-dm/), Recommendation, April 30, 2013 | Entity/activity/agent and derivation vocabulary supports source and import provenance. | Provenance, accepted truth, content adoption and authority are separate native decisions. |
| Microsoft, [CQRS pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs); Debezium, [Outbox Event Router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html) | Read/write models can share a database. Atomic outbox plus idempotent consumption addresses committed-state/event delivery. | Background freshness, duplicate delivery, replay and failed workers require explicit contracts. Unique admission and authority checks cannot be deferred to an eventual projection. |
| Pang et al., [Zanzibar](https://www.usenix.org/system/files/atc19-pang.pdf), USENIX ATC 2019; Bailis et al., [Coordination Avoidance](https://www.vldb.org/pvldb/vol8/p185-bailis.pdf), PVLDB 2014 | Authorization/content ordering and invariant-based coordination analysis motivate current-policy fences and per-operation correctness. | Separately successful components do not prove a correct composition. Check the actual mutations, revocation races, references and failure states. |

## Scale reports and their denominators

These are external reports, not REZICS measurements. Counts of objects, tuples, rows, vectors and requests cannot be substituted for one another. Preserve dataset distribution, operation mix, topology, cache state, versions and consistency when using a number in a design decision.

| Primary report | Reported result | Relevant limitation |
| --- | --- | --- |
| Bronson et al., [TAO](https://www.usenix.org/conference/atc13/technical-sessions/presentation/bronson), USENIX ATC 2013 | Distributed production object/association service: about one billion reads/s and millions of writes/s across thousands of machines. | Service operations over a constrained, cached interface; not PostgreSQL SQL throughput or proof of REZICS's bridge layout. |
| [Zanzibar](https://www.usenix.org/conference/atc19/presentation/pang), USENIX ATC 2019 | Trillions of ACLs, millions of authorization requests/s, p95 below 10 ms and availability above 99.999%, as reported in the paper. | Distributed authorization workload and its consistency/cache design; not generic graph traversal or all REZICS features. |
| OpenFGA, [Read AI adopter report](https://openfga.dev/docs/adopters/read-ai), retrieved September 14, 2026 | Self-hosted PostgreSQL deployment, 5.3B+ tuples, peak 5,200 RPS, 20 ms p99 / 1.8 ms average; reported v1.8.16. | Adopter-reported deployment, not an independently reproduced REZICS workload or a guarantee for every query shape. |
| AuthZed, [Google-scale authorization load test](https://authzed.com/blog/google-scale-authorization), originally July 12, 2023, updated September 19, 2024 | AuthZed Dedicated backed by CockroachDB; one million requests/s with 1% writes and reported CheckPermission p95 5.76 ms. Test matrix includes 100B relationships. | Vendor-generated load test, not a general production claim. Hardware, graph shape and the 99% permission-check mix matter. |
| AWS/Nubank, [NuPay migration case](https://aws.amazon.com/blogs/database/migrating-mission-critical-payments-at-nubank-to-amazon-aurora-postgresql/), retrieved September 14, 2026 | 7.5 TB and over 31B rows across all tables, migrating self-managed PostgreSQL to Aurora PostgreSQL. | All-table count and workload-specific migration evidence. Aurora storage/topology and warm/cold query effects do not describe an ordinary PostgreSQL node or every query. |
| AWS/CORTO, [semantic search case](https://aws.amazon.com/blogs/database/cortos-billion-scale-legal-semantic-search-with-aurora-postgresql-pgvector/), retrieved September 14, 2026 | Reported 2.5B documents / 7.6B vectors in a 46 TB APAC Aurora cluster, with other regional clusters. | Each query is scoped to one firm's partial index; it does not search all vectors. Separate ingestion/read instances and compact embeddings are material conditions. |

## Applying evidence to REZICS

The selected design uses domain-owned tables, shared logical references/features, explicit published compositions, bounded commands and rebuildable read models. It does not adopt a federation engine, universal graph database or every technology listed above. Evidence is selected for the question it answers, not a star rating or the size of a company's deployment.

Before claiming a physical choice is qualified, record the invariant and query served, source/target assumptions, rejected alternatives, local test or measurement, and remaining limit. [Native Work tests](../../testing/native-work.md), [composition tests](../../testing/content-composition.md), [foundation tests](../../testing/foundation.md) and [system integration](../../testing/backend-integration.md) provide the obligations. Keep current failures visible. A 500M/3B planning calculation or small fixture passing does not establish production acceptance.

New citations should use direct primary URLs or DOI links, identify date/version and evidence type, and state both support and limitations. Conference programs, indexes and vendor README summaries are discovery aids; follow them to the relevant paper, protocol or methodology before assigning a quantitative claim. Avoid tracking parameters and do not make maintained docs depend on temporary discussion files.
