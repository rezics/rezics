# P04 — Production source ingestion and continuous observation

Status: initial observation/adoption slices exist; full source protocol, subscriptions and update jobs unqualified; further implementation gated by design review. Updated: 2026-09-07. Parent: [program and gates](README.md).

Current priority is the [four-family native schema gate](00-source-complete-schema.md):
VNDB, MusicBrainz, Bangumi and required book-index data. Implement complete mapping
and source/evidence persistence with P01/P03 before expanding operator UX or AI.
Native field/object conformance and later full-corpus acquisition are separate gates;
neither a raw archive nor one working record substitutes for either gate.

## Outcome and prerequisites

Deliver independently operable Bangumi, VNDB and MusicBrainz adapters, plus a
book-index acquisition/mapping route, using one source protocol. Novel Updates
is replaceable; book indexing is required. Initial loads and ongoing changes use
the same canonicalization and proposal path; neither bypasses P01/P03/P05 invariants.
[Source research](../../report/REZICS-source-integration-and-review-20260906.md) owns dated acquisition/license evidence. The local `services/main/src/services/content-pack` fixture loader remains local-only and is not repurposed as production ingestion.

## Persistent protocol

The maintainer accepted [NATS JetStream with a preferred Debezium Server outbox relay](../../architecture/event-streaming.md)
on 2026-09-07. That document owns transport, consumer topology, durability,
retention and relay qualification; the source report owns business semantics.
The selection is complete, but integration and the overall design gate are not.

Follow the [generic source binding/subscription contract](../../report/REZICS-source-integration-and-review-20260906.md#44-generic-source-bindings-and-subscriptions) and [scheduled event/job protocol](../../report/REZICS-source-integration-and-review-20260906.md#51-scheduled-checks-change-events-and-update-jobs). These are shared across all logical Unit owners, not owned by software or a provider. Source schemas map to the provider-independent native model; they do not create its object hierarchy.

Separate SourceDefinition/terms revision, SourceRecord identity, immutable SourceObservation, semantic mapping revision, SourceBinding, current SourceSubscription, AdoptionPolicy and SourceCheckPlan. Large raw payloads use object storage with checksums and exact observation references.

- A source record is keyed by source namespace, source entity type and source-native identity. Local/unstable source sub-IDs include containing record and observation context.
- Bindings record exact/scope-specific/candidate/rejected correspondence; one source object may map to several local scopes where its grain differs. A URL is not proof of identity.
- SourceRecord and logical Unit are many-to-many through individually scoped bindings. One binding has one source and one concrete target reference; occurrence/participation/revision targets use their own validated family. Confirmed exact-scope uniqueness and candidate correspondence have different rules. The current single-mapping shortcuts are not the final cardinality contract.
- Source fetching happens once per source record/snapshot; many bindings subscribe to its changes. Adoption policy does not create independent duplicate crawlers.
- Policies support reference-only, fill-missing, reviewed-follow and validated-auto-follow, by field/relation family and scope, with human protection and explicit overrides.
- Pausing adoption preserves bindings/evidence; disabling acquisition is separate. Correcting a mistaken binding produces a reviewed new binding revision and recalculates only its adopted support.
- One current subscription per binding records active/paused state, watched scope and versioned policy. Compatible subscription demand shares check plans, with credentials/visibility/response coverage isolated where needed. Unsubscribe/resume/rebind change the revision; final application checks it atomically so queued work cannot outlive its authority.
- Indexed due plans enqueue durable check requests. Record/query/feed checks produce immutable observations and transactional change events; paged binding fan-out produces coalesced target update jobs, which invoke canonical commands or review. Saved-query discovery does not itself approve Unit creation. Specify schedule, observation, fan-out and application idempotency keys separately.
- Use replayable JetStream event streams for observations/canonical changes and separate work-queue streams for fetch/map/apply tasks. SourceSubscription rows do not create individual broker consumers. Broker scheduling may wake bounded shards; indexed PostgreSQL check plans remain the authority for actual due work. Do not implement a second competing ready-queue authority in PostgreSQL.
- Observe no-change using content hashes. Repeated delivery is idempotent. Absence in a partial snapshot, filtering failure or timeout is not a tombstone.
- Event/outbox publication occurs in the same database transaction as observation/proposal state; delivery is at least once, consumers deduplicate durable IDs and recheck expected revisions.
- Mapping repairs reprocess stored eligible snapshots with new mapping versions; record corrected outputs without falsifying the old run.
- Eligibility is attached to acquisition, storage, public display, onward export and external processing separately. An ineligible connector mode stays disabled while other sources proceed.
- Source withdrawal/termination enumerates affected artifacts, current values, caches, embeddings and model traces by provenance, then purges or restricts them as required and recomputes from remaining eligible evidence. Immutable history is not universal permission to retain restricted payloads; retain only permissible decision metadata.

## Implementation slices

1. Close the `00` design-review gate with P01/P03: native semantic mappings, source/binding/subscription cardinality, compatible composite uniqueness/FK/partition keys, snapshot-local identity and versioned event/task/receipt contracts for the accepted broker. Then implement domain plan/checkpoint owners and qualify JetStream/Debezium delivery with P10. Production credentials are not a prerequisite for design or local conformance.
2. Add identity namespace and typed field/relationship mapping contracts with unsupported-state reporting. Implement binding/adoption policy commands, permissions and operator views.
3. Implement Bangumi snapshot adapter; use API only for allowed bounded enrichment. Parse ordered/repeated Infobox structures, subject/person/character/episode records and contextual relations; keep source relation constants versioned.
4. Implement VNDB bulk adapter using an eligible acquisition route. Preserve VN/release, staff aliases, release languages, character roles/traits/spoilers, official/MTL qualifiers and contextual voice roles. Track snapshot schema changes. Edition-local IDs are unstable across edits; map them to snapshot-scoped participation contexts or evidenced native variants, not an automatically created Edition layer.
5. Implement MusicBrainz adapter for release group, release, recording, work, artist/credit, medium/track and relationship attributes. Core, supplementary, image and replication inputs are separately selectable according to eligibility.
6. Connect change diff/proposals to P05 and projection updates to P06. Implement pause/resume, checkpoint inspection, changed-field explanation and bounded replay.
7. Run complete selected snapshot manifests, not just sample records. Reconcile input counts, duplicates, mapped items, unsupported fields and publication eligibility. Resolve every unexplained discrepancy before claiming scope completion.
8. Implement eligible export/attribution and withdrawal operations. Assess actual combined-dataset obligations before consolidated publication, including any derivative-database machine-readable offer. Physical table separation does not establish independent licensing. Source-user activity is excluded from native REZICS accounts, reviews and ratings unless a separate user-authorized import contract applies.
9. Implement the required book-index route: Work/Edition bibliographic inputs plus
   serialization/translation/volume/chapter/release-link cases through a permitted
   source or manual-contribution fixture. Open Library and Bangumi book data are
   verified starting inputs; a Novel Updates HTTP 403 does not defer the book model.

Each source field/relation declares `native`, `unmapped`, `excluded_by_rights`, `unavailable_from_source` or `unsupported`, with a reason. Scope is a versioned manifest, not an unbounded promise about private or unavailable provider data.

For the current schema milestone, every required catalog field must finish as
native (including implemented typed extensions); `unmapped`, `unsupported` and
raw-only storage fail the gate. Rights exclusions describe handling of actual
payloads, not permission to leave their required data model unimplemented.

## Mandatory Bangumi verification inputs

Read [rendered docs](https://bangumi.github.io/api/), the
[API repository](https://github.com/bangumi/api), its authoritative
[server OpenAPI](https://github.com/bangumi/server/blob/master/openapi/v0.yaml)
and referenced components, [Archive](https://github.com/bangumi/Archive),
[latest manifest](https://raw.githubusercontent.com/bangumi/Archive/master/aux/latest.json),
[common dictionaries](https://github.com/bangumi/common) and
[wiki syntax](https://github.com/bangumi/wiki-syntax-spec).
Use an identified User-Agent per the
[source guidance](https://github.com/bangumi/api/blob/master/docs-raw/user%20agent.md).
Actually call representative public endpoints; do not stop at reading a README.

The 2026-09-06 audit called thirteen public endpoints, including
[subject detail](https://api.bgm.tv/v0/subjects/253),
[contextual characters](https://api.bgm.tv/v0/subjects/253/characters),
[episodes](https://api.bgm.tv/v0/episodes?subject_id=253&limit=3&offset=0),
[book detail](https://api.bgm.tv/v0/subjects/870) and
[revision summaries](https://api.bgm.tv/v0/revisions/subjects?subject_id=253&limit=3&offset=0).
All returned 200. Preserve the narrow Infobox/nullability discrepancy rules from
the [verification report](../../report/REZICS-source-complete-catalog-schema-20260906.md#bangumi-documentation-source-and-live-requests)
and the full URL/field baseline in `00`; these are mandatory adapter fixtures.

## Acquisition and scope gates

| Adapter | Initial path | Continuing path | Required qualification |
| --- | --- | --- | --- |
| Bangumi | Published Archive snapshot | Snapshot diff plus permitted targeted API enrichment | Terms, archive completeness, Infobox/relations coverage and deletion uncertainty |
| VNDB | Official bulk data only when its service conditions permit the use | Eligible snapshots/diffs; API for allowed bounded lookups | API/dump terms, separately licensed text/images and changing schema |
| MusicBrainz | Eligible core dump; supplementary inputs selected independently | Licensed replication or eligible periodic snapshots | Core vs supplementary/feed terms; source merges and artist-credit semantics |

Do not advertise broader rights because a record is publicly accessible. If commercial access or external processing needs authorization, implement and validate with permitted samples; keep that acquisition/processor mode off until eligibility is established. Alternative approved sources/manual contribution can keep a product line operational, but do not fulfill an uncompleted named-adapter gate.

## Acceptance and throughput

- Qualify source observation/outbox -> Debezium -> JetStream -> impact planner -> task stream -> canonical command -> independent search/notification consumption. Relay restart, ACK/offset failure, broker failover, WAL pressure and consumers exceeding hot retention follow the [event-streaming acceptance](../../architecture/event-streaming.md#qualification-and-implementation-sequence). Persisted broker delivery alone is not native source conformance.
- A Unit binds multiple records and a coarse source binds multiple native scopes; confirmed equivalence cannot accidentally allocate duplicate identities. Manual and independent-provider inputs use the same native commands. Source local-key reorder/reuse preserves prior context and evidence without retargeting it.
- Compatible subscribers share one acquisition, including different target policies. Pausing one leaves other demand active, preserves existing values and fences its already queued jobs. Resume uses latest eligible state with a three-way comparison. Private acquisition scopes cannot leak through shared checks.
- Crash after due-plan advancement, observation commit, fan-out page or target commit; durable replay loses no work and applies no mutation twice. Duplicate events, expired/reclaimed leases, out-of-order observations and pause/rebind/policy edits racing with application are covered.
- Unchanged conditional/hash checks update check metadata without new canonical updates. Partial source disappearance is not a tombstone. Query discovery, provider feed and direct-record checks converge on the same governed matching and adoption path.
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
