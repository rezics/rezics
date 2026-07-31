# Block

`@rezics/block` is the schema and validation boundary for renderable documents. It is deliberately
separate from the **Content Structure** product, which organizes Units and is persisted by
`content_structure_node`.

The core block set is `portable-text`, `unit-ref`, `unit-list`, `search`, `menu`, `media`,
`divider`, `group`, `callout`, and `tabs`. References target Units rather than domain-specific records, so there is one `unit-ref`
instead of domain-specific reference variants. Documents do not carry schema versions. After v1,
stored-document changes must remain valid for the existing shape or use a deliberate versioned migration.

Every stored document is structurally checked by TypeBox and semantically checked by
`assertBlockDocument`. Semantic validation enforces unique stable keys, host allow-lists, nesting
rules, complexity limits, external-navigation policy, and nested Search configuration. Reference
collection is a separate pass so the backend can resolve visibility, authorization, cache tags,
and previews in batches. `assertResolvedBlockReferences` and
`assertResolvedNavigationReferences` require every non-URL reference to resolve in the current
host and actor context before persistence. Navigation content is a separate `NavigationDocument`; a `menu` block only
chooses how to render a navigation resource, so the same menu can power a header, drawer, or dock.

A Dock uses the distinct `DockDocument` envelope. A Dock is Unit-owned composition, not a page or
a sidebar: the consuming product route decides its placement for each device and surface. Its
restricted host policy excludes inline Portable Text and requires display copy to come from
localized Unit references.

Frontend renderers should use a registry keyed by `_type`, lazy-load renderer implementations,
and render only blocks admitted by the backend host policy. The renderer registry is presentation;
it must not become a second schema registry or execute raw search-engine queries.
