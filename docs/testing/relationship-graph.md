# Relationship Graph API acceptance

Owner: M02. Contract: [Relationship Graph API and Block](../architecture/database/relationship-graph.md). These are specifications pending executable target tests.

| Case | Required behavior |
| --- | --- |
| GRAPH01 | Query a character neighborhood and exact relation details with produced native references. |
| GRAPH02 | Filter by Work/canon/semantic context, governance scope and valid time without conflating those axes. |
| GRAPH03 | Preserve direction, participant roles and repeated participants in one relation. |
| GRAPH04 | Represent a three-party relationship without manufacturing three independent pairwise facts. |
| GRAPH05 | Correlate role conditions to one relation revision; unrelated credits cannot satisfy a combined predicate. |
| GRAPH06 | Traverse valid cycles using visited/budget rules; enforce separate tree-only constraints where applicable. |
| GRAPH07 | Enforce node/relation/depth/byte budgets, stable pagination and explicit incomplete/continuation states. |
| GRAPH08 | Reject incompatible cursors after context, predicate, policy or relevant generation changes. |
| GRAPH09 | Filter private nodes/relations/evidence/spoilers without leaking hidden counts, paths or hints. |
| GRAPH10 | Preserve original identity/history through merges, split ambiguity, erased targets and capability retirement. |
| GRAPH11 | Distinguish accepted, contested, source-only and pending relationships in their authorized views. |
| GRAPH12 | Roundtrip the Block query descriptor; reject invalid/unbounded settings and embedded writable graph facts. |
| GRAPH13 | Verify cache isolation and revocation while a paginated traversal is in progress. |
| GRAPH14 | Measure high-degree roots, selective predicates, cross-owner hydration and skew using actual plans. |

Use multi-principal native fixtures, including canon facts and contradictory fanwork-specific declarations. Build expected nodes/relations from known fixture semantics, not by calling the same query implementation twice. Mutation/API tests must create IDs before querying them.

Backend tests validate Block schema and data contracts. Frontend tests later cover accessible graph/list rendering, expansion, partial/error states, evidence inspection and navigation against these APIs. A graph drawing cannot certify API correctness or capacity.
