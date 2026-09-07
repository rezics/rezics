# REZICS system readiness audit

Date: 2026-09-06. Status: source inspection, current primary-source research, and recommended implementation decisions. This is not a production assessment, benchmark result, deployment authorization, or completed migration.

## 1. Purpose and evidence boundary

The intended release must support actual catalog discovery, reviews, book lists, organized ratings, reading history, multilingual metadata, source ingestion, and continuing editorial operation. Complete destructive API/schema replacement is authorized under the current baseline. Old data is input to separate offline software, not a compatibility constraint or a prerequisite for new-schema acceptance.

This audit inspected the three architecture reports, current database schemas and services, API boundaries, worker entry point, release configuration, and deployment/recovery documentation. It did not connect to production, inspect private user data, start a frontend, perform browser acceptance, run a capacity benchmark, or change application code. The latest maintainer clarification is approximately 400,000 legacy records in total and an already-stopped website; it supersedes the earlier rounded source/no-source category estimates. The agent has not independently verified production state or counts.

Evidence labels used below:

- **Verified implementation:** directly present in the current checkout.
- **Verified contract gap:** the current contract cannot provide the proposed product guarantee.
- **Code-derived risk:** a concrete execution path admits a failure or unbounded cost, without a reproduced production incident.
- **Qualification required:** deployment, performance, or operational evidence was not collected here.

The [existing report index](README.md) correctly separates design adoption from implementation. Continue using that distinction. No issue found here lacks a practical solution; unresolved measurements are release tasks, not fundamental design blockers.

## 2. Preserve and extend the existing foundations

| Foundation | Verified evidence | Consequence for the refactor |
| --- | --- | --- |
| Stable Unit identities with separate domain tables | [Book](../../services/main/src/services/database/schema/book.ts), [Entity](../../services/main/src/services/database/schema/entity.ts), [Profile](../../services/main/src/services/database/schema/profile.ts) | New identities stay stable under the new contract; the offline converter may preserve or remap old IDs. No legacy-ID compatibility gate applies. |
| Reading journal and current state | [Progress schema](../../services/main/src/services/database/schema/progress.ts), [Progress API](../../services/main/src/services/api/progress/index.ts), [journal page](../../apps/web/features/progress/pages/unit-progress-page.tsx) | Reading history is already implemented. Qualify and extend it; do not plan an unnecessary replacement from zero. |
| Stored ordered lists and reverse membership | [Collection schema](../../services/main/src/services/database/schema/collection.ts), [paged items](../../services/main/src/services/api/collections/service.ts) | Preserve stored list membership, ordering, attribution, and revision semantics. Dynamic query lists remain a separate capability. |
| Realm-specific ratings and incremental distributions | [Score schema](../../services/main/src/services/database/schema/score.ts), [score statistics](../../services/main/src/services/database/schema/aggregate.ts), [Reviews API](../../services/main/src/services/api/reviews/index.ts) | Organized ratings have a foundation. Versioned rubrics, participant policy, and historical interpretation are additional guarantees. |
| Bounded search with runtime plan validation | [Search architecture](../../services/main/src/services/search/README.md), [work policy](../../services/main/src/services/performance/policy.ts) | Preserve authorization rechecks, stable cursors, work budgets, and count semantics while improving relevance and relational discovery. |
| Resumable identity merge and selected maintenance jobs | [merge worker](../../services/main/src/services/units/merge/worker.ts), [chapter draft worker](../../services/main/src/services/units/book-chapter-draft-worker.ts), [Tag projection worker](../../services/main/src/services/tag-expressions/projection-worker.ts) | Reuse bounded batches, ownership checks, revision preconditions, and lease fencing where implemented. |
| Privilege-separated deployment and isolated backup restore | [deployment](../operations/production-deployment.md), [recovery](../operations/postgresql-backup-recovery.md) | Extend an existing operating model. Do not replace it with an improvised database reset script. |

## 3. Material findings and implementation decisions

### SYS-01 — Identity unification is not yet implemented

**Priority:** P0 for identity-contract implementation. **Evidence:** verified contract gap.

`profile.auth_user_id` is non-null and unique, and references private `users`; `entity` is a separate Unit subtype. Progress, scores, collection attribution, and other social records reference Profile IDs. This does not yet implement the adopted Auth/Entity participation model. [Profile schema](../../services/main/src/services/database/schema/profile.ts#L9), [Entity schema](../../services/main/src/services/database/schema/entity.ts#L49), [Score schema](../../services/main/src/services/database/schema/score.ts#L22)

**Decision:** preserve the existing personal public Unit ID during conversion to the unified Entity model. Keep private Auth IDs, credentials, sessions, account controls, and personal recovery ownership outside publicly queryable Entity metadata. An imported author/character/organization must not gain login or representation authority because it becomes an Entity. A catalog identity match must never merge authentication principals automatically.

Separate the authenticated actor, represented Entity, authorization grant, and affected resource in every write and audit record. Personal reading history remains personal; authorization to publish as an organization does not confer access to members' private journals. An explicit organization activity record is a different owner and operation. An organization's rating must not silently count as the controller's independent personal vote.

**Acceptance:** migrate every Profile foreign key through an inventory; test anonymous, owner, unrelated authenticated user, delegated publisher, revoked delegate, platform moderator, and importer identities against read/write/export/history endpoints. Preserve blocked relationships and private preferences. No imported Entity can impersonate a user, and no user gains private account access through a public identity merge.

### SYS-02 — Search named “relevance” currently orders by update time

**Priority:** P0 for the search-and-choose product line. **Evidence:** verified contract gap.

The Search owner explicitly documents `relevance` as `(updatedAt DESC, Unit ID DESC)`, not request-time relevance scoring. Sparse and dense plans deliberately share that order. The implementation has valuable bounded work, but a book-title search cannot claim best-match ordering from this contract alone. [Search architecture](../../services/main/src/services/search/README.md#ordering-sources-and-complexity)

**Decision:** implement actual, versioned catalog relevance with priority tiers for normalized exact title/qualified alias, useful prefix/title matches, and broader text matches. Names, aliases, source identifiers, language/script context, and edition identity must participate explicitly. Preserve originals; normalization is a search transformation. Do not solve relevance by an unbounded sort over every match or by applying restrictive relation filters after a permanently truncated global Top-K.

Use an index-supported tier/order contract and a measured plan selector. Cross-language title search, same-title ambiguity, partial match, source-ID lookup, and edition grouping each need reference judgments. Every cursor must include the rank-policy version and stable continuation information. A bounded partial page must expose truthful continuation/completeness; a zero-result page must not be presented as proof that no matching work exists. Search and Feed may intentionally have different continuation presentation, but must not silently convert partial catalog discovery into an exhaustive absence claim.

**Acceptance:** maintain an independently judged query corpus, stratified by Chinese/Japanese/Korean/English names, aliases, short/common titles, source-only names, and ambiguous editions. For exact known title or alias queries, require the intended object or a clearly labeled ambiguity group in the first five results for at least 98% of the reference set. Report reciprocal rank and relevance quality separately from latency. Relation-sensitive queries must include counterexamples where the correct candidate falls outside the first generic text window.

### SYS-03 — Local structure and Collection mutation can load the complete owner

**Priority:** P0 before large source structures and large lists are accepted. **Evidence:** code-derived scale risk.

`loadContentStructureSnapshot` loads every node in an owner structure. Collection edits similarly call `loadCollectionStructureSnapshot`, which selects all items; restore deletes and reinserts that owner's entire membership. Public page limits do not bound this mutation work. These histories already have delta/checkpoint machinery, so the gap is not “every history row is always a full copy.” [content load](../../services/main/src/services/content-structure/storage.ts#L178), [Collection load/restore](../../services/main/src/services/collection-structure/storage.ts#L7), [Collection batch](../../services/main/src/services/collection-structure/batch.ts#L55)

**Decision:** retain adjacency and ordered membership, but make ordinary mutations depend on changed nodes/items and bounded sibling windows. Use revision-aware pagination and batch permission checks. Prepare large restores/checkpoints in segments and atomically publish a completed revision. Keep source track numbers, episode numbers, and chapter designators separate from fractional ordering keys.

For newly accepted formal `book.contents` and `media.contents` parent hierarchies, require acyclic parent containment; navigation links may cycle. Preserve historical cyclic source structures as inspectable evidence, and produce an explicit repair proposal before publishing them as a formal hierarchy. Cross-Unit containment traversal additionally needs a visited set, allowed-edge policy, revision policy, and work budget. This resolves the earlier “should cycles be allowed?” question without imposing one graph rule on every predicate.

**Acceptance:** exercise one-item edits in owners with 10,000, 100,000, and 1,000,000 nodes/items. SQL rows read, memory, and lock duration must depend on the changed window rather than complete owner size. If a domain imposes a smaller true semantic bound, document and enforce it in every writer; do not confuse an arbitrary page limit with such a bound.

### SYS-04 — A single serial worker loop couples unrelated workloads

**Priority:** P0 before continuous ingestion or AI review goes live. **Evidence:** verified implementation and code-derived delay risk.

The worker serially awaits email, merges, chapter jobs, Tag projections, ranking, cleanup, theme review, and resource monitoring in one outer loop. An early thrown error returns to the outer catch before later work runs. A slow external call or busy maintenance phase can therefore delay unrelated duties. This is not evidence that every job is currently unreliable. [worker loop](../../services/main/src/worker.ts#L109)

**Decision:** use separately scheduled, bounded worker pools for interactive-critical delivery, source acquisition, normalization/matching, AI review, and heavy projection/maintenance. Start with independently deployable processes using PostgreSQL durable jobs/outboxes; a new message broker is not a prerequisite. Each pool needs its own concurrency, deadline, retry, queue-age objective, circuit breaker, and per-source/owner fairness. Apply global database connection admission across API, workers, canaries, and operator tasks.

No network fetch or AI call should hold a database transaction open. Persist a claim and evidence revision, perform the external work, then revalidate lease ownership, source revision, target revision, and policy before committing. Persist jobs atomically with the state change that creates them. Repeated events must be safe, not merely improbable. [AWS transactional outbox guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)

**Acceptance:** hold an AI request until timeout and verify verification-email delivery and ordinary writes remain within their budgets. Kill a worker after claiming, after external response, and before committing; replay without duplicate accepted changes. Make one source continuously busy and prove other sources make progress. Trigger ingestion pause without stopping public reads or user submissions.

### SYS-05 — Email completion is not fenced to the claiming attempt

**Priority:** P1, before increasing worker concurrency. **Evidence:** code-derived correctness defect; no production incident reproduced.

Email claims increment `attemptCount` and replace `leaseExpiresAt`; completion/failure update `WHERE id = ... AND status = 'processing'` without matching the attempt or a lease token. If a lease expires, another worker reclaims it, and the old external request completes, the old attempt can finalize the new claim. Merge and chapter workers already demonstrate stronger lease-token ownership. [email claims](../../services/main/src/services/email/outbox.ts#L43), [completion predicate](../../services/main/src/services/email/outbox.ts#L95), [chapter lease fencing](../../services/main/src/services/units/book-chapter-draft-worker.ts#L63)

**Decision:** persist an unpredictable lease token or monotonic claim generation; compare it on every completion/failure/renewal. Use provider idempotency where available and document the remaining send-versus-ack ambiguity where it is not. A fenced database update alone cannot prevent a duplicated external send.

Authentication email callbacks also launch enqueueing with `void ...catch(...)`, so the callback can return before durable queue insertion. Audit the owning authentication framework's transaction/callback semantics and implement an acknowledged, retryable enqueue contract; do not claim this existing callback guarantees eventual delivery. [authentication email callbacks](../../services/main/src/services/auth/index.ts#L109)

**Acceptance:** an expired attempt cannot change a newer claim's status. A process exit between authentication callback and enqueue produces either a durable intent or a defined retry/resend path. Separate provider acceptance from delivery, bounce, and user receipt.

### SYS-06 — Ratings are mutable and organized-rating policy is incomplete

**Priority:** P0 for organized-rating publication. **Evidence:** verified contract gap.

Current scores are one integer from 1–10 per Profile/Unit/Realm. Posts intentionally render linked live scores. `realm_score_context` points to the current explanatory Post; the score table explicitly records a TODO for immutable history. This is suitable for a current personal rating but cannot prove which rubric governed an older score or preserve an editorial rating at publication time. [Score schema](../../services/main/src/services/database/schema/score.ts#L15)

**Decision:** retain current personal ratings as a fast projection and add immutable rating/rubric revisions where historical interpretation is part of the product. Organized rating owns a versioned rubric, target scope, eligibility, represented Entity policy, aggregation rule, moderation state, and effective dates. Reviews explicitly choose a frozen rating revision or a labeled current-rating link. Existing live links retain their documented semantics during migration; do not fabricate historical values.

Keep imported source ratings separate by source, scale, population, timestamp, and evidence. Do not count them as REZICS votes or average fundamentally different populations into a purportedly universal score. Current `score_stat` already makes ordinary aggregate reads bounded; extend this through controlled deltas, not per-request scans over all raters. [aggregate schema](../../services/main/src/services/database/schema/aggregate.ts#L39), [aggregate API](../../services/main/src/services/api/reviews/index.ts#L809)

**Acceptance:** changing a rubric cannot reinterpret older organized ratings silently; deleting or restricting a private score cannot reveal its old value through a public revision endpoint; one actor controlling multiple Entities cannot silently multiply an electorate. Show count/distribution and scope, not only an opaque number.

### SYS-07 — Reading privacy needs an explicit first-use policy

**Priority:** P0 for promoting reading history. **Evidence:** verified default; not an established authorization bypass.

The shared resource default is public. Profile preferences also default score and progress visibility to public. In the ordinary progress dialog, the first new record submits the default and the item visibility selector is rendered only for existing records. Global preference still constrains effective visibility. [defaults](../../services/main/src/services/database/schema/contract-values.ts#L407), [preferences](../../services/main/src/services/database/schema/profile-preference.ts#L38), [dialog](../../apps/web/features/progress/components/unit-progress-dialog.tsx#L93)

**Decision:** make newly collected reading history private by default, with an explicit share option at first creation/import and a clear distinction between account-wide visibility and an individual record. Leave previously explicit visibility choices intact; do not bulk-publicize or silently rewrite legacy preferences. Public activity publication must be a deliberate product action, not an incidental consequence of auto-tracking.

Preserve journal events, rereads, unknown date precision, exact target edition, content occurrence/revision, and current-state derivation. Opening a detail page is not proof of reading. Cross-edition progress transfer requires explicit alignment and user intent. Export/import should preserve these meanings and use idempotent external entry IDs. An account-wide timeline needs its own owner-leading cursor/index; an index only on `(owner, unit, time)` does not prove efficient all-book chronology.

**Acceptance:** first save, automatic tracking, batch import, review attachment, public profile, organization delegation, export, deletion, restore, and search caches obey the same effective visibility. Test this at API level. Rendered acceptance remains the maintainer's responsibility unless requested separately.

### SYS-08 — Tag presentation still has an owner-size-dependent count and sort

**Priority:** P1 before broad imported tagging. **Evidence:** code-derived scale risk.

`listGlobalUnitTags` uses `count(*) over()` and computed Wilson ordering before `LIMIT`. It is scoped to one Unit, so this is not a whole-corpus scan, but the final limit does not prove bounded work for a heavily tagged owner. No per-owner upper bound was established in this inspection. [Tag query](../../services/main/src/services/tags/service.ts#L98)

**Decision:** use owner-scoped precomputed ordering/count projections or bounded, explicitly labeled count semantics. Keep tag definitions, source assertions, community judgments, and derived effective tags distinct. A source withdrawal or inference-rule retirement retracts its support; it must not erase independent user evidence. Full rebuild commands may remain explicit maintenance operations, but routine source changes must update the affected dependency set.

**Acceptance:** a popular Unit with many tags and a popular Tag with many Units each receive separate skew tests. Verify ranking, permission filtering, and count meaning after withdrawal, negative votes, source deletion, rule retirement, and replay. Existing public-position projection machinery is a useful foundation, not proof that every other tag projection is incremental.

### SYS-09 — Book format has a concrete unresolved storage contract

**Priority:** P0 before the new publishing contract is frozen. **Evidence:** verified TODO.

Book `format` remains legacy free text, hidden from Unit CRUD but retained for search compatibility; its comment asks whether replacement should be `tagId` or `tagIds`. [Book schema](../../services/main/src/services/database/schema/book.ts#L24)

**Decision:** use typed, potentially multi-valued format facets backed by governed definition/Tag identities, independent of tag voting. Separate dimensions such as binding/carrier, digital representation, and textual form; enforce exclusivity only within dimensions that truly require it. A combined string is preserved in source evidence and mapped to zero or more justified facet assertions. A PDF file format belongs to the digital artifact/edition it describes, not automatically to every abstract work or related book. This resolves the singular-versus-plural question without creating a generic untyped list.

**Acceptance:** round-trip ambiguous legacy values without guessing; search uses the new indexed facet owner; successful cutover removes the old live field and its obsolete code paths through a new forward migration. Existing released SQL remains immutable.

### SYS-10 — Four-person merge approval is a workflow choice, not a universal invariant

**Priority:** P1 before duplicate resolution operates at import volume. **Evidence:** verified policy plus staffing risk.

The current policy requires four approvals, forbids self-review, supports veto, and expires requests after seven days. [merge policy](../../services/main/src/services/units/merge/policy.ts#L4)

**Decision:** preserve audited, risk-sensitive governance but replace the single global threshold with a versioned policy. Exact repeated imports under an already established source namespace/ID must resolve idempotently, not create duplicate Units that require committee merges. Cross-record identity merges remain separately governed from source binding and field updates. Initially require two independent authorized reviewers for irreversible/high-impact identity merges, with no proposer self-approval. A staffing shortfall leaves the identities separate and usable with reversible source correspondence; it is not a routine exception to merge review. AI may supply evidence and a recommendation but is not an independent human reviewer. [P05](../plan/operational-refactor-20260906/05-review-and-reconciliation.md) owns the selected policy.

**Acceptance:** dedupe replay produces no merge request for the same established source ID; a stale proposal cannot merge changed targets; reviews record policy/revisions; merge completion preserves reference behavior and privacy. Queue-age and operator workload are measured before increasing auto-acceptance.

### SYS-11 — Existing recovery tolerates up to a day of lost activity

**Priority:** P0 for active public operation. **Evidence:** documented operating objective, production qualification required.

The current documented installation is single-host, with daily logical backup and weekly full isolated restore, an off-host recovery-point objective of at most 24 hours, and explicitly no PITR/HA claim. The existing procedure is much stronger than an unverified dump, but active user reviews and journals are less replaceable than imported metadata. [deployment](../operations/production-deployment.md), [recovery objective](../operations/postgresql-backup-recovery.md)

**Decision:** before inviting continuing user contribution, qualify a target **RPO of at most five minutes for authoritative user data** and **RTO of at most four hours for the launch dataset**. Retain independently restorable logical archives and add a reviewed base-backup/WAL recovery path. A replica can reduce downtime but is not a backup. This recommendation changes the existing logical-only operating policy; it does not assert that PITR is already enabled.

PostgreSQL requires a physical/base backup and an uninterrupted WAL chain for PITR; a `pg_dump` archive cannot be replayed with WAL. PGroonga additionally documents WAL resource-manager and crash-safety configuration; its presence in the database makes extension-specific recovery testing necessary. Qualify the pinned PostgreSQL/PGroonga versions, primary crash recovery, archive replay, index rebuilding, and search parity together. [PostgreSQL PITR](https://www.postgresql.org/docs/current/continuous-archiving.html), [PGroonga WAL resource manager](https://pgroonga.github.io/reference/streaming-replication-wal-resource-manager.html)

**Acceptance:** restore into an isolated new environment, recover to before a deliberately bad write, verify account/authorization constraints and user-record checksums, rebuild/check search, and measure elapsed time. Alert on WAL/archive age, backup verification failure, disk growth, and queue freshness. Separate backup access, encryption-key recovery, and application credentials; protect unrelated Outline services. Do not claim HA while operating a single failure domain.

### SYS-12 — Independent release boundaries need a coordinated contract cutover

**Priority:** P0 before switching the new application. **Evidence:** verified deployment contract and integration risk.

Web Worker, API/worker/database, and public API package have independent release boundaries. Server maintenance cutovers already stop writers before a breaking database migration. The component manifest currently lists maintenance cutovers; do not treat old prose describing one past release as the complete current allowlist. [deployment contract](../operations/production-deployment.md), [current component manifest](../../deploy/release/components.json)

**Decision:** give the breaking persisted/API release a concrete target contract generation. Deploy the matching new Web, API and workers while the site remains stopped; old clients need not work. Resume traffic only after the new generation is verified. Explicitly invalidate incompatible cursors and caches. A new client must not be promoted against an incompatible old API, and automatic application revert must not restore binaries that cannot read the new database.

**Acceptance:** test previous cached Web/API-client requests against the cutover boundary, distinguish expected upgrade errors from silent corruption, and verify the public health probe reflects the intended contract. Never reverse successful database migration automatically. The repository's advisory `Check` workflow remains advisory; deterministic implementation checks still have to pass locally and in the implementation evidence.

## 4. Destructive replacement and independent offline transfer

**Revised 2026-09-07:** follow the [breaking replacement baseline](../plan/operational-refactor-20260906/00-source-complete-schema.md#breaking-replacement-baseline).
The maintainer reports the site is stopped and the entire legacy dataset is
approximately 400k records. The earlier final-freeze, online expand/contract and
CDC alternatives are superseded; do not implement them for this refactor.

| Track | Required result | Dependency boundary |
| --- | --- | --- |
| New system | Final owner-local schema, no old global parent or compatibility layer, rewritten consumers, fresh installation and full native conformance | Does not require old data or a working legacy converter |
| Separate offline software | Frozen-export input, explicit old-to-new mappings/dispositions, bounded transform, retry and reconciliation | Consumes the final target contract; never ships as runtime compatibility |
| Reopening | Matching new application generation, selected imported data, recovery and product checks | Later operational action; does not delay schema implementation/acceptance |

Legacy IDs, old v1+ routes, Auth/session encodings and old record shapes may be
remapped or retired. Imported records still need coherent new references,
privacy and truthful provenance. The converter owns those dispositions; they
do not require old tables, schema aliases or API adapters in the application.
New-model stable IDs, history, restore and asset integrity remain required.

Keep released migration checksums as historical evidence and generate replacement
DDL through repository tooling. A fresh target must reach the final schema without
loading old data. Its correctness is accepted independently of production export
access or offline transfer rehearsals. Before reopening, prevent old binaries from
restarting against the new database; failure leaves the site stopped or restores
the matching new deployment. No reverse conversion to the old schema is required.

[P11](../plan/operational-refactor-20260906/11-migration-and-cutover.md) owns these
separate tracks. The 400k one-time input does not lower the capacity baseline below.

## 5. Capacity, skew, and workload requirements

The minimum design baseline is **500,000,000 rows for every potentially corpus-scale relation**, with a **3,000,000,000-row estimate**. This is not a statement that current hardware can hold or serve those quantities. Source observations, fact revisions, participation rows, list membership, journals, and tag support can each grow faster than the number of catalog objects.

### 5.1 Storage and growth math

Illustrative bytes below include an assumed heap-plus-secondary-index budget per row and must be replaced with measurements including alignment, TOAST, fillfactor, and actual indexes. GB/TB are decimal. They exclude replicas, WAL, backups, temporary builds, and raw payload objects.

| Assumed row budget | 500 million rows | 3 billion rows | Typical sensitivity |
| --- | ---: | ---: | --- |
| 128 bytes | 64 GB | 384 GB | Narrow membership/locator, before extra indexes |
| 256 bytes | 128 GB | 768 GB | Narrow relation or current-state record |
| 512 bytes | 256 GB | 1.536 TB | Indexed revision/journal/claim record |
| 1,024 bytes | 512 GB | 3.072 TB | Wider evidence/revision data |

At three sources per catalog object and two preserved observations per source, observations alone are `6N`: 3 billion rows at the 500-million-object baseline and 18 billion at 3 billion objects. This multiplier must be modeled rather than treating “supports 3 billion objects” as a sufficient evidence-storage plan. Store large immutable raw payloads in bounded objects with content hashes, ownership, retention, and restore manifests; SQL stores selectively indexed locators and extracted assertions. Do not retain every unchanged poll as a duplicate full payload.

`daily_delta = watched_records × observed_daily_change_fraction`; `AI_reviews = changed_records × semantic_change_fraction × AI_eligible_fraction`. For illustration only, 800,000 watched records at 1% daily change produce 8,000 observations/day. At 1% human escalation that is 80 human tasks/day before deduplication/coalescing. Count source HTTP requests, downloaded dump bytes, normalized facts, projection writes, AI tokens, and human tasks separately.

### 5.2 Required partition/owner decisions

| Dataset | Owner/access pattern | Scale strategy and skew gate |
| --- | --- | --- |
| Facts, relations, current metadata | Catalog owner Unit; reverse creator/role queries | Co-locate owner's transaction; indexed reverse projection. Do not shard from mutable tags or language. |
| Source observations | Source namespace/record and observation sequence | Hash/range subdivision and immutable payload objects; fair source polling and bounded due queue. |
| Journals and private activity | Personal owner plus time; per-target views | Owner-leading keyset index, separate target projection where needed; history growth must not increase current-state reads. |
| Lists/structures | List/structure and ordered occurrence | Paged access, local mutation, segment checkpoint; no whole-owner reconstruction on every change. |
| Ratings/tag judgments | Actor/target uniqueness; hot target aggregate | Idempotent changes and deterministic lock ordering; shard aggregate deltas when measured hot-key service time exceeds admission budget. |
| Jobs/outbox | Ready status, availability, shard/tenant fairness | Small active indexed working set; bounded retention/archive for completed records; no shared all-history scan to find due work. |
| Search | Language/title/alias/relations and stable order | Serving partitions below the smallest row/term/index-size limit, routing, bounded candidate merge, and explicit fan-out admission. |

Keep the active source connector registry and job-policy registry bounded by enabled connectors/policies; historical source records are not control data. Do not exempt growing registries from corpus-scale analysis merely because they contain definitions.

Groonga documents separate table-record, key-space, distinct-term, and index-size ceilings. A 500-million-row single search index is not the capacity plan. Use the actual table/index flags and versions to derive limits, alert at 50% of the tightest proven capacity, and complete partition/cutover before 70% or earlier when forecast growth during lead time would consume the margin. These percentages are proposed operating margins, not vendor limits. Query fan-out must remain bounded as partitions grow; owner/domain routing and independently built discovery projections are required when unrestricted scatter/gather can no longer satisfy the budget. [Groonga limitations](https://groonga.org/docs/limitations.html)

### 5.3 Qualification profile

Use a provisional launch qualification profile of 100 interactive reads/second, 20 user mutations/second, and 50 normalized source changes/second for one hour, then a five-minute 5× interactive burst. These are chosen test targets, not observed demand or proven infrastructure capacity. Replace them with higher measured/forecast demand before activation. Include a 24-hour source catch-up while ordinary user traffic continues.

Report p50/p95/p99, database queue time, locks, statement plans, rows and blocks visited, WAL bytes, disk/index growth, cache misses, worker concurrency, retry rate, queue age, AI cost, and operator escalation. Final selected qualification targets are centralized in [P10](../plan/operational-refactor-20260906/10-capacity-and-operations.md): detail/current-state reads p95 ≤300 ms, normal search p95 ≤400 ms / p99 ≤1.2 s, simple writes p95 ≤500 ms, and <0.5% unexpected server errors. These targets are not measurements. Large exports, maintenance and AI results are asynchronous and have separate completion objectives. Sustained user-path latency or database connection pressure pauses bulk work first.

Distributions must include popular titles/tags, a source that updates many fields together, duplicate source identities, a prolific creator, sparse versus dense filters, privacy-heavy results, users with 100,000 journal entries, and million-item owners. Use representative physical samples plus index/algorithm proofs and the full 500-million/3-billion growth model. A small successful benchmark is not capacity certification.

At deployment level, recompute connection admission using `API replicas × pool size + all worker pools + canaries + maintenance/verification headroom`; adding pools without changing the documented connection budget is not safe scaling. [current deployment pool accounting](../operations/production-deployment.md#database-rules)

## 6. Operating and security release gates

| Gate | Required evidence |
| --- | --- |
| Authorization and privacy | Multi-identity API matrix across current values, histories, source evidence, search, exports, organizations and revoked grants; no private data in public AI prompts or telemetry |
| Input and fetch safety | Typed parse before use; size/time bounds; safe URL schemes and redirect/DNS checks; internal network destinations denied for untrusted source URLs; unsupported payloads quarantined |
| Durable work | Atomic enqueue, idempotent effect key, fenced completion, target revision check, bounded retry/dead-letter, operator replay and cancellation |
| Ingestion operations | Per-source pause/resume, catch-up progress, source freshness, change/no-op/error counters, sample reconciliation, license/rights policy attached to records |
| User contribution operations | Submission receipt and state, duplicate resolution, moderator queue, appeal/correction, abuse limits and audit; AI provider failure does not lose submissions |
| Privacy lifecycle | User export and account closure/erasure policy, dependent data disposition, retention schedule, and deletion reapplication after backup restore; existing implementation coverage still requires verification |
| Recovery | Measured RPO/RTO drill, isolated restore, extension/search checks, recoverable encryption keys, independent asset manifests, recovery identity and operator runbook |
| Release | Historical migration checksums, fresh target-schema replay, matching new Web/API/worker generation, cache/cursor invalidation, fail-closed deployment and new-contract recovery; offline transfer has its own checks |
| Deterministic integrity | Affected TypeScript checks, contract/runtime tests, schema and migration checks, generated client consistency, i18n checks when text changes; preserve advisory CI policy |
| Product acceptance | Search relevance reference set plus maintainer acceptance of the promoted book/review/list/rating/history/tag scenarios; no claim of rendered acceptance from type checks |

These are concrete engineering acceptance items. They do not assert an existing exploit. OWASP's API guidance specifically identifies object/property authorization, unrestricted resource consumption, server-side request forgery, and unsafe third-party API consumption as relevant risk categories for identifier-heavy and ingestion-heavy systems. [OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)

## 7. Work sequencing and nonblocking follow-up

1. Freeze identity/ownership/reference, language/provenance, rating-history, and source-change contracts. Resolve SYS-01, SYS-06, and SYS-09 in the shared foundation plans before writing incompatible import adapters.
2. Deliver bounded mutation/read paths and durable worker ownership. Resolve SYS-03 through SYS-05 and incorporate SYS-08 into Tag/search work.
3. Implement ingestion and the product paths against those contracts. SYS-02 and SYS-07 are direct launch criteria for search and reading-history promotion.
4. Run isolated migration rehearsals and recovery qualification in parallel with product work. SYS-11 and SYS-12 must pass before production cutover, not before ordinary feature implementation.
5. Resolve staffing and automation calibration through the versioned policy and queue metrics in SYS-10. Algorithm/tool choice can evolve without changing the semantic authority or audit guarantees.

Later follow-up may include cross-region high availability, additional search engines, generalized event streaming, optional dynamic lists, advanced recommendation models, and broader organization analytics. Their absence is not a reason to delay all useful product paths. Activate each when measured workload or a named user scenario requires it, and retain an explicit acceptance owner and deadline.

## 8. Audit validation

This document was checked against current source paths and first-party documentation on 2026-09-06. It changes no application or database behavior. No TypeScript/build/database test was needed for this documentation-only audit; deterministic code checks and production drills above remain implementation deliverables. No production metadata, backup success, actual restore time, physical capacity, or rendered user experience is claimed verified.
