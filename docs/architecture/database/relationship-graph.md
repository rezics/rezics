# Relationship Graph API and Block contract

The native Graph API is a bounded read projection of native identities, associations, participants, accepted claims and evidence. It introduces no second graph authority. Existing relation/participant CRUD is a foundation, not proof of graph-query completion.

## Generic participants and capability admission

Use the [logical Unit capability contract](README.md#34-unit-capabilities-across-owner-tables) for identity targets across catalog and platform owners. Persist participants through REF or the appropriate exact revision/occurrence citation; do not enumerate every owner as nullable columns in each generic association family. Predicate/role contracts decide which targets and structural capabilities are eligible. A valid reference alone does not establish role compatibility, accepted truth or permission.

Translation, subtitle, recording and software-localization relations can link a native Work, exact source/result revisions and contributing Entities through separate roles. Work aggregation, editorial selection, part coverage and release correspondence remain distinct predicates/structures. [Selected contents](content-composition.md) use their structural owner; a generic edge does not replace manifest, order or adoption integrity. Tag concepts and contextual applications share the target vocabulary while retaining their own evidence and inference rules.

Family queries discover related Works, releases, derivatives and compilations. They are bounded graph reads and never supply a publication's unrecorded descendants, inherit votes/progress or grant access. An import command can record factual imported-from provenance and structural edges; creative equality/derivation claims require their own validated semantic decision. Current navigation can resolve an identity correction while exact historic participants remain unchanged.

The present catalog participant tables provide a narrower catalog-only foundation. Cross-owner admission, revision citations and the generic feature queries must be qualified through the plan; a shared owner registry or a rendered graph is not evidence that every Unit capability is implemented.

## Query contract

The [source semantic view](../semantic-interoperability.md#minimum-query-and-export-contract)
adds separately typed external node/statement handles, pinned dataset generations
and source-qualified results. It may reuse traversal machinery; it does not widen
native participant REF admission. A source graph can be queried before native
mapping. An optional correspondence overlay preserves original source identity,
mapping revision and current visibility of both source and native targets.

A native-view request names root references, allowed predicates/participant roles, semantic context/canon/work, governance scope, valid-time or exact historical cut, viewer spoiler policy, depth, node/relation budgets and continuation. The server derives authority from the authenticated caller; request scope is not permission.

The cursor pins normalized query, relevant policy/definition/topology generation and scan progress. Changing semantic context or a query-defining filter cannot reuse an incompatible cursor. Large graph exploration is explicit bounded continuation; there is no promise to load a complete connected component synchronously.

## Response contract

Return stable visible node references and relation instances with exact relation revision, predicate, direction/participant roles, context, validity and authorized evidence summaries. N-ary relations retain a relation node/participant representation. A UI may derive a display projection, but must not invent pairwise facts or discard repeated roles.

Expose completion/continuation and budget-limited state without leaking hidden-node counts or private traversal paths. Differentiate accepted, disputed, pending and source-only results. Resolve current identities for navigation while retaining original references and history. Dangling, erased or inaccessible targets follow explicit disclosure/placeholder policy.

Queries must correlate all participant-role predicates to the same relation revision. Native relationships may contain valid cycles; traversal uses visited identity/relation keys and declared budgets rather than banning all cycles. Tree-only structural relations retain their own stronger rules.

## Relationship Graph Block

The Block stores a versioned query descriptor: roots, predicate/role filters, context selection, bounded expansion settings, display/layout preferences and fallback presentation. Validate it through the owning Block schema during the backend phase. Do not persist returned graph data as editable facts inside the Block.

The frontend renderer is gated on backend acceptance. It must support node/relationship navigation, provenance/detail inspection, loading/empty/partial/unavailable states, keyboard use and an accessible list/table alternative. Canvas layout does not determine relationship meaning or authority. Cached results include query and visibility generation and recheck current access before disclosure.

## Verification

[Graph tests](../../testing/relationship-graph.md) own positive, negative, concurrency, privacy and skew cases. Index participant reverse lookups by target/role/relation and hydrate bounded owner batches. Record EXPLAIN and node/edge/byte work under high-degree roots; a small rendered diagram is not capacity evidence.
