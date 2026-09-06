# P06 — Book retrieval, tags and relationship discovery

Status: planned, not implemented. Date: 2026-09-06. Parent: [program and gates](README.md).

## Outcome and baseline

U01/U05/U06 must return useful, explainable results at bounded cost.
Current `services/main/src/services/search/README.md` documents that `relevance` uses updated time rather than relevance scoring; it also documents bounded scans that can yield empty advancing pages. Retain existing permission and work-budget protections while improving the product contract.

Owners: `services/search`, `services/filter`, `services/tags`, `libraries/filter`, SQL projection owners and Web `search`, `tags`, `entities`, `units`, `zones`. Preserve one canonical Zone search.

## Selected retrieval contract

- Resolve recognized identifiers and exact normalized titles/aliases first; rank these above incidental full-text matches. Preserve language/script and target edition semantics.
- Define explicit orders: relevance, recent update and other supported ranking orders. Do not label recency as relevance.
- Use PostgreSQL and PGroonga initially. Relevance is a versioned query plan/ranking contract, not an excuse for unbounded sorting or fixed remote top-K followed by lossy relation filtering.
- Search documents and name indexes follow owner/current visible revision; provenance/display language selection stays separate from textual matching.
- Filter AST binds related conditions to a named entity/relation variable. “Red hair and blue eyes” on a character must match the same character when requested; a work with two different characters does not satisfy that query.
- Results return safe match explanations: which character, edition, occurrence or relation satisfied the filter, respecting visibility and spoiler policy.
- Distinguish direct tags, entailed facts and retrieval-only expansion. An absent tag is not a proven negation.
- Persisted query cursors bind ranking version, source phase, complete sort tuple, canonical language preference, filter and any projection generation needed for stable semantics.
- Bounded scans may return incomplete results. Show a deliberate continuation/refine state; never render an intermediate empty scan as “nothing exists.” Avoid unlimited automatic load-more loops.
- Exact totals/facets remain estimates/lower bounds unless proven bounded. Expensive precise queries become resumable jobs.

## Implementation slices

1. Curate labeled title/alias/identifier queries before replacing ordering. Include short/common titles, scripts, diacritics, duplicate editions and rare relations.
2. Add exact identifier/name lookup and a versioned hybrid ranking strategy whose complete candidate generation and ordering cost are measured. Pin deterministic tie-breaks.
3. Extend filter AST/SQL and indexes for shared relation variables, same-character traits, edition language, official claims and contextual credits.
4. Update Tag lifecycle: historical Path definitions remain interpretable while current vocabulary edges can retire; only actual adopted paths are stored. Rebuild by keyed generations and support deltas.
5. Replace per-owner whole-set tag ranking/count work where the audited unbounded owner case applies; precompute/incrementally maintain the needed ordering.
6. Add usable search controls/result explanations with progressive disclosure. Keep scope, selected language, source coverage and non-exhausted results understandable.
7. Rebuild projections with side-by-side generations and switch after correctness/permission comparison; leave unsupported advanced queries explicit.

## Qualification

- Selected U01 gate on at least 300 labeled queries: Top-5 correct identity ≥95% overall, each language stratum ≥90%, exact-ID resolution 100% within fixture scope; homonyms accept the adjudicated valid set. Report per-language results, not only a blended mean.
- Relationship fixtures prove correlated matching, spoiler handling, stale projection behavior and missing-vs-negative semantics.
- Pages remain duplicate-free and deterministic for the stated snapshot/change contract; query changes invalidate cursors cleanly.
- Test popular low-selectivity queries, selective text with broad relations, selective relations with broad text, hot characters and growing localized-name sets.
- Capture plans before/after at representative distributions with `EXPLAIN (ANALYZE, BUFFERS)`; candidate limits alone do not prove bounds on pre-materialization or member checks.
- P10 targets p95 search API ≤400 ms / p99 ≤1.2 s under its starting workload; unmet targets trigger optimization/scope admission changes and remain unqualified.
- Run backend/filter tests, SDK generation/typecheck, changed frontend workspace typecheck, and pure query-model tests. Human rendered acceptance is P12.

## Growth and recovery

Budget 500M/3B identity/name/relation/projection rows independently; relation fan-out can exceed that by multiplication. Use selective reverse indexes and necessary bounded projections, not global closure or arbitrary JSON GIN. Retain source-of-truth repair and projection generation rollback. Evaluate external search only after proving an actual workload subset and end-to-end semantic/cost benefit.
