# Architecture and operational research reports

These reports describe proposed REZICS architecture. They do not establish that a schema,
adapter, migration, or capacity target has been implemented or qualified. Documents under
[`docs/architecture`](../architecture/) distinguish accepted designs from implemented
contracts in their status; use source code and qualification evidence for current behavior.

| Report | Responsibility | Delivery status |
| --- | --- | --- |
| [Source-complete catalog schema, 2026-09-06](REZICS-source-complete-catalog-schema-20260906.md) | Current-stage VNDB/MusicBrainz/Bangumi/book-index schema mandate, verified API evidence, missing physical owners and native conformance gates. | Primary entry point for the next implementation stage; core replacement schema is not delivered. |
| [Operational decisions and issue register, 2026-09-06](REZICS-operational-refactor-decisions-20260906.md) | Selected product portfolio, integrated decisions, concrete gaps, evidence gates and later work. | Broader program; current execution is the source-complete schema milestone. Supporting commits do not establish catalog-schema or production qualification. |
| [Product opportunities and scenarios, 2026-09-06](REZICS-product-opportunities-and-user-scenarios-20260906.md) | Primary market evidence, U01–U15 user scenarios, cold start and product metrics. | Research and selected scope; market hypotheses remain distinguished from adoption evidence. |
| [Language and authority audit, 2026-09-06](REZICS-language-and-authority-audit-20260906.md) | BCP 47/IANA versus locale conventions, source mappings, multiple named forms and scoped officialness. | Current-source audit and target contracts; language migration not run. |
| [Source integration and review, 2026-09-06](REZICS-source-integration-and-review-20260906.md) | MusicBrainz/VNDB/Bangumi acquisition, continuous adoption, rights, AI review, repair and capacity. | Source evidence and implementation decisions; no full import, source authorization or AI evaluation claimed. |
| [Event streaming architecture, 2026-09-07](../architecture/event-streaming.md) | Dedicated NATS JetStream transport, preferred Debezium outbox relay, independent event/task consumers, deployment, replay and capacity. | Maintainer-accepted infrastructure decision; implementation, benchmark and production qualification pending. |
| [System readiness audit, 2026-09-06](REZICS-system-readiness-audit-20260906.md) | Concrete code/contract gaps, worker correctness, privacy, query costs, migration and recovery. | Static audit; no production inspection, rendered QA or capacity certification. |
| [Platform architecture and gradual expansion, 2026-09-05](REZICS-动态元信息与渐进扩展架构-20260905.md) | Product direction, Unit capabilities, Work and edition boundaries, unified Entity participation, Access delegation, and gradual deployment. | Adopted direction; migrations and full capacity qualification remain pending. |
| [Content structures, relations, and query models, 2026-09-06](REZICS-内容结构关系与查询模型-20260906.md) | Fixed and dynamic fields, content identity and occurrences, traversal, Tag evolution, referenceable relations, and relational/full-text query execution. | Existing implementation observations plus proposed changes; not a completion record. |
| [Catalog boundaries and implementation phases, 2026-09-06](REZICS-Catalog领域边界与实施分期-20260906.md) | Full catalog ownership map; classification versus extensions, object identities, table groups and sharding; products/GPU, compute services, software/packages, media, courses and future domains. | Owns the current-source status snapshot, deferred scope, activation conditions and delivery criteria. |

For the converged native delivery, start with the
[convergence boundary and remaining gaps](REZICS-operational-refactor-convergence-gaps-20260908.md).
For the broader target, read the source-complete schema report and
[schema milestone](../plan/operational-refactor-20260906/00-source-complete-schema.md).
The operational decision report and [broader program](../plan/operational-refactor-20260906/README.md)
remain the long-term portfolio. The program adds
VNDB as a named adapter, standard language/officialness contracts, operational product lines,
and a destructive-migration/replacement-deployment path. The platform report provides the
underlying product and semantic context. Before implementation, read the status and
scope in section 1 of the catalog report; then use the report that owns the affected topic.
Catalog means all indexed domains, while `publishing` names the book/publication table group.
Neither a semantic class nor a proposed table group implies a separate database or service.

The maintainer clarified that source-required catalog objects are current scope,
including MusicBrainz supporting entities and book-index/translation structures.
Future-product examples in older reports do not defer those required data models.
Supporting operational commits and general test totals are not schema completion.

The 2026-09-07 clarification additionally requires logical Unit identities with
owner-local physical storage and retirement of the live global `unit` parent;
explicit [fixed structural/dynamic semantic relation classification](REZICS-内容结构关系与查询模型-20260906.md#24-fixed-structural-relations-and-dynamic-semantic-relations);
and native universe/world-setting, franchise and series models in this stage.
The [physical identity contract](REZICS-source-complete-catalog-schema-20260906.md#41-logical-unit-and-owner-local-physical-identity)
and P01/P11/P12 own the conversion and acceptance gates. Older thin-parent and
future-grouping wording is superseded. These requirements are not yet delivered.

Maintain each topic in its owning report and link to it rather than creating competing
specifications. Adopted design, existing foundations, deferred features, and unqualified capacity
are separate states. A future-domain example does not expand the scope of an implementation task.
Do not create placeholder tables, services, migrations, or UI merely to mirror the full domain map.

Implementation should produce the appropriate versioned contracts, migrations, checks, and
architecture decisions before a proposal is described as shipped. Update the catalog report's
source-status snapshot with evidence when a capability is delivered, keeping incomplete scope
explicit. Existing source links and old commit references are research evidence, not guarantees
that the present checkout or a production database still matches that snapshot.

The Chinese reports retain the language of the ongoing maintainer design discussion. New
maintainer research and plans use English as required by CONTRIBUTING. Deprecated
and user-provided working reports under `.temp/` are outside this maintained report set.
