# M02: knowledge and relationship graph

Dependencies: M01. Owners: dictionary D03-D04/D11, [Tag Path architecture](../../architecture/tag-paths.md), [Relationship Graph contract](../../architecture/database/relationship-graph.md).

## Remaining work

- Qualify fact slots, typed assertions, evidence/support, scope decisions, n-ary associations and participant type witnesses.
- Preserve semantic context, canon, valid time and governance scope independently. Capability retirement invalidates current proofs without rewriting history.
- Reconcile Tag/Expression/Path/Sense/Application/inference code with the target; preserve contextual rendering, collision repair and direct versus inferred evidence.
- Implement neighborhood and relation-detail queries with node/relation budgets, cursor context, partial results and current visibility.
- Specify the persisted Relationship Graph Block query descriptor and serialization without introducing a renderer or second writable graph.
- Test [graph scenarios](../../testing/relationship-graph.md), including Book character appearances and story-specific relationships.

## Acceptance

Multi-participant relations are not fabricated as pairwise facts. Role predicates correlate to one relation revision. Pagination, privacy, spoilers and canon filters work together. The API distinguishes accepted relations, source claims and pending/conflicted results. Block contracts consume this API without embedding authoritative graph data.
