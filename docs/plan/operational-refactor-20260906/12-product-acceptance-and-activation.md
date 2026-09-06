# P12 — Scenario acceptance, coverage claims and operational activation

Status: planned, not implemented. Date: 2026-09-06. Parent: [program and gates](README.md).

During the [current schema stage](00-source-complete-schema.md), P12 owns source
semantic fixtures, native roundtrip/query assertions and honest coverage status.
Product activation, marketing metrics and broad UI work follow the four-source
schema gate; they must not become substitutes for the missing database refactor.

## Outcome

Make “ready to operate” a verifiable product state. Use [U01–U15 scenarios and market evidence](../../report/REZICS-product-opportunities-and-user-scenarios-20260906.md), not counts of tables or completed tickets. U01–U09/U13 are the initial full portfolio; U10/U11 are bounded supported pilots, U12 invited participation. U14/U15 remain later experiments.

## Acceptance preparation, starting before implementation

1. Maintain one fixture corpus spanning books, VNs, programs/music, characters, people, organizations and authentic user records; include ambiguity, source conflict, multilingual names and privacy.
2. Define task scripts for each scenario: initial state, user intent, actions, expected persisted result, visible feedback, errors/recovery and access constraints.
3. Create at least 300 human-labeled known-item queries across Chinese scripts, Japanese, Korean, aliases, identifiers, homonyms and sparse metadata. Selected retrieval gate: Top-5 correct identity ≥95% overall, each language stratum ≥90%, exact ID resolution 100% within fixture scope.
4. Keep semantic/permission correctness, retrieval quality, rendered user experience and operational load as separate evidence categories.
5. Track current implementation limitations and actual feedback; unvisited pages are not automatically UX defects.

## Product acceptance

- Search: users recognize the correct edition, can continue/refine an incomplete result set and can explain key matching relations.
- Reviews/lists/scoring: readers can consume and contribute authentic content, understand score populations/rules and preserve their edits.
- History: users record paper/external reading, repeat a session, recover a position, control privacy and roundtrip personal data.
- Tags/characters: filters express ordinary preferences, preserve same-character logic and respect spoilers.
- Multilingual metadata: users distinguish interface language, alternate names, release language, source claims and verified official authorization.
- Contribution: users see submission state and reasons; operators resolve conflicts, correct a binding and replay a failed batch.
- Operators: observe freshness, queue age, costs, recovery health and source eligibility, with working stop/resume controls.

Frontends must pass their workspace TypeScript checks and narrower relevant logic checks. Human maintainers/testers own rendered interaction and accessibility acceptance. This plan does not authorize AI-assisted browser/screenshots/visual QA; that requires an explicit current-task request.

## Data and promotion gates

For each named source/campaign, record source snapshot/date, eligibility, query scope, records and relationships expected, records imported, unsupported/excluded fields, update age, sampled identity errors and applicable attribution/export obligations.
“Chinese/Japanese/Korean VN coverage” must refer to the P09 denominator and separately state UI support. Do not imply source endorsement or full compatibility when only raw archival data was loaded.

All three named adapters must have their implementation/conformance ledger completed for program completion. A connector requiring external eligibility can be implemented and tested in a permitted mode while its production mode remains disabled; record that gate honestly rather than mark the entire program delivered.

Community cold start uses genuine contributed or permitted commissioned/curated content. No fabricated reader ratings/reviews, misleading activity counts or imported private social graphs.

## Minimal measurement

Collect coarse scenario/outcome events: successful known-item lookup, intentional save/list use, completed journal entry/import, useful review interaction, successful correction and repeat intentional use. Do not collect private notes or raw reading histories as analytics payloads.
Use scoped access, a documented short raw-event retention period (initial default 30 days) and aggregated cohorts. Avoid automatically treating background checkpoints as active use.

Measure activation and 7/28-day return by value line, source freshness, failed searches by language, reviewed-claim reversal, reviewer queue age, delivery failure and per-source/model operating costs.
No invented retention or revenue promise is a launch fact. Set growth experiments after a measured baseline; technical correctness and privacy are mandatory before experimentation.

## Activation order and ownership

- Internal acceptance on restored/mapped data, then invited real-user/curator/editor cohorts.
- Open already-qualified utilities first; expand source/campaign exposure according to coverage and operating evidence.
- Enable low-risk AI allowlists only after P05 evaluation; revoke by action/source/model on drift.
- Activate organized rounds and organization participation only after their distinct authority/result guarantees pass.
- P11 performs the production cutover; P10 supplies dashboards/recovery, and each feature owner signs its scenario ledger.

Release record includes plan status, source scope, human acceptance date, actual service/cost/recovery measurements, known limitations, supported API versions and operations owner. This documentation task supplies the plan, not those future results.
