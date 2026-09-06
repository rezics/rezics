# P07 — Reviews, book lists and organized scoring

Status: planned, not implemented. Date: 2026-09-06. Parent: [program and gates](README.md).

## Outcome and baseline

Complete U02/U03/U10/U11 as recognizable product features. Existing review APIs, Collection membership and 1–10 Realm-scoped scores are foundations, not blank areas.
Owners: `schema/score.ts`, `schema/collection.ts`, `api/reviews` (including its `/scores` route group), `api/collections`, `collection-structure`, and Web `reviews`, `collections`, `realms`, `following`, `notifications`.

## Product and data decisions

- A book page exposes useful reviews, understandable rating populations and relevant lists. Empty community data stays empty; AI or imported catalog facts do not impersonate reader reviews.
- Reviews target an explicit Unit/content scope. Reviewing one translation, a Work or a series must not silently propagate a rating to all related editions.
- A book list is an ordered collection of selected identities with optional curator-authored per-item recommendation text or an explicit linked review. Provide an identified item annotation owner with revisions/permissions; do not infer a reason from a nearby unrelated Post.
- Lists support create/edit/order/remove, metadata/language, visibility, public sharing and saving items. Retain stable item identities across reorder; merge collisions follow explicit winner/preserved-annotation rules.
- Personal/community ratings remain live 1–10 values with visible count/distribution and a named Realm/population. Do not build a mandatory multidimensional scoring engine.
- Every scoring context names its rules. If an organization promises a final panel/award judgment, introduce a scoped frozen round: immutable rules reference, cutoff, eligibility and result snapshot. Existing live Post-score rendering remains live unless a round-specific reference is explicitly chosen.
- Imported source ratings are separate observations with source scale, count, scope and timestamp. Never blend source-site users and REZICS voters into an unlabeled score.
- Preserve review, score and publication visibility independently. Hidden/deleted scores cannot leak through attachments, distributions, cached results or exported lists.
- Follow notifications are opt-in and limited to meaningful publication/list/edition events. Catalog spelling corrections are not reader alerts by default.

## Implementation slices

1. Specify complete item-page → review/list/score → contribute/edit/save paths and errors before changing schemas.
2. Add per-item notes/linked reviews and bounded membership commands. Replace whole-collection loads for a single edit with indexed operations and segmented historical checkpoints.
3. Complete useful review discovery, spoiler controls, filtering, posting/editing and feedback using current governance.
4. Version scoring-context references and expose populations/counts clearly; add explicit round records only for the supported organized-evaluation pilot.
5. Migrate public authorship through P02, language text through P03 and target references through P01. Preserve chosen visibility and live score behavior.
6. Add chosen follow events to durable outbox delivery after P10 lease fixes; suppress duplicate or withdrawn events and honor unsubscribe.
7. Seed only authentic, permitted editorial lists and invited reviews. Maintain attribution and do not copy external user text without permission.

## Acceptance

- A new reader can search a book, read a review, inspect the relevant score population, use a list and save the item without needing to understand Realm internals.
- An editor changes one item in a 1M-item list through bounded work; duplicate insertion, simultaneous reorder and merge do not lose annotations.
- If a target becomes private/tombstoned or a linked review disappears, preserve order and permitted curator annotations while suppressing inaccessible titles, snippets and review text.
- A live score changes its live references; a frozen round remains reproducible. Deleted/private votes are handled according to the round's disclosed historical/privacy contract, not silently leaked.
- A user can rate in two communities without creating two “independent people” in a global population.
- Spoiler settings and visibility apply before snippets, notifications and previews are generated.
- Follow/unfollow races and stale email claims cannot cause forbidden or duplicate state transitions.
- An adopted new-release event from P09 produces one opted-in notification/digest through P10; raw observation changes alone do not notify. Mute/unsubscribe suppresses pending delivery.
- Run focused review/collection/score/governance tests, DB concurrency tests, backend/SDK/Web typechecks and i18n checks for changed copy.

## Scale and release

Use current-value aggregates updated incrementally, not scan-all voting calculations on each read. Model list items, annotations, ratings, actual round participation and notification recipients independently at 500M/3B rows. Shard hot aggregates by deterministic buckets where measured contention requires it; membership and actor uniqueness remain authoritative. P10 qualifies plans and P12 records human user-flow acceptance.
