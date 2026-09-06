# P04 — Production source ingestion and continuous observation

Status: planned, not implemented. Date: 2026-09-06. Parent: [program and gates](README.md).

## Outcome and prerequisites

Deliver independently operable Bangumi, VNDB and MusicBrainz adapters using one source protocol. Initial loads and ongoing changes use the same canonicalization and proposal path; neither bypasses P01/P03/P05 invariants.
[Source research](../../report/REZICS-source-integration-and-review-20260906.md) owns dated acquisition/license evidence. The local `services/main/src/services/content-pack` fixture loader remains local-only and is not repurposed as production ingestion.

## Persistent protocol

Separate SourceDefinition/terms revision, SourceRecord identity, immutable SourceObservation, semantic mapping revision, SourceBinding and AdoptionPolicy. Large raw payloads use object storage with checksums and exact observation references.

- A source record is keyed by source namespace, source entity type and source-native identity. Local/unstable source sub-IDs include containing record and observation context.
- Bindings record exact/scope-specific/candidate/rejected correspondence; one source object may map to several local scopes where its grain differs. A URL is not proof of identity.
- Source fetching happens once per source record/snapshot; many bindings subscribe to its changes. Adoption policy does not create independent duplicate crawlers.
- Policies support reference-only, fill-missing, reviewed-follow and validated-auto-follow, by field/relation family and scope, with human protection and explicit overrides.
- Pausing adoption preserves bindings/evidence; disabling acquisition is separate. Correcting a mistaken binding produces a reviewed new binding revision and recalculates only its adopted support.
- Observe no-change using content hashes. Repeated delivery is idempotent. Absence in a partial snapshot, filtering failure or timeout is not a tombstone.
- Event/outbox publication occurs in the same database transaction as observation/proposal state; delivery is at least once, consumers deduplicate durable IDs and recheck expected revisions.
- Mapping repairs reprocess stored eligible snapshots with new mapping versions; record corrected outputs without falsifying the old run.
- Eligibility is attached to acquisition, storage, public display, onward export and external processing separately. An ineligible connector mode stays disabled while other sources proceed.
- Source withdrawal/termination enumerates affected artifacts, current values, caches, embeddings and model traces by provenance, then purges or restricts them as required and recomputes from remaining eligible evidence. Immutable history is not universal permission to retain restricted payloads; retain only permissible decision metadata.

## Implementation slices

1. Add production-only source registry/run ledger, bounded job claims with fencing, snapshot manifest/checksum validation, staging/observation storage and resumable checkpoints.
2. Add identity namespace and typed field/relationship mapping contracts with unsupported-state reporting. Implement binding/adoption policy commands, permissions and operator views.
3. Implement Bangumi snapshot adapter; use API only for allowed bounded enrichment. Parse ordered/repeated Infobox structures, subject/person/character/episode records and contextual relations; keep source relation constants versioned.
4. Implement VNDB bulk adapter using an eligible acquisition route. Preserve VN/release, staff aliases, release languages, character roles/traits/spoilers, official/MTL qualifiers and contextual voice roles. Track snapshot schema changes; do not treat edition-local IDs as globally stable identities.
5. Implement MusicBrainz adapter for release group, release, recording, work, artist/credit, medium/track and relationship attributes. Core, supplementary, image and replication inputs are separately selectable according to eligibility.
6. Connect change diff/proposals to P05 and projection updates to P06. Implement pause/resume, checkpoint inspection, changed-field explanation and bounded replay.
7. Run complete selected snapshot manifests, not just sample records. Reconcile input counts, duplicates, mapped items, unsupported fields and publication eligibility. Resolve every unexplained discrepancy before claiming scope completion.
8. Implement eligible export/attribution and withdrawal operations. Assess actual combined-dataset obligations before consolidated publication, including any derivative-database machine-readable offer. Physical table separation does not establish independent licensing. Source-user activity is excluded from native REZICS accounts, reviews and ratings unless a separate user-authorized import contract applies.

Each source field/relation declares `native`, `unmapped`, `excluded_by_rights`, `unavailable_from_source` or `unsupported`, with a reason. Scope is a versioned manifest, not an unbounded promise about private or unavailable provider data.

## Acquisition and scope gates

| Adapter | Initial path | Continuing path | Required qualification |
| --- | --- | --- | --- |
| Bangumi | Published Archive snapshot | Snapshot diff plus permitted targeted API enrichment | Terms, archive completeness, Infobox/relations coverage and deletion uncertainty |
| VNDB | Official bulk data only when its service conditions permit the use | Eligible snapshots/diffs; API for allowed bounded lookups | API/dump terms, separately licensed text/images and changing schema |
| MusicBrainz | Eligible core dump; supplementary inputs selected independently | Licensed replication or eligible periodic snapshots | Core vs supplementary/feed terms; source merges and artist-credit semantics |

Do not advertise broader rights because a record is publicly accessible. If commercial access or external processing needs authorization, implement and validate with permitted samples; keep that acquisition/processor mode off until eligibility is established. Alternative approved sources/manual contribution can keep a product line operational, but do not fulfill an uncompleted named-adapter gate.

## Acceptance and throughput

- Kill a run after fetch, normalization, proposal creation and commit; resume without duplicate canonical data.
- Deliver observations out of order; current head cannot regress. Aggregate finite bursts per object without waiting for all sources.
- Three conflicting sources preserve three claims and one policy-selected current value; a human correction remains protected.
- A missing source record does not delete a canonical object or user discussion. Known redirects/deletions retain exact source evidence.
- Rebinding pauses adoption, supersedes pending proposals and compensates the old target only if affected current revisions still match; independent human edits survive, and no reviews, histories or collections move.
- A rights withdrawal removes or restricts all required derivative copies and cached disclosures; a permitted audit stub does not expose removed source content.
- Roundtrip mapped semantics including ordering, qualifiers, partial dates and unmapped raw values. A preserved JSON blob alone is not native compatibility.
- Disallow prohibited source material from onward export or external AI requests through deterministic policy tests.
- Report source change time, observed time, adopted time and projection lag separately.
- Initial target: 50 normalized objects/s under P10's mixed workload, with actual row/WAL amplification measured; this is a test input, not a current promise.
- For ongoing work budget records N, bindings bN, update rate u, observation retention h and proposal fraction q. Only changed relevant facts invoke AI. Record retry multiplier and oldest queue age.
- At 500M/3B rows, snapshots stream by chunk into source-owner partitions; no in-process full corpus or all-pairs deduplication. P10/source report own complete capacity math.

## Ownership and verification

Add cohesive backend source/ingestion service owners, typed API endpoints and operator features under `apps/web/features/console` or a justified dedicated source feature. Keep source adapters separate from canonical writers. Test fixture contracts, backend/SDK types, parser fuzz/edge cases, replay/lease/race behavior and representative database plans. Human operator UI acceptance is tracked by P12.
