# Architecture research and design reports

These reports describe proposed REZICS architecture. They do not establish that a schema,
adapter, migration, or capacity target has been implemented or qualified. Source code and the
implemented contracts under [`docs/architecture`](../architecture/) describe current behavior.

| Report | Responsibility | Delivery status |
| --- | --- | --- |
| [Platform architecture and gradual expansion, 2026-09-05](REZICS-动态元信息与渐进扩展架构-20260905.md) | Product direction, Unit capabilities, Work and edition boundaries, unified Entity participation, Access delegation, and gradual deployment. | Adopted direction; migrations and full capacity qualification remain pending. |
| [Content structures, relations, and query models, 2026-09-06](REZICS-内容结构关系与查询模型-20260906.md) | Fixed and dynamic fields, content identity and occurrences, traversal, Tag evolution, referenceable relations, and relational/full-text query execution. | Existing implementation observations plus proposed changes; not a completion record. |
| [Catalog boundaries and implementation phases, 2026-09-06](REZICS-Catalog领域边界与实施分期-20260906.md) | Full catalog ownership map; classification versus extensions, object identities, table groups and sharding; products/GPU, compute services, software/packages, media, courses and future domains. | Owns the current-source status snapshot, deferred scope, activation conditions and delivery criteria. |

Start with the platform report for product context. Before implementation, read the status and
scope in section 1 of the catalog report; then use the report that owns the affected topic.
Catalog means all indexed domains, while `publishing` names the book/publication table group.
Neither a semantic class nor a proposed table group implies a separate database or service.

Maintain each topic in its owning report and link to it rather than creating competing
specifications. Adopted design, existing foundations, deferred features, and unqualified capacity
are separate states. A future-domain example does not expand the scope of an implementation task.
Do not create placeholder tables, services, migrations, or UI merely to mirror the full domain map.

Implementation should produce the appropriate versioned contracts, migrations, checks, and
architecture decisions before a proposal is described as shipped. Update the catalog report's
source-status snapshot with evidence when a capability is delivered, keeping incomplete scope
explicit. Existing source links and old commit references are research evidence, not guarantees
that the present checkout or a production database still matches that snapshot.

The Chinese reports retain the language of the ongoing maintainer design discussion. Deprecated
and user-provided working reports under `.temp/` are outside this maintained report set.
