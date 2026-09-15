# M09: search, derived state and operations

Dependencies: M01 and module event contracts. Owners: database architecture sections 13-16, [integration tests](../../testing/backend-integration.md), [known failures](../../testing/known-failures.md).

## Remaining work

- Qualify policy-aware candidates, multilingual names/filters, relation constraints, facets and bounded pagination with explicit incomplete results.
- Qualify the [researched performance remedies](../../architecture/information-indexing-and-verification.md#selected-performance-remedies): profile/scope-leading member orders, joint searchable quality signals, cost-selected candidate paths and bounded physical-index routing. Treat the current 50,000 posting threshold as an estimate, compare observed work, and qualify engine-side timeout/cancellation rather than claiming an enforced posting-visit ceiling.
- Implement [information verification execution and indexes](../../architecture/information-indexing-and-verification.md): bounded methods on the existing task/outbox/receipt infrastructure, exact assessment artifacts, independent index/policy generations, broad versus accepted queries and current invalidation fences. Ordinary answer queries do not run an LLM.
- Qualify portable assessment bundles and independent-consumer reconstruction, scoped quality predicates/cursors, correction/erasure/restore and separately admitted on-demand work. Run owning [FACT/CAPFACT scenarios](../../testing/information-verification.md) upon activation; measure the additional 500M/3B assessment/evidence/membership and model-work envelope without double-counting source families.
- Account separately for impact/reuse-driven work, long-tail exploration and known-error correction; qualify per-operator backpressure, method/provider failure and paid-work isolation. Optional index/service offerings compose M10 rather than making commerce an epistemic input.
- Elect dynamic property operations individually and qualify their typed effective-value indexes/projections, scope, source revision, stable ordering and rejected/unavailable states; storage flexibility is not arbitrary-query support.
- Implement the [minimum source-query/export profile](../../architecture/semantic-interoperability.md#minimum-query-and-export-contract) for every supported Schema.org/Wikidata property: source identity, subject/property, existence, exact typed value, reverse reference, statement detail and multilingual names. Keep unmapped external results queryable and distinct from accepted native facts; preserve statement/reference-group correlation and source-generation cursors.
- Qualify source-preserving, native-semantic and vocabulary exports, independent coverage dimensions, atomic index activation, revision/watermark catch-up and gap/erasure recovery using SIO01-SIO18. Do not fabricate Wikidata IDs for native-only objects or hide target-format loss.
- Measure the [interoperability envelope](../../architecture/semantic-interoperability-capacity.md), including source/statement/snak amplification, predicate-posting skew, parser memory, bulk bootstrap and restore. Extend the capacity generator with actual physical families in verification; existing native totals do not include this workload.
- Implement [event-date queries](../../architecture/database/event-time.md) and [rating distributions](../../architecture/database/ratings.md) under their [workload envelope](../../architecture/database/temporal-capacity.md). Include typed start/range indexes, mixed Tag/date/participant plans, submission/evaluation/as-of clocks, latest/history reductions, non-additive distinct-rater windows and generation-bound drill-down.
- Qualify RATE19-RATE33 and TIME06-TIME17 for correction, late data, privacy invalidation, replay, exact background ranges, sparse/hot distributions and 500M/3B capacity. Existing engagement-hourly or recommendation scores do not qualify these rating semantics.
- Preserve Work versus external-edition search targets, declared languages versus adopted readable content, and generic Tag/participant reverse queries across owner hydration. Test selective and dense predicates without requiring cross-database infrastructure.
- Qualify recommendation online disclosure, counters/metrics and source statistics without giving projections canonical authority; extend retention evidence to large backlogs and process/restore boundaries.
- Complete outbox/relay/consumer flows, receipts, permission/source/lease fences, bounded fan-out, quotas and reconciliation for source application, composition import/refresh, correction, export and read-model rebuild. Publish semantic completion only after activation.
- Qualify occurrence-context search, exact-version metric inputs, coalesced dirty queues and paged reverse impact, including soft-deleted/historical uses. Avoid descendant-text duplication in all ancestors and per-node full-owner recomputation; expose freshness while enforcing current disclosure.
- Reproduce and resolve native facet-search crashes; a successful small or JIT-off run is not stability evidence.
- Complete merge/recommendation recovery, checkpointed export, backup/WAL/object reconciliation and erasure-frontier replay.
- Add native Zone selector/composition capacity scenarios using current identities and private follow preferences.
- Qualify Studio all/owned/direct/delegated and mixed-source query plans, disclosure, hot-account writes and source-candidate skew.
- Replace current total-tree/live-reuse guards only with the qualified paged/staged/metric/recovery path; keep finite request and queue budgets.
- Measure skew, hot keys, graph budgets, row/index/WAL amplification, queue age, storage, plans and recovery at the 500M/3B planning scales.

## Acceptance

The selected [M10 Subscribe/Pro scope](subscriptions-and-pro.md) additionally requires
Realm-leading retrieval, accepted-version text/snippets/media, local discussion and
ranking inputs, scoped delivery and entitlement revocation/recovery. Its
[capacity envelope](../../architecture/subscriptions-capacity.md) and
[CAPSUB cases](../../testing/subscriptions-and-pro.md#capacity-and-recovery-cases)
apply upon activation; existing candidate ceilings and one current document per
Unit do not qualify that extension or permit general-content fallback.
Implement the [Realm/parent reply projection](../../architecture/realm-scoped-delivery.md#physical-query-plan-and-lifecycle),
batch authority/hydration, explicit more/partial results and fixed-site resolver.
SITE/RPLY cases require native sparse-parent/deep-cursor plans, shared request/byte
budgets, protected counts, safe private frontiers and staged rebuild recovery.

Stale projections cannot leak private content or counts. Failed builds preserve the previous generation. Stale workers cannot duplicate effects or reactivate revoked state. Failures and measured limits remain visible until closed. Fresh rebuild qualification replaces online migration work in this program.
