# Block

`@rezics/block` is the schema and validation boundary for renderable documents. It is deliberately
separate from the **Content Structure** product, which organizes Resources and is persisted by
`content_structure_node`.

The core block set is `portable-text`, `post-full-view`, `unit-ref`, `unit-list`, `search`, `feed`,
`menu`, `image`, `url-image`, `divider`, `columns`, `group`, `callout`, and `tabs`. References
target the shared Resource reference contract, with concrete native owners resolved
by backend adapters. The existing discriminators remain implementation identifiers.
The selected target pins content format/model in its revision envelope; it does not
require a version field on each block. The current payload has no inline schema
version, so a format change needs an explicit serialization/installation contract.
[Space routes](../../docs/architecture/resource-addressing.md) target Resources and
reuse their selected Document; they do not create a separate Zone Page body.

Every stored document is structurally checked by TypeBox and semantically checked by
`assertBlockDocument`. Semantic validation enforces unique stable keys, host allow-lists, nesting
rules, complexity limits, external-navigation policy, and nested Search configuration. Reference
collection is a separate pass so the backend can resolve visibility, authorization, cache tags,
and previews in batches. `assertResolvedBlockReferences` and
`assertResolvedNavigationReferences` require every non-URL reference to resolve in the current
host and actor context before persistence. Navigation content is a separate `NavigationDocument`; a `menu` block only
chooses how to render a navigation resource, so the same menu can power a header, drawer, or dock.

A Dock uses the distinct `DockDocument` envelope. A Dock is Resource-owned composition, not a page or
a sidebar: the consuming product route decides its placement for each device and surface. Its
restricted host policy excludes inline Portable Text. Ordinary display copy comes from localized
Resource references; image-local alternative text and captions are the deliberate inline exception.

Frontend renderers should use a registry keyed by `_type`, lazy-load renderer implementations,
and render only blocks admitted by the backend host policy. The renderer registry is presentation;
it must not become a second schema registry or execute raw search-engine queries.
