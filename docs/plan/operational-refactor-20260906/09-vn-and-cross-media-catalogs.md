# P09 — Multilingual VN and connected program/music experiences

Status: planned, not implemented. Date: 2026-09-06. Parent: [program and gates](README.md).

The [current stage](00-source-complete-schema.md) is full native source-schema
coverage, including book indexing and MusicBrainz supporting catalog entities.
The CJK scope below is a later launch/presentation focus. It must not reduce the
database's language, object, field or relationship coverage or justify one-record
pilots as completion. Implement the domain/schema owners before the broader views.

## Outcome

Deliver U05–U08 and the catalog event side of U10 with real source coverage and useful navigation. A source adapter that stores raw JSON does not complete this product plan.
Owners: P01 domain schemas/services, P03 named forms/support, P04 adapters, P06 filters/search and Web `media`, `entities`, `units`, `content-structure`, `zones`.

## Selected launch scope

- Provide a multilingual VN catalog covering the declared Chinese/Japanese/Korean content slice and its necessary related entities, plus book/program/music links supported by source evidence.
- Define the CJK slice as source VNs whose stated original language or at least one associated release language is in the zh/ja/ko language families under the versioned source mapping. Record the exact snapshot/query denominator and exclusions.
- Retain other-language names, global identities and related entities needed for those records; UI language is not a filter deleting source evidence.
- Complete the three source adapters' declared public metadata conformance. Public promotion can focus on verified CJK slices while other eligible imported metadata stays usable.
- Follow the [provider-independent capability and Edition decision](../../report/REZICS-Catalog领域边界与实施分期-20260906.md#23-provider-independent-native-model): distinguish content versions/variants, publication/distribution, platforms, translation patches, developer/publisher, staff aliases and contextual roles. VN-local edition numbers are snapshot-scoped source references, not a native identity layer. Views must not make that layer mandatory.
- Music preserves release group/release/recording/work and ordered artist credit; disc/track are occurrences where appropriate. Bangumi musical subjects map by evidence, not always to MusicBrainz Work.
- Character traits filter characters and then return works through scoped participation. Episode/release/spoiler constraints remain attached to the same relationship.
- Cross-media navigation uses explicit adaptation, soundtrack, performance, credit or series relations. Shared title or shared actor is not sufficient to assert adaptation or character song.
- Catalog metadata does not authorize hosting novels, songs, VN files, cover art or descriptions. Keep supported licensed reading/content flows; default new external catalog records to metadata and allowed source links.

## Implementation slices

1. Build source-to-domain fixture matrix and domain-specific presentation profiles; include counterexamples for grain, officialness, language and source identifiers.
2. Implement VN work/release/character/staff/trait views with multilingual title selection and release filters.
3. Complete program/episode and music release/track/credit views using shared composition and fact owners.
4. Add character-to-work, creator-to-credit and work-to-soundtrack navigation through P06 correlated queries.
5. Add source and officialness disclosure only where it helps users choose or trust a result; detail evidence in editor/progressive disclosure views.
6. Integrate familiar lists, reviews, ratings and progress where meaningful for each object. Avoid applying “read” to every Unit or forcing every recording to become a book-like page.
7. Audit full snapshot coverage, publish a machine-readable/internal coverage manifest and drive product claims from qualified coverage.
8. Emit meaningful adopted publication/release events after P05 commit, with source evidence and an idempotent event identity. P07 owns reader subscriptions/digests/mutes, P10 delivery. Raw-source spelling changes do not become release announcements.

## Acceptance corpus

- Japanese VN with official Korean release and unofficial Chinese patch: filter and labels distinguish these scopes.
- Two characters each have one desired trait: same-character query rejects the false combination.
- Same actor/character in different language releases: results explain the matching release.
- Shared recording on two albums: track-specific titles/credits remain distinct.
- MusicBrainz release group, concrete release and musical work are independently recognizable.
- Character song attribution is based on a recording/performance context, not all songs by the voice actor.
- Novel volume, anime adaptation and soundtrack can be navigated without merging their identities.
- A franchise grouping and a mixed-media boxed release have distinct membership/containment semantics. The package can reference game, publication and soundtrack components without copying their identities or transferring reviews/progress.
- Spoiler/adult visibility filters apply to matching evidence and previews, not only the final page.
- Unmapped fields and unavailable sources remain visible in coverage diagnostics, not silently omitted from a “full compatibility” claim.
- A repeated source update leading to one adopted release produces one allowed notification for an opted-in reader; a muted reader and a mere metadata correction produce none.

## Qualification and operations

Validate selected-source object/field/relation counts and IDs, semantic roundtrips and representative source updates. Run domain/filter/language/SDK tests, frontend typechecks and P10 query tests. Human acceptance evaluates actual discoverability and wording in P12. No “official VNDB partner,” equivalent completeness or content availability claim is inferred from technical compatibility.

Capacity includes source-dependent fan-out: staff aliases, episode scopes, track occurrences, title variants and reverse discovery projections. Their totals may exceed N by orders of magnitude. Paginate popular people/franchises and do not materialize arbitrary transitive closure.
