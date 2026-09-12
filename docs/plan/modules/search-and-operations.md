# M09: search, derived state and operations

Dependencies: M01 and module event contracts. Owners: database architecture sections 13-16, [integration tests](../../testing/backend-integration.md), [known failures](../../testing/known-failures.md).

## Remaining work

- Qualify policy-aware candidates, multilingual names/filters, relation constraints, facets and bounded pagination with explicit incomplete results.
- Elect dynamic property operations individually and qualify their typed effective-value indexes/projections, scope, source revision, stable ordering and rejected/unavailable states; storage flexibility is not arbitrary-query support.
- Preserve Work versus external-edition search targets, declared languages versus adopted readable content, and generic Tag/participant reverse queries across owner hydration. Test selective and dense predicates without requiring cross-database infrastructure.
- Qualify recommendation online disclosure, counters/metrics and source statistics without giving projections canonical authority; extend retention evidence to large backlogs and process/restore boundaries.
- Complete outbox/relay/consumer flows, receipts, permission/source/lease fences, bounded fan-out, quotas and reconciliation.
- Reproduce and resolve native facet-search crashes; a successful small or JIT-off run is not stability evidence.
- Complete merge/recommendation recovery, checkpointed export, backup/WAL/object reconciliation and erasure-frontier replay.
- Add native Zone selector/composition capacity scenarios using current identities and private follow preferences.
- Qualify Studio all/owned/direct/delegated and mixed-source query plans, disclosure, hot-account writes and source-candidate skew.
- Measure skew, hot keys, graph budgets, row/index/WAL amplification, queue age, storage, plans and recovery at the 500M/3B planning scales.

## Acceptance

Stale projections cannot leak private content or counts. Failed builds preserve the previous generation. Stale workers cannot duplicate effects or reactivate revoked state. Failures and measured limits remain visible until closed. Fresh rebuild qualification replaces online migration work in this program.
