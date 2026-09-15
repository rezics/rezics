# M07: source converters and native conformance

Dependencies: M01/M02 for source preservation and query contracts; M01-M04 native
commands for adoption. Owners: [source conformance](../../testing/source-conformance.md),
[source lifecycle](../../architecture/catalog-source-lifecycle.md),
[semantic interoperability](../../architecture/semantic-interoperability.md) and
the catalog source inventory. Source indexing does not wait for every native
domain adapter; implementation activation still follows the active plan.

## Remaining work

- Complete MusicBrainz, Cover Art Archive, VNDB, Bangumi and elected book/Open Library converters; treat archive/dump/API/media surfaces separately.
- Complete Schema.org and Wikidata as required full-index families: pinned full vocabulary, JSON-LD/Microdata/RDFa profiles, all selected Wikidata entity kinds/datatypes and complete statement models. JSON-LD-first and Item-only milestones remain partial.
- Build immutable parsed source representations and coverage inventories that preserve external identity, grouping, values, source order and unmatched terms. Qualify namespace-specific acquisition, contexts, shape/lexical data and malformed/unknown inputs; update the owning source inventories when implemented.
- Supply [verification evidence](../../architecture/information-indexing-and-verification.md#verification-workflow) with exact observations/spans, extraction and correspondence versions, known origin/derivative links and unknown dependence. Keep source-supported descriptions queryable before assessment/native mapping; generated REZICS derivatives cannot become independent corroboration on re-ingestion.
- Deliver source corrections/withdrawals to paged assessment/index invalidation while preserving independent support and current disclosure. Qualify M07 portions of [FACT/CAPFACT](../../testing/information-verification.md), including counterevidence, missing observations, rescheduling and circular provenance.
- Implement resumable dump bootstrap, overlapping durable change capture, targeted revision-aware refresh and gap reconciliation. Missing query rows or a narrow API surface cannot withdraw unobserved data; truthy dumps cannot qualify full preservation.
- Link source contract -> source representation/query -> reviewed native meaning/command -> export -> fixture. Track preservation, source indexing, native mapping and export separately; source-only indexed data is distinct from raw-only evidence, excluded-private and unresolved outcomes.
- Map every provider's creative scope, recording/cut/build, release and component to the common native Work/content/release contracts. Preserve unknown correspondence, source-specific grain and native community contributions; identifiers or upstream class names do not prove equality.
- Complete field journals, same-value human takeover, API/dump composition, redirects, child correspondence and ordinary large staged applications.
- Close Bangumi fixed/infobox/API semantics, VNDB dump joins/aggregates, MusicBrainz secondary/candidate/alternative structures and artwork mappings.
- Build reproducible acquisition manifests and small committed fixtures; stream large data with checksums, bounded joins and resumable stages.
- Run cross-source/human update/withdraw/reapply through the same native commands used for source-free authoring. Separate observed, adopted and published events; composition refresh uses captured source/base/local correspondence rather than automatic ancestor rewrites.
- Prepare newly required native identities under the separate intake protocol before entering exact proposal-adoption scope. A proposal grant cannot mint unrelated identities; broader service intake needs an explicit authority contract rather than a creator-ID fallback.

## Acceptance

Row counts are insufficient. Prove semantic preservation, idempotency, missing-data handling, authority and provenance. Upstream users/votes never become native accounts/ballots. Redirects cannot silently merge identities. Captured fixtures run offline; live drift checks remain separate from deterministic CI.

Qualify [SIO01-SIO18](../../testing/source-conformance.md#schemaorg-and-wikidata-acceptance)
with M02/M04/M09. Full compatibility requires every required syntax/model surface,
minimum source queries and explicit export fidelity, including subjects with no
native mapping. Publish pinned dataset coverage and synchronization watermarks;
an archive or provider declaration count does not pass those gates.
