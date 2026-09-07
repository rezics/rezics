# Source integration, continuous adoption, and review for operational REZICS

Date: 2026-09-06. Status: researched design and implementation input; no importer, production inventory, migration, or capacity benchmark was executed for this report.

**Scope correction and new evidence:** the current stage is native database
coverage for VNDB, MusicBrainz, Bangumi **and book indexes**, before broader source
operations or product polish. The [source-complete schema report](REZICS-source-complete-catalog-schema-20260906.md)
owns the full object/field scope and physical owners. It records thirteen successful
Bangumi API calls, resolved/pinned OpenAPI components and two literal-schema
discrepancies. Those live checks do not constitute an implemented importer.

## 1. Decisions and scope

REZICS should offer native catalog records that remain useful without contacting a source during a user request. MusicBrainz, VNDB, and Bangumi are explicit connector targets; book indexing is also mandatory, with Novel Updates or an equivalent provider. A connector supplies evidence and source-specific structure; it does not own REZICS identities, user activity, editorial judgment, or authorization.

Adopt these decisions for the refactor:

1. Separate source acquisition, source-record identity, local binding, source observations, and field/relationship adoption. Fetch each source artifact once per source run, not once per local binding.
2. Preserve source-specific semantics and immutable observation references. Normalize through versioned mappings into domain-owned current values and relationships, with one writer for each value.
3. Route source changes and user catalog submissions through the same proposal/execution protocol. Keep factual review, identity resolution, and public-content moderation as separate decisions.
4. Permit policy-controlled automation, including AI review, but require bounded evidence, deterministic validation, stale-state checks, and an auditable business operation. Model confidence is not a permission or an identity proof.
5. Make source binding reversible without merging or deleting REZICS Units. Provide compensation and re-evaluation for mistaken binding and incorrect adoption.
6. Treat acquisition eligibility, reuse rights, and official authority as different contracts. Disable an ineligible connector route or payload class while other work continues.
7. Deliver source coverage as an explicit matrix of readable, editable, queryable, exportable semantics. Retaining raw JSON alone does not satisfy compatibility.
8. Design for destructive schema changes and replacement deployment when useful, but isolate existing-data migration in its own plan. This report authorizes no execution against production.

The existing [metadata report](REZICS-动态元信息与渐进扩展架构-20260905.md), [structure and query report](REZICS-内容结构关系与查询模型-20260906.md), and [Catalog boundary report](REZICS-Catalog领域边界与实施分期-20260906.md) remain the semantic foundation. This report adds the operational source lifecycle and makes VNDB a full declared connector target.

## 2. Current implementation: what can be reused and what is missing

These observations are from repository code, not a production database inspection.

| Evidence | Existing capability | Refactor consequence |
| --- | --- | --- |
| [Unit external links](../../services/main/src/services/database/schema/unit.ts#L448) | Links reference a source Entity, have normalized URLs, attribution, withdrawal, and curation | Retain useful display links; add source-native IDs and revisioned bindings. A URL hash is not the provider record identity or synchronization cursor. |
| [Credit attribution](../../services/main/src/services/database/schema/entity.ts#L143) | Author, translator, publisher, and other roles | Preserve relationships but add scope, evidence, effective dates, and repeated role occurrences through the planned relationship owner. A publisher credit alone does not prove translation authorization. |
| [Content language support](../../services/main/src/services/database/schema/content-language.ts) | BCP 47-aware content language/channel contract and reverse search projection | Extend consumption-language declarations with scoped evidence/authority through the owning contract; do not introduce another competing language store. |
| [Unit history](../../services/main/src/services/database/schema/history.ts) | Immutable revisions, slots, heads, and AI-specific credit | Reuse revision references and attribution. Source observation, model assessment, and accepted local revision are different objects. |
| [Governance decision ledger](../../services/main/src/services/database/schema/governance.ts#L115) | Authority, policy basis, reversal, target, and immutable decision structure | Reuse decision principles. Current `actorProfileId` is required; automated operations need an explicit service principal/executing credential aligned with the identity refactor, not fabricated human attribution. |
| [Content review cases](../../services/main/src/services/database/schema/governance.ts#L253) | Platform/Realm moderation cases, reports, assignment, enforcement | Keep moderation ownership. Do not force every catalog field correction into a moderation case. |
| [Merge request schema](../../services/main/src/services/database/schema/unit-merge.ts), [merge worker](../../services/main/src/services/units/merge/worker.ts) | Idempotency, captured graph revisions, guarded phases, leases, retry, and reference movement | Reuse bounded execution and staleness patterns; source rebinding must remain a separate operation. |
| [Merge policy](../../services/main/src/services/units/merge/policy.ts) | Now version 2: two approvals, no self-review, veto, seven-day expiry; 500-row worker batches | Supporting governance work has advanced; it does not establish catalog/source model coverage or serve as the workflow for every source update. |
| [Email outbox](../../services/main/src/services/email/outbox.ts), [worker entry](../../services/main/src/worker.ts) | Existing asynchronous delivery and worker lifecycle patterns | Build a source/review-specific transactional event owner with lease fencing and idempotent consumers; do not couple its payloads or throughput to email. |

Inspection did not find a general MusicBrainz/VNDB/Bangumi ingestion owner, shared immutable source observations, per-field adoption policies, or catalog AI review execution pipeline. The showcase content-pack source resolver locates fixture directories; it is not a continuous catalog source connector.

## 3. Official acquisition evidence and practical connector choices

References were retrieved on 2026-09-06. Connector implementation must pin the actual source schema, data manifest, license/access terms, and retrieval time. Some live documentation includes changes dated later than this report; capability claims must be derived from the artifact actually imported, not a future-dated README entry.

### 3.1 MusicBrainz

MusicBrainz publishes PostgreSQL snapshots with checksums/signatures. Core `mbdump` is CC0. Derived data, including tags/ratings/annotations, has different licensing; image archive dump files are metadata connections, not image binaries. Core and supplementary payloads must remain distinguishable. [Official dump documentation](https://musicbrainz.org/doc/MusicBrainz_Database/Download), [data licenses](https://musicbrainz.org/doc/About/Data_License).

The Live Data Feed applies hourly replication packets; access and packet licensing require their own eligibility decision. Public API service use also distinguishes commercial use. Choose core snapshot ingestion for initial metadata, then licensed replication where required freshness justifies it; an eligible snapshot refresh route remains useful when replication is unavailable. Do not treat CC0 core facts as permission to use every hosted service without its terms. [Live Data Feed](https://musicbrainz.org/doc/Live_Data_Feed), [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API).

Connector requirements:

- Use MBIDs with entity type and source namespace. Ingest source redirect tables and keep retired identifiers resolvable; preserve provider redirect evidence separately from a REZICS merge decision. The published replication schema includes entity `gid_redirect` relations. [Replication documentation](https://musicbrainz.readthedocs.io/en/latest/musicbrainz_database/replication.html).
- Keep Work, Recording, Release Group, Release, Medium, and Track occurrence distinct. Preserve artist-credit text, join phrases, order, relationship definitions/attributes, precision of dates, and per-object language/script metadata according to the existing compatibility matrix.
- Decode the source mirror into normalized change envelopes. Do not replay source SQL directly into the REZICS database.
- Record replication sequence/schema version; stop that stream on a gap or schema mismatch. Recover with a validated snapshot and a defined continuation position.
- Process removal/redirect events as source lifecycle evidence. Never cascade them into deletion of local reviews, collections, reading history, or unrelated observations.

### 3.2 VNDB

VNDB publishes daily near-complete database dumps and separate taxonomy/vote exports. Dumps omit deleted entries and edit histories; their schema is not a stable API. The dump page explicitly applies API usage terms to dump access. Therefore switching from API to dump does not by itself resolve commercial service eligibility. [Official dump documentation](https://vndb.org/d14).

The Kana API documents 200 requests per five minutes, an execution-time budget, and non-commercial free use. It exposes distinct official flags for titles, editions, releases, and VN relations; release language metadata separately identifies machine translation. Staff edition IDs can be local and unstable across edits. Preserve these distinctions in adapter fixtures. [Kana API](https://api.vndb.org/kana).

The database uses ODbL/Database Contents License with exceptions: images and VN/character descriptions may carry separate rights; AniDB-derived anime data is NC-SA. Record these components independently, including attribution and redistribution obligations. An open database license does not license every linked image. [VNDB privacy and licensing](https://vndb.org/d17).

ODbL expressly permits commercial database reuse under its conditions, while distinguishing a derivative database, an independent collective database, and produced works. Public use can require attribution and an offer of the derivative database or changes. Therefore VNDB's database license and hosted access terms must be evaluated separately; neither implies that all reuse is forbidden or automatically cleared. Physical separation into tables does not by itself establish license independence. Design source-aware export/attribution from the start and evaluate the actual combined dataset before publishing a merged redistribution product. Where combined obligations cannot be met, keep eligible source views independently presented or obtain compatible rights instead of silently blending the material. [ODbL 1.0, sections 3–4](https://opendatacommons.org/licenses/odbl/1-0/), [Database Contents License](https://opendatacommons.org/licenses/dbcl/1-0/).

Connector decisions:

- Use an eligible daily dump route for initial and recurring bulk acquisition. Use permitted bounded API lookups for targeted refresh or missing details; no per-Unit polling loop over the entire corpus.
- Stream and partition snapshot comparison against the previous complete manifest. A missing ID means `missing_from_snapshot` until coverage and lifecycle evidence justify stronger conclusions. A partial download, changed filter, or rights restriction must not look like mass deletion.
- Preserve namespace/type prefixes for VN, release, character, staff, producer, tag, trait, and image identities. Keep staff alias identity separate from the person. Snapshot-local edition occurrences receive observation-scoped addresses and stable local occurrence reconciliation, never a fabricated globally stable source ID.
- Model VN tags and character traits as different governed predicate/definition families. Keep source hierarchy, path/context, spoiler and false-information flags; do not flatten trait labels such as a color into an unqualified global tag. Taxonomy and character-role semantics are part of the source capability fixture, not optional presentation polish.
- Produce explicit source-to-local mappings for release coverage, translations/patches, platform and distribution, producers, staff credits, roles/characters, and their source scope. Avoid merging VNs solely because titles or staff overlap.
- Do not bulk import public user lists as REZICS users or activity. User-authorized account transfer is a separate integration with consent, ownership verification, provenance, and deletion behavior.

### 3.3 Bangumi

The authoritative [rendered API docs](https://bangumi.github.io/api/),
[API repository](https://github.com/bangumi/api) and
[server OpenAPI](https://github.com/bangumi/server/blob/master/openapi/v0.yaml)
must be checked together with their external components. The API repository is a
documentation entry point; its v0 file is synced from the server repository.
Follow the [User-Agent guidance](https://github.com/bangumi/api/blob/master/docs-raw/user%20agent.md)
and actually request public endpoints while developing the mapping.

This audit verified thirteen HTTP 200 responses, including
[subject detail](https://api.bgm.tv/v0/subjects/253),
[related characters](https://api.bgm.tv/v0/subjects/253/characters),
[chapter pagination](https://api.bgm.tv/v0/episodes?subject_id=253&limit=3&offset=0),
[book detail](https://api.bgm.tv/v0/subjects/870), and
[revision summaries](https://api.bgm.tv/v0/revisions/subjects?subject_id=253&limit=3&offset=0).
Eight matched the literal schema; five exposed contradictory Infobox typing or
blood-type nullability. A narrow validation experiment resolved those mismatches.
The [new report](REZICS-source-complete-catalog-schema-20260906.md#bangumi-documentation-source-and-live-requests)
records the exact commit, requests, hashes, outcomes and adapter obligations.
API availability is not a reason to defer the core schema behind source infrastructure.

Bangumi Archive provides weekly wiki snapshots and a latest-manifest pointer. The archive includes typed subjects, persons, characters, episodes, ordered/raw wiki data and relationships, plus selected tags and rating aggregates. Source dictionaries and wiki grammar have separate official repositories. Pin all of these with the data artifact. [Bangumi Archive](https://github.com/bangumi/Archive).

The copyright/developer agreement distinguishes catalog information from user-authored posts and artwork; it permits API/archive development subject to its conditions. It also restricts unauthorized onward provision, requires consent and purpose limitation for user data, and contains termination/deletion terms. Interpret image and description rights separately and resolve the applicable onward-processing route before sending source payloads to an external AI service or redistributing source-derived exports. [Bangumi copyright and developer agreement](https://bgm.tv/about/copyright).

Connector decisions:

- Use the weekly artifact once per run, with streaming comparison. Targeted API revision/detail reads may reduce lag for active records; verify coverage and pagination of every endpoint used. The API schema contains revision endpoints, but that alone does not prove a complete global change feed. [Official API source](https://github.com/bangumi/api), [OpenAPI schema](https://github.com/bangumi/server/blob/master/openapi/v0.yaml).
- Retain subject-kind/granularity uncertainty. A source catalog entry can be usable before identity alignment to a local Work or Release is settled.
- Preserve Infobox order, repeated fields, raw text and parsed values; character-person-subject context and relation order must survive import and export.
- Treat source ratings and tag statistics as source-scoped observations, never as REZICS users' votes or native rating counts.
- Apply content/age/spoiler policy to presentation separately from whether metadata is factually valid. Do not silently discard a source field and still claim full semantic coverage.
- When source rights require withdrawal, identify affected material by its derivation links. Recompute adopted values from other eligible evidence or local contributions; purge affected blobs/caches/embeddings under the applicable policy. Preserve only the minimal non-content audit record that remains permitted. Avoid training durable model weights on imported source data by default because selective removal is then difficult to establish.

### 3.4 Book-index data is a required fourth family

Book indexing covers original/alternative titles, creators, languages, Work/text
version/publication/serialization distinctions, volumes/chapters, translators and
groups, original and translation status, publishers, identifiers and source update
links. Novel Updates is a reference, not the only acceptable provider. Its pages
returned 403 during this audit; no successful extraction is claimed.

[Open Library API documentation](https://openlibrary.org/developers/api),
[Work/Edition types](https://openlibrary.org/type/edition) and source code provide
a concrete bibliographic baseline. Both the
[Work example](https://openlibrary.org/works/OL15626917W.json) and
[edition listing](https://openlibrary.org/works/OL15626917W/editions.json?limit=2)
were read successfully. This alone does not qualify web-serialization/translation
updates, which remain explicit required fixtures and mapping work. Provider
eligibility cannot be used to drop the book model from the schema stage.

### 3.5 Connector eligibility is a configuration and delivery gate

Maintain a versioned rights/access manifest per source and payload class: acquisition mechanism, operational-use eligibility, attribution, redistribution, AI-processing destination, storage/retention, media rights, terms reference, and evidence of any arrangement. The three named connectors plus the selected book-index inputs form the initial control set; observations, policy history, and arbitrary third-party source registrations are not automatically bounded datasets. Eligibility gates the actual acquisition/use mode, not development of required native schema semantics with permitted fixtures.

Default fallbacks are concrete:

- MusicBrainz supplementary/replication access unavailable: import eligible core facts and declare reduced genre/rating coverage or slower freshness.
- VNDB access route not eligible for the intended operation: keep the connector disabled pending eligible access, while implementing/testing against permitted fixtures and populating the product from other permitted sources or direct contributions. Do not advertise VNDB coverage until actual access and conformance pass.
- External AI transfer not established for a source: use an eligible locally hosted review model, deterministic checks, or human review; do not silently send the payload to a third party. Local processing changes the transfer boundary, not the source's other obligations.
- Individual image/description rights unresolved: omit that payload, link to an appropriate source where permitted, and retain independently eligible structured facts. State the resulting coverage honestly.

These are actionable connector activation conditions. None is an academic or logical blocker for the platform architecture. Agreements, accounts, legal eligibility and budget still require real evidence; an agent cannot manufacture them by making a design decision.

## 4. Source and provenance contract

Use explicit concepts; names below indicate responsibilities, not a mandate for one giant table or premature cross-service RPC.

| Concept | Identity / essential information | Ownership and invariant |
| --- | --- | --- |
| Source provider | Provider namespace, owning organization Entity, endpoints, source schema/dictionary versions, access/rights manifest | Connector control owner; provider organization is not automatically the work's publisher or rights holder |
| Acquisition run | Source, artifact manifest, acquisition scope, checksums, completeness, sequence/cursor, start/end, parser version | Source-level run; publish completeness only after all required artifact parts validate |
| Source record | Provider + source entity type + full native identifier | Stable source locator; never keyed only by display URL or title |
| Source observation | Source record + observation identity, raw object pointer/digest, upstream revision or artifact position, observed time, source effective time, availability state | Immutable evidence; many fetches with unchanged content may advance last-checked metadata without producing duplicate facts |
| Source binding | Source record ↔ local reference + relation (`same_scope`, `contains`, `part_of`, `related`, `unresolved`), target scope, evidence, binding revision/status | Identity mapping owner; only validated exact-scope bindings may feed automatic identity-sensitive adoption |
| Source subscription | Binding, enabled/paused state, watched field/relation scope, adoption policy reference and subscription revision | Target curation owner; source following is distinct from user notifications and shared acquisition scheduling |
| Source check plan | Provider/record/query/feed scope, request coverage, interval or cursor, next due time, request validators, concurrency/rate budget and revision | Acquisition owner; compatible demand shares a fetch, while incompatible credentials, visibility or response scopes remain isolated |
| Adoption policy | Target scope, selected bindings, fields/relationship families, strategy, source priority, protected fields, review/risk policy and revision | Catalog curation owner; subscription is separate from acquisition schedule |
| Mapped source fact | Observation reference + source path/occurrence + definition mapping revision + typed value/relation + qualifiers | Domain source-evidence owner; provenance supports or contradicts a fact, without claiming source consensus |
| Adopted current value | Domain field or relationship plus revision and selection basis | Domain owner is the only writer; no independently mutable generic copy of the same canonical field |
| Change proposal | Bounded patch, expected local/binding/policy/schema revisions, input observation vector, evidence references, risk class | Catalog review owner; proposal is reviewable before it can affect public current state |
| Review assessment | Proposal revision, factual/identity/moderation task kind, structured result, model/evaluator version, evidence citations, cost/latency, abstention | Review owner; explanation is a concise decision rationale, not a request to store private model chain-of-thought |
| Execution receipt | Decision/authority, validated patch hash, before/after revisions, idempotency key, resulting event IDs | Domain executor; records one effective application despite at-least-once delivery |

This separation follows the general provenance distinction between entities, activities, and responsible agents; RDF is not required to implement it. [W3C PROV-O](https://www.w3.org/TR/prov-o/).

Observations need field states beyond a nullable value: present, explicitly empty, omitted by this endpoint, not accessible, unparseable, and withdrawn. Snapshot absence is another record-level state. Do not convert any of these into an unconditional field deletion.

### 4.1 Adoption semantics

Expose simple choices backed by precise contracts: reference only; fill missing values; follow selected fields; propose every change. Multiple sources can be selected, with strategies for single-valued fields, sets, ordered occurrences, and contradictory evidence.

Use a three-way comparison: prior accepted source observation, new source observation, and current local value/revision. Preserve a human correction unless its policy explicitly delegates that field back to automation. Keep a local value plus its evidence/protection state rather than permanent global priority for all edits from a source.

For relationships, reconcile source occurrence IDs and qualifiers. A repeated performer in a different role, a different date interval, or a second track occurrence is not a duplicate edge. Ordered lists require sequence-aware patches; their rows cannot be combined as a set.

An update to a selected source triggers a bounded coalescing window per local target, initially 30 seconds with a five-minute maximum proposal delay under ordinary load. Collect the latest available observations; do not wait for every bound source. Record the input vector. A newer observation or local edit invalidates only assessments whose dependency set changed. These are initial tuning defaults, not measured service guarantees.

### 4.2 Official language, publisher relations, and authority

`ja`, `zh-Hans`, or `ko` identifies language; none can be globally official. The claim concerns a particular title, translation, edition, release, channel, region, and time. Preserve separate claims for:

- Official title naming.
- Authorized translation or localization of specified content.
- Official release/distribution.
- Original language and original edition.
- Human, machine, or mixed translation method.
- Source assertion, community assessment, and directly verified publisher/rights-holder evidence.

A Japanese original, Chinese fan translation, and Korean licensed release can coexist under the same creative work. An authorized machine translation is possible; machine translation does not imply unofficial status. Unknown authorization is not false.

Represent the relevant translator, localization organization, publisher, distributor and authorizing rights holder as distinct Entity relationships scoped to the content/release and language/channel. Store evidence and effective dates. A source provider such as VNDB is the observer; it does not become the authorizing publisher. Importing an organization also grants no login, verification badge, representative authority, or right to edit as that organization.

### 4.3 Repair mistaken bindings without identity destruction

Rebinding is a first-class versioned operation:

1. Preview which source-derived values/relations and pending proposals depend on the old binding.
2. Freeze automatic adoption for that binding, write a binding revision, and invalidate its pending proposals.
3. Detach active evidence from the wrong local scope. Compensate only still-derived values whose local revision has not independently changed; conflicts become specific follow-up proposals.
4. Bind to the correct target or leave unresolved; regenerate mapped proposals from retained eligible observations.
5. Rebuild affected bounded projections, retain the repair decision and stable Unit identities, and report completion/remaining conflicts.

No user reviews, history, collections, or native votes move during this operation. If two local Units themselves need merging, invoke the separately governed merge workflow with an impact manifest. Incorrect canonical merging needs its own split/recovery design; do not pretend reassigning a source URL reverses all social-data movement.

### 4.4 Generic source bindings and subscriptions

**Maintainer decision, 2026-09-07.** The source protocol applies to every indexed
logical Unit owner. It is not a software/VN-specific extension. The native
[capability model](REZICS-Catalog领域边界与实施分期-20260906.md#23-provider-independent-native-model)
decides local identity; source schemas do not prescribe native object levels.

```text
SourceProvider 1 -- N SourceRecord 1 -- N SourceObservation
                          |
                          1
                          |
                          N
                     SourceBinding N -- 1 LocalReference
                          |
                          1 -- 0..1 current SourceSubscription
```

Logical Units and source records therefore have a many-to-many correspondence.
Each binding has one source record and one validated target/scope; several rows
express multiple correspondences. `LocalReference` normally identifies a Unit,
but may identify an occurrence, scoped participation context, named form or exact
relation/version where needed. Each family must specify concrete owner-key FKs
and checked alternatives. This diagram does not create a universal identity
parent or authorize unchecked `target_type + uuid` storage.

- A Unit may use several records from the same or different providers. A coarse
  source record may describe several native objects or scopes. Distinct source
  records may support the same native identity.
- Equivalence, containment, partial coverage and candidate matches have different
  meanings and eligibility. For a confirmed exact source scope, define a unique
  canonical mapping per semantic referent; candidates can coexist without
  permitting accidental duplicate canonical identities. Identity splitting or
  merging is governed separately from binding.
- Separate stable source-record keys from snapshot-local subobject keys and JSON
  locations. For unstable local identifiers, retain containing record, observation
  and local key/path. Cross-snapshot continuity requires explicit reconciliation;
  equal positions or numbers are insufficient. This rule applies to every source,
  including VNDB edition/staff contexts. Native versions do not embed provider-local
  identity as their defining property.
- Stable bindings follow a source record across observations rather than remaining
  pinned to its first payload. Binding revisions retain exact observation evidence
  for each mapping decision.

The product action "subscribe to this source" configures the binding's current
subscription. Keep its state and policy distinct from the correspondence:

| Setting or transition | Required behavior |
| --- | --- |
| No subscription / reference only | Retain binding/provenance without requesting automatic target updates. Other consumers may still acquire the source. |
| Active subscription | Watch selected fields/relationship families and generate bounded update work using the configured policy. |
| Review-only policy | Produce reviewable proposals; no automatic canonical application. |
| Fill-missing / approved automatic follow | Apply only eligible selected changes under current policy and authority, with protected human corrections. |
| Pause or unsubscribe | Increment the subscription revision, retain bindings/evidence/current values, and fence old queued work from applying under the revoked subscription. |
| Resume | Compare the latest eligible observation with last accepted source state and current local revision; do not blindly replay every missed intermediate change. |
| Rebind | Freeze adoption, revise correspondence, supersede dependent work and compensate only still-derived values under section 4.3. |

One current subscription per binding owns a bounded/versioned scope definition;
history is separate. Different bindings may request different policies or freshness,
but compatible acquisition coverage is shared at the source record, query or feed
level. Credentials and visibility are part of compatibility: sharing must never
leak private source material. Track active demand incrementally rather than
rescanning all subscriptions for every job. Removing one subscription does not
cancel another consumer's demand. Provider shutdown and acquisition eligibility
are separate controls.

## 5. Pipeline and operational reliability

### 5.1 Scheduled checks, change events and update jobs

The maintainer accepted [NATS JetStream and the preferred Debezium Server outbox relay](../architecture/event-streaming.md)
on 2026-09-07. That document owns the transport implementation choice, event/task
retention, durable consumer topology, relay recovery and broker capacity. The
business protocol below remains authoritative for source/subscription behavior.
Neither existing adapters nor the worker scheduler implement the full protocol.
Final versioned envelopes, physical keys and runtime checks remain design-gate
deliverables; the broker selection itself is accepted.

```text
Due SourceCheckPlan
  -> SourceCheckRequested -> durable check job -> source worker
  -> unchanged: record check result, validators and next due time
  -> changed: immutable observation + SourceRecordChanged outbox event
  -> paged active-binding/subscription lookup
  -> target-scoped, coalesced update job
  -> map and three-way compare -> policy decision / review proposal
  -> canonical owner command + application receipt + local change event
```

1. Claim indexed due plans in bounded batches by routing bucket, due time and
   stable ID. Advancing the schedule and enqueueing the request are atomic and
   deduplicated by plan revision and scheduled occurrence. Missed runs coalesce
   under an explicit catch-up policy, avoiding an unbounded timer backlog.
2. A check can target a source record, saved discovery query, change feed or
   snapshot manifest. New query results establish source records and enter
   governed matching/creation; discovery alone does not approve a new Unit,
   merge or binding. Initial import uses the same mapping path.
3. Workers claim jobs with leases and fencing generations, then fetch outside
   database transactions. Supported validators and [HTTP conditional requests](https://www.rfc-editor.org/rfc/rfc9110.html#section-13)
   complement hashes. Timeout, authorization failure and partial-snapshot absence
   are not source deletions.
4. Commit changed observation state and its outbox event together. Unchanged
   observations update check metadata without redundant canonical update work.
   Preserve relevant schema/availability changes; mapping repairs can separately
   request reprocessing of stored snapshots. Use provider ordering where available
   and fenced per-record acquisition otherwise; arrival time alone cannot make an
   older observation the current head. Opaque hashes/revision tokens prove equality,
   not temporal order; adapters must state their ordering and uncertainty rules.
5. Page indexed affected bindings/subscriptions with durable fan-out checkpoints
   and enqueue idempotent target work. Watch filters eliminate irrelevant changes.
   Coalesce under section 4.1 without waiting for every provider, retaining the
   exact observation vector.
6. Compute a bounded patch against prior accepted source state, new mapped state
   and current local state. Apply through canonical owner commands or issue a
   review proposal. Queue payloads contain references and manifest pointers, not
   complete source graphs.
7. At final application, atomically validate authority, lease generation,
   subscription/binding/policy/mapping revisions, observation dependencies and
   expected target revision. A pause/rebind racing with application fences the
   old decision. Save the receipt and local outbox event with the mutation.
   Durable idempotency keys suppress retries; newer relevant state supersedes or
   replans stale work rather than silently overwriting local edits.
8. Retry with delay/jitter and finite attempt/elapsed-time budgets. Bound active
   jobs, payload bytes, per-provider concurrency, per-target work and connections;
   expose failed/dead-letter work and explicit replay. JetStream durable pull
   consumers distribute ready tasks. PostgreSQL `FOR UPDATE SKIP LOCKED` may
   claim bounded due plans or fallback relay work; it is not the selected event
   transport or an ordinary catalog-read consistency policy.

At-least-once transport with transactional publication and durable application
receipts is the contract. External calls do not become exactly once because a
queue row is unique. See [transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)
and [PostgreSQL locking clauses](https://www.postgresql.org/docs/18/sql-select.html#SQL-FOR-UPDATE-SHARE).
Source and target transactions have separate owners. Initial same-database checks
remain real constraints; cross-database extraction requires a separately reviewed
fencing/reference protocol.

### 5.2 Mapping and review pipeline

```text
Source-level acquisition and manifest verification
  -> partitioned normalization and change extraction
  -> source observation commit + transactional event
  -> binding lookup + policy-selected impact planning
  -> deterministic validation / duplicate candidates
  -> versioned bounded proposal
  -> AI factual / identity / moderation assessments as applicable
  -> policy decision or human queue
  -> domain transaction with precondition checks, revision, receipt, outbox
  -> idempotent search / notification / reverse-projection consumers
```

Transactions must commit state and event together. Delivery is at least once; consumers deduplicate by stable event/operation identity, and keep ordering or expected versions per aggregate. Do not claim exactly-once provider calls. An outbox avoids the state/event dual-write gap. [Transactional outbox guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).

Use the accepted JetStream event/task transport with separately scalable Bun
consumers. PostgreSQL owns transactional plans, intent/checkpoints, cancellation
versions and effective-application receipts; Debezium Server is the preferred
committed-outbox relay to qualify. Consumer ACK follows a durable application or
continuation. Broker leases/redelivery do not replace business fencing, and no
database lock is held while downloading data or calling a model. This supersedes
the earlier database-backed-ready-queue default without changing source adoption
or the independent legacy migration boundary.

Use immutable input pointers in job payloads, not whole objects. Quarantine schema errors; circuit-break a connector on abnormal removal counts, parsing failure, sequence gaps or rights-policy change. A failed source should not consume every worker slot. Apply per-source and per-risk fairness, aging of low-priority work, byte/token quotas, and bounded retry/dead-letter storage with explicit retention and operator acknowledgement.

A source artifact can be enormous while each job remains small. Split acquisition manifests into content-addressed chunks; stream decompression and parsing into bounded batches. Reject decompression bombs and invalid encodings. Source-provided URLs are untrusted: only the connector's approved endpoint policy can fetch them, with redirects, destination validation, byte/time limits and no ambient credentials. Source text cannot issue model instructions or grant tools.

Out-of-order events are normal. Store upstream sequence when supplied; otherwise use complete snapshot generation plus source-specific comparison rules. Fetch time is not universally authoritative source chronology. A policy/schema/model change creates a resumable scoped replay job; do not recompute the whole platform on each deployment.

## 6. AI review, deduplication, and human operations

### 6.1 Separate the decisions

| Review task | Main result | Automation boundary |
| --- | --- | --- |
| Catalog fact review | Supported patch, conflict, insufficient evidence, or invalid mapping | Can propose and approve allowed low-risk changes under a calibrated policy |
| Entity resolution | Ranked candidate bindings, same-scope evidence, contradictory scope signals | Can reuse known verified source identity; ambiguous identity remains a proposal, not an automatic merge |
| Content moderation | Allowed, restricted, needs review, or policy violation with rule basis | Governs public exposure independently of factual truth |
| Organization authority | Evidence of role/representation/authorization in a particular scope | Requires the relevant authority workflow; a model opinion grants no organization privilege |

User catalog submissions receive immediate deterministic validation and bounded duplicate suggestions, then a durable receipt/status. A request need not wait for AI. Public reviews and discussions have content review where appropriate; their opinions must not be forced to agree with external catalogs. Private reading history should not be shipped to AI as a side effect of metadata reconciliation.

### 6.2 Candidate search before model reasoning

Candidate generation uses exact namespace identifiers first, then domain/scope-specific normalized names, language/script, dates, creators, version/platform, and bounded similarity retrieval. Never compare every new item with all existing items; never merge solely on ISBN, title, embedding similarity, or majority source agreement. A source may have copied another source.

Keep candidate-query budgets aligned with the existing search architecture. A bounded top-K set, initially up to 50 candidates for review, must include its retrieval strategy/version and any budget-exhaustion indication. Failure to find a candidate is not proof that no duplicate exists. Do not create duplicate Units silently when candidate retrieval is unavailable; use the source staging/catalog-entry state until resolution can resume.

Maintain an adjudicated evaluation set containing same-title different works, original versus translation, revision versus adaptation, composite volumes, editions/ports/patches, reused identifiers, pseudonyms, multilingual names, inconsistent dates, and high-fanout characters/creators. Test retrieval recall separately from decision accuracy so that the model is not blamed for candidates it never received.

### 6.3 Rollout and evaluation

Start with deterministic automatic actions that have explicit proof (replaying an already verified binding, no-op changes, schema-valid additive facts under an approved policy), and AI in shadow/recommendation mode. Advance model-reviewed low-risk actions through a small canary to broader application only after precision, abstention, correction rate, multilingual behavior, and cost meet declared thresholds on independently adjudicated examples.

Initial acceptance target: the one-sided 95% confidence bound on erroneous automatic low-risk changes must be below 0.1%, with no critical identity/authority error in the canary; stratify by source, language, field class, and model/prompt version. Roughly 3,000 zero-error independent examples support only an approximate aggregate 0.1% upper error bound; this does not establish safety for underrepresented strata or correlated cases. Keep those strata recommendation-only until adequate evidence exists. Identity merges, rights/representative authority and overwriting protected human edits do not inherit this low-risk threshold.

Evaluation must also include prompt injection in imported text, stale local revisions, conflicting sources, unsupported citations, unavailable evidence, timeout, model refusal, and malformed structured output. Validate every cited evidence reference against the supplied immutable evidence set. Store model/version, prompt template digest, tool/evidence manifest, output, rule decision and execution receipt; never persist credentials in review traces.

After acceptance, sample automated results continuously and monitor appeals/corrections by cohort. A material model, prompt, mapping, source-policy or evidence-retrieval change requires replayed evaluation before that cohort regains automation. An error threshold breach disables automatic application for the affected scope while ingestion and evidence collection continue.

### 6.4 Operator and contributor workflow

The operator queue should show the actual before/after patch, affected scope, source differences, protected local edits, model rationale with citations, and downstream impact. Offer approve selected changes, revise, reject with reason, defer, rebind, request evidence, and pause the affected policy/connector. Group a bounded set of comparable cases; bulk acceptance must expose count and risk and retain per-object outcomes.

Contributor status needs received, validating, under review, accepted, partially accepted, needs clarification, rejected, and superseded states with relevant reasons and a path to correction/appeal. Review latency and queue age are product behavior. Avoid unreviewable permanent limbo or suggesting that a model has certified truth.

A small initial team cannot be assumed to have four independent available reviewers. Use one authorized human for ordinary disputed metadata; [P05](../plan/operational-refactor-20260906/05-review-and-reconciliation.md) selects two independent authorized reviewers and no proposer self-approval for irreversible/high-impact identity merges. Insufficient staffing leaves those identities separate; emergency operational recovery is not a routine merge-review bypass. Do not count multiple model calls as independent human approvals. Exact staffing/coverage remains an operational input, not an unresolved data-model question.

## 7. Capacity, costs, and bounded growth

All numbers below are design scenarios, not measured REZICS performance or current source sizes. Every potentially corpus-scale relation must be analyzed at 500,000,000 rows and 3,000,000,000 rows. Control definitions may use a proven bound; histories and registrations grow independently.

### 7.1 Row and relationship amplification

Illustrative heap-plus-required-index allowances, excluding large payload blobs:

| Relation class | Assumed bytes/row | 500 million rows | 3 billion rows |
| --- | ---: | ---: | ---: |
| Source locator/binding | 192 | 96 GB | 576 GB |
| Observation metadata | 240 | 120 GB | 720 GB |
| Mapped fact / evidence edge | 216 | 108 GB | 648 GB |
| Proposal/decision/receipt metadata | 320 | 160 GB | 960 GB |

Decimal units; these are allowances to replace with `pg_column_size`, relation/index sizes and production-like distributions. They exclude WAL, replicas, free space, vacuum overhead, backups and object-store payloads.

Let `N` be local objects, `b=2` bindings/object, `a=8` active mapped source facts/binding, and `h=6` retained observation headers/binding. This yields `2N` bindings, `16N` facts and `12N` observation headers. At `N=500M`, the illustrative allocation is 1B bindings (192 GB), 8B facts (1.728 TB), and 6B headers (1.440 TB), about 3.36 TB before local domain rows, revisions, jobs or payloads. At `N=3B`, it is about 20.16 TB. The 3B relation checkpoint is therefore not an upper system limit.

At an illustrative 4 KiB of stored evidence per retained observation, `12N` observations require about 24.58 TB for 500M objects and 147.46 TB for 3B objects before replication. Content-addressed chunks, retained patch chains with bounded reconstruction, and evidence referenced from shared snapshots may reduce duplication, but reduction must be measured. Do not promise perpetual full payload retention by accident; retain evidence needed for live decisions and bounded operational history under explicit source/right policies.

Use domain-owned table groups, with source identity registry routing by provider/type/key and observation/fact partitions that can be independently moved. Local foreign keys protect in-shard ownership; the global locator resolves cross-shard targets through versioned references and repairable projections. Partitioned unique constraints must include partition keys; a UUID alone does not prove provider-native uniqueness. [PostgreSQL partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html).

Initial implementation may run on one PostgreSQL deployment, but logical routing, per-owner transactions, immutable IDs, outbox consumers and migration manifests must support moving hot table groups. Partitioning a table does not itself add machines or solve global joins. Avoid global transaction requirements spanning arbitrary provider and local-object shards; use idempotent binding events and local receipts to reconcile the two owners.

### 7.2 Change and review workload

Let `r` be the daily fraction of source bindings with meaningful changes, `g` be average changed records coalesced into one proposal, `q` be fraction needing AI, and `p` be the fraction of proposals requiring a human. Then:

```text
source changes/day = N * b * r
proposals/day      = source changes/day / g
AI reviews/day     = proposals/day * q
human cases/day    = proposals/day * p
human hours/day    = human cases/day * mean_minutes_per_case / 60
```

For an illustrative 400,000 catalog objects (not a verified count of books or live acquisition demand), `b=2`, `r=1%`, `g=2`, `q=25%`, `p=1%` gives 8,000 changes, 4,000 proposals, 1,000 AI reviews and 40 human cases/day. At three minutes/case that is two staff hours/day. Binding counts and change rates have not been measured; these assumptions must not become an unexamined staffing forecast.

At 500M objects the same assumptions produce 10M changes/day (116/s), 5M proposals/day, 1.25M AI reviews/day and 50,000 human cases/day. At 3B objects multiply by six. Human labor plainly does not scale at the same referral fraction: reduce scope, improve rules/evidence, increase automation only with measured quality, and allocate queue capacity by product priority. Never hide the unsatisfied work in an unbounded queue.

With 20 seconds average model latency, 1.25M calls/day needs about 289 concurrent calls on average; a fivefold arrival burst needs about 1,447 concurrent calls if absorbed immediately. Use backpressure and batch/offline capacity rather than assuming unlimited concurrency. Model token cost is:

```text
daily model cost = reviews * (mean_input_tokens * input_price_per_million
                            + mean_output_tokens * output_price_per_million) / 1,000,000
```

At 6,000 input and 700 output tokens, 1.25M reviews use 7.5B input and 875M output tokens/day. Choose actual provider/model only after evaluation and rights eligibility; prices, quotas and hardware costs are not inferred here. Define daily/source/risk budgets, expected retry multiplier, and a stop/admission policy before enabling a cohort. Initial bulk loading uses deterministic mappings for well-formed records and reserves AI for ambiguity; it must not make one expensive model call mandatory for every row.

### 7.3 Snapshot scanning is an explicit exception with a budget

Where an upstream provides only full snapshots, detecting changes requires reading that source snapshot. This is source-scoped scheduled acquisition, not a full REZICS recomputation. Stream/sort-partition comparison and emit only changed records. Record its entire recurring cost before accepting the connector freshness target.

For 500M source records at an assumed 2 KB/record, one snapshot is 1 TB; at 3B it is 6 TB. A daily pass averages 11.6 MB/s or 69.4 MB/s and must parse at least 5,787 or 34,722 records/s. Two retained snapshots double payload storage; compare manifests and sorting/temp I/O add cost. Real compressed sizes, decompression speed, high-percentile record width, dictionary fanout, CPU and available catch-up window must be measured. A single compressed stream can become a serial bottleneck.

If that source's full-snapshot route cannot meet the agreed freshness/cost, switch to an eligible delta feed/mirror contract, narrow refresh priority with honest freshness, or change the published SLO through an explicit operational decision. The platform must not claim daily complete refresh while silently skipping most records.

### 7.4 Validation and scaling triggers

Initial test profile inherits the architecture reports' candidate 100 mixed reads/s, 20 foreground mutations/s, 50 source objects/s, 32 concurrent clients and fivefold burst. Add realistic p95/p99 relation fanout, long names, repeated occurrences, multilingual skew, a few very hot creators, deleted/withdrawn records, source downtime and duplicate delivery. Those rates are a starting acceptance experiment, not proof of 500M/3B capacity.

Measure and retain:

- `EXPLAIN (ANALYZE, BUFFERS)` for locator lookup, per-target source evidence, due jobs by partition, candidate retrieval, operator queue and reverse impact scans.
- Sustained and burst throughput, commit latency, row/index bytes, WAL per accepted mutation, write/replica amplification, hot-key lock time, memory cap, API/network/model budgets, vacuum and partition maintenance.
- Target: interactive local reads p95 <=300 ms server time; submission receipt p95 <=500 ms excluding uploads; accepted low-risk change visible in projections p95 <=60 s after commit. Tune against real hosting before promising externally.
- Source freshness is measured against source publication cadence plus acquisition/review lag, not just the last worker heartbeat. Initial daily/weekly-source targets allow their publication interval plus 24 hours processing; more active subsets can use permitted targeted reads.
- Begin capacity expansion when sustained ingestion exceeds 60% of measured worker/IO budget or backlog delay consumes 50% of the freshness allowance; throttle bulk work before interactive latency or replica lag breaches its budget. Track oldest age as well as count.
- Scale the implicated worker/partition/table group, rebalance hot keys by stable record/occurrence keys, and enforce per-target work quanta. Do not place every record from a popular provider/creator into one indivisible worker key.

All scheduled work uses keyset cursors and bounded batches. No request fetches all evidence, all source bindings, all merge impacts, or all candidate Units. Large review patches use immutable manifests plus paged impact views and atomic publication of a validated revision pointer; they do not bypass size limits with an enormous JSON transaction.

### 7.5 Subscription and scheduling amplification

Let R be distinct source records requiring checks, S active bindings, T the check
interval in seconds, u the changed-record fraction per interval and f=S/R the
mean fan-out. Naive record polling costs R/T checks/s; unfiltered target work is
approximately R*u*f/T, before retries, coalescing and mapping fan-out. Daily
individual checks for R=500M/3B require about 5,787/34,722 checks/s even when no
content changes. Sharing removes per-binding duplication but cannot remove the
provider rate limit or full-snapshot cost.

Budget subscriptions, check plans, observations, fan-out receipts, outbox events,
pending jobs and retained execution history separately at 500M/3B rows and their
actual induced counts. Plans can cover a feed/batch, so plan count need not equal
R or S. State the bound for provider configuration; user-created queries and
subscriptions are growing data, not implicitly bounded control tables. Include
measured heap/index widths, WAL, retention/cleanup, rebuild reserve, network,
source limits, hot-source fan-out and P10 latency/concurrency targets. Due/ready
indexes must support selective claims; reverse source lookups and target receipts
need independent routing. Final PK/UNIQUE/FK and partition choices remain an
explicit design-review gate.

## 8. Implementation ownership and sequencing

Implement inside the modular service first; separately scaling workers does not require microservices for every conceptual box.

| Deliverable | Proposed owner / existing owner to extend | Depends on | Completion evidence |
| --- | --- | --- | --- |
| Source registry, manifests, acquisition adapters, observation storage and cursor/lease contracts | New `services/main/src/services/sources/`, connector submodules only when needed; typed physical tables in database schema | Identity/reference contract; object storage policy | One fixture artifact per provider streams, resumes, deduplicates and records complete/partial status |
| Provider-native identity mapping and reversible binding | Source identity owner coordinated with Units/relationship owner | Stable references, relationship scope, optimistic revisions | Wrong-target rebind preview and compensation; no social-data movement |
| Native source mapping and export | Book/music/software/catalog domain owners, shared definition/structure mapping | Domain contracts; languages/authority relations | Published semantic coverage manifest and source fixtures; no unknown field reported as completed |
| Adoption policies and change proposals | New catalog curation/review owner under `services/main/src/services/` | Observation and binding contracts; domain conditional mutation APIs | Human correction protection, conflict representation, policy revision replay |
| Model assessment and policy execution | Review owner plus authorization/governance/history owners | Service principals, evidence access policy, proposal contracts | Shadow evaluation, malformed/stale/adversarial cases, receipts and canary decision |
| Queue, events and projections | Source/review event owner; existing worker and search/notification owners | Transactional operation boundaries | Crash/retry/out-of-order tests; bounded backlog and fair scheduling |
| Operator and contributor experience | `apps/web/features/` owners for curation/governance and contribution status | Typed APIs and terminology/i18n resources | A contributor can see outcome and correct it; an operator can inspect/repair the actual patch |

Backend executors must use domain services; connectors and models do not write arbitrary tables. App Router files remain adapters. New public text follows typed localization and terminology resources. Run affected TypeScript/code-integrity checks during implementation; browser or visual acceptance requires explicit user request under repository policy.

## 9. Conformance and operational acceptance

Each provider gets a machine-readable field/relationship matrix pinned to schema and fixture versions. Per entry track `native`, `unmapped`, `excluded_by_rights`, `unavailable_from_source`, or `unsupported`; retain the reason, mapping precision and owner. Model expressibility, imported coverage, ongoing freshness and reuse eligibility are different report dimensions.

Mandatory acceptance scenarios:

1. **Semantic roundtrip:** source fixture -> native domain read -> edit -> source-compatible export preserves the relevant fields, order, direction, qualifiers, source IDs, original language codes/raw values and explicit unknown states. Exact bytes are required for retained raw artifacts; semantic roundtrip permits declared canonical formatting. An unmapped field is not a pass merely because its JSON survives.
2. **MusicBrainz structure:** one recording in multiple track occurrences; release group distinct from Work; artist-credit join phrases and dates; multiple relationship attributes; source redirects and replication gap recovery.
3. **VNDB structure:** multilingual original/official/fan/MTL distinctions; release versus VN; edition-local staff scope; same person using aliases; character traits with source hierarchy/spoiler and false-information flags; contextual voice credits; snapshot-local identifier changes.
4. **Bangumi structure:** series versus individual book uncertainty; ordered/repeated Infobox fields; episode ordering; character/person/subject casting context; source rating aggregation provenance; missing record in a partial versus complete archive.
5. **Source lifecycle:** partial download, checksum failure, schema drift, fetch outage, real redirect, suspected deletion and rights withdrawal cause the correct distinct states without deleting user content.
6. **Adoption:** two sources conflict; three update at different times; user edits during review; a protected field changes upstream; only selected fields continue following; ordered relation reconciliation preserves repeated occurrences.
7. **Recovery:** duplicate and out-of-order messages, crash after commit before publish, expired lease, late model result, policy revocation and model rollback each yield at most one effective accepted operation and an inspectable receipt.
8. **Repair:** a wrong binding is moved to a correct target, affected source values are compensated safely, independent edits survive, and pending review work is superseded.
9. **Privacy/rights:** restricted payload cannot be sent to an ineligible processor, public source user lists are not imported into native users, raw evidence access is authorized, and scoped material withdrawal reaches caches/projections and eligible retained blobs.
10. **User value:** a user can search an alternate-language title, distinguish releases and their language/officialness, traverse a role/character relation, see source-scoped information, and submit a correction with a visible outcome. Native reviews/ratings/collections remain clearly attributable to REZICS participants.
11. **Scale:** representative distribution evidence, cost formulas, measured throughput and a documented partition/worker expansion path cover 500M/3B relations and their amplification. An unexplained queue growing faster than it drains is a failed operational acceptance.

## 10. Resolved choices, later measurements, and activation gates

No academically or logically unsolved blocker was found in this source/review scope. The following work must be scheduled rather than left as vague architecture questions:

| Item | Decision now | Remaining evidence / latest point |
| --- | --- | --- |
| Whole-corpus polling versus source-level snapshots | Acquire once per source; subscribe/adopt per binding; bounded streaming delta extraction | Actual artifact sizes and achievable freshness before connector activation |
| AI directly edits production | Model emits assessments/proposals; domain executor checks authority and revisions | Evaluation and canary before each automated cohort |
| Conflicting sources and human edits | Keep observations; three-way adoption with field protection | Domain-specific ordered/set semantics before its mapper ships |
| Source link mistaken for identity merge | Reversible binding with compensation; separate canonical merge | Impact/recovery tests before automatic binding writes |
| Officialness | Scoped naming/translation/release/authorization claims with organization relations | Concrete authority fixtures before language/release contract freeze |
| Source acquisition/reuse/AI rights | Versioned payload-specific eligibility and alternate routes | Actual applicable terms/arrangements before real acquisition/public exposure/external transfer |
| Human staffing | Risk-based queue with measurable capacity; do not require four people for every correction | Staff coverage and latency targets before opening contribution traffic |
| Model choice and cost | Provider-neutral assessment contract; no automatic selection by benchmark reputation | Adjudicated local evaluation, quotas and prices before purchasing/enabling |
| Physical topology | Domain-owned current/evidence storage plus stable routing and resumable relocation | Measured row width, hot keys and deployment capacity before production sizing |
| Approximately 400k total legacy records; site stopped per maintainer | Separate offline migration software; no old API/schema/data compatibility requirement | Frozen-input inventory and reconciliation belong to offline-tool acceptance, not new-schema implementation or acceptance |

The intended result is a working supply-and-maintenance system: usable coverage, transparent source choices, repairable mistakes, affordable ongoing review, and user contributions that improve REZICS rather than being overwritten by the next import.
