# M02: knowledge and relationship graph

Dependencies: M01. Owners: dictionary D03-D04/D11, [Tag Path architecture](../../architecture/tag-paths.md), [Relationship Graph contract](../../architecture/database/relationship-graph.md) and [semantic interoperability](../../architecture/semantic-interoperability.md).

## Remaining work

- Qualify fact slots, typed assertions, evidence/support, scope decisions, n-ary associations and participant type witnesses.
- Qualify Schema.org/Wikidata source-value semantics with M07: typed external identity, complete statements, repeated qualifiers/reference groups, value/unknown/no-value states, units, precision, calendar/globe, language and collection semantics. External classification/rank does not grant native capability or acceptance.
- Implement versioned source-term/native-definition and classification mappings with explicit residual/unresolved semantics. Preserve Property descriptions, Lexeme/Form/Sense and EntitySchema distinctions without forcing native owners or Tag Senses. Qualify the M02 portions of SIO01-SIO18 in source conformance.
- Extend generic participants beyond the current catalog-only alternatives through qualified Unit identity/revision/occurrence references and role applicability; do not widen every predicate to every owner automatically.
- Preserve semantic context, canon, valid time and governance scope independently. Capability retirement invalidates current proofs without rewriting history.
- Reconcile Tag/Expression/Path/Sense/Application/inference code with the target; preserve contextual rendering, collision repair and direct versus inferred evidence.
- Make catalog semantic classification consume the same governed Tag/Application authority. Qualify [Event category/topic/referent bindings and temporal facts](../../architecture/database/event-time.md) with M04/M09: actual/planned dates, precision, uncertainty, single writers and TIME01-TIME17.
- Use canonical subject references for global, Realm and private Tag features with their own scope/actor uniqueness and reverse indexes. Prove common feature behavior across owners without a global Unit parent or per-kind Tag services.
- Keep family/derivation discovery separate from explicit composition membership, publication selection and access; no family traversal fills missing reader contents.
- Implement neighborhood and relation-detail queries with node/relation budgets, cursor context, partial results and current visibility.
- Specify the persisted Relationship Graph Block query descriptor and serialization without introducing a renderer or second writable graph.
- Test [graph scenarios](../../testing/relationship-graph.md), including Book character appearances and story-specific relationships.

## Acceptance

Multi-participant relations are not fabricated as pairwise facts. Role predicates correlate to one relation revision. Pagination, privacy, spoilers and canon filters work together. The API distinguishes accepted relations, source claims and pending/conflicted results. Block contracts consume this API without embedding authoritative graph data.
