# Architecture research and design reports

These reports describe proposed REZICS architecture. They do not establish that a schema,
adapter, migration, or capacity target has been implemented or qualified. Source code and the
implemented contracts under [`docs/architecture`](../architecture/) describe current behavior.

| Report | Responsibility |
| --- | --- |
| [Platform architecture and gradual expansion, 2026-09-05](REZICS-动态元信息与渐进扩展架构-20260905.md) | Product direction, Unit capabilities, Work and edition boundaries, unified Entity participation, Access delegation, and gradual deployment. |
| [Content structures, relations, and query models, 2026-09-06](REZICS-内容结构关系与查询模型-20260906.md) | Fixed and dynamic fields, catalog domain boundaries, content occurrences and traversal, Tag evolution, referenceable relations, and relational/full-text query execution. |

For the topics owned by the second report, use its detailed decisions together with the updated
summaries in the platform report. Maintain a topic in its owning report and link to it instead of
creating competing specifications. Implementation should produce the appropriate versioned
contracts, migrations, tests, and architecture decisions before a proposal is described as shipped.

The Chinese reports retain the language of the ongoing maintainer design discussion. Deprecated
and user-provided working reports under `.temp/` are outside this maintained report set.
