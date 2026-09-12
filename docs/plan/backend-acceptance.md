# Backend acceptance gate

G4 is the entry condition for frontend implementation. See [the plan](README.md) for policy/progress. Existing test totals and the design checker do not close these gates.

| Gate | Required evidence |
| --- | --- |
| Native schema | Fresh rebuild, keys/constraints, source-free commands, negative SQL, concurrent transitions and history. |
| Logical Unit separation | Qualified generic references, owner adapters and shared Tag/relation/participation capabilities; logical table changes do not require per-kind feature rewrites or a universal parent. |
| APIs | Eager route compilation, OpenAPI/SDK parity, allowed/denied cases and producer-to-consumer requests. |
| Sources | Elected provider/surface roundtrips, updates/withdrawal/reapply, partial coverage, cross-source and human-override tests. |
| Creation | Full Book journey including metadata-only virtual Work, community multilingual adoption, external editions and independent anthology/part identities, plus original/AO3-derived cases. |
| Graph | Scoped subgraphs, n-ary semantics, privacy/spoilers, cycles, cursors/budgets and Block descriptors. |
| Hub | Catalog/package/Prompt/MCP conformance; execution scope separately decided and tested. |
| Authority | Revocation/ownership/erasure across content, relations, media, search, messages, exports and jobs. |
| Reliability | Replay, fencing, cancellation, interrupted large operations, merge/split and recommendation recovery. |
| Capacity | EXPLAIN/load/skew evidence, explicit limits, no ignored crashes, storage/WAL/recovery at 500M/3B. |
| Recovery | Restorable database/objects, erasure frontier, reconciled projections/checkpoints and observed RPO/RTO. |

Run [integrated tests](../testing/backend-integration.md) as modules become available. External-site availability belongs to live-source checks, not deterministic acceptance. Fixed fixtures and checksummed large datasets make offline and scale runs reproducible.

These gates use one PostgreSQL write authority with logical owner/aggregate separation. Future database splitting requires its own integrity, routing and operational qualification; it is not required to pass this program's table-boundary contract. Capacity planning and measured limits remain required at both declared scales.

Evidence pins tested commit, contracts, data digests, runtime/settings and commands. Do not count pending/skipped tests as passed, suppress assertions or discard failures. Keep regressions in test owners and delete completed plan entries after lasting contracts/tests are in place.
