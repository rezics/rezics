# REZICS operational refactor: decisions, scope and issue register

Date: 2026-09-06. Source baseline: `470aa6c0432fae1dacbd3be7d8ad62b566447ca9`.
Status: research and selected implementation design. No application change, migration, production inspection, capacity benchmark or rendered acceptance was performed by this task.

**Current-stage correction:** the maintainer clarified that the immediate minimum
is a **source-complete database schema for VNDB, MusicBrainz, Bangumi and book-index
data**. The [schema report](REZICS-source-complete-catalog-schema-20260906.md) and
[stage plan](../plan/operational-refactor-20260906/00-source-complete-schema.md) are
the execution priority. Prior worker/privacy/parser/governance commits are supporting
work, not evidence that the core schema has been refactored. The four schema gates
remain unqualified. This supplement includes actual Bangumi API verification;
the original audit boundary above describes the earlier report, not this new evidence.

## 1. Mandate and decision method

The maintainer requests a complete operational refactor plan, independently researched product opportunities, and a comprehensive check of gaps beyond their examples. Destructive database migration is permitted. The old schema is not a compatibility constraint on the target design; legitimate user/catalog data, identity and provenance still require explicit preservation or a documented disposition.

The output is a [program with twelve implementation plans](../plan/operational-refactor-20260906/README.md), four specialist research reports and this shared decision/issue register. Ordinary engineering choices have a selected default and a reconsideration trigger. Missing measurements and external acquisition conditions are assigned to specific activation gates. No fundamental academic or logical blocker has been found.

Research inspected current schemas, domain/API/worker code, Web feature owners, deployment/backup contracts and primary external sources. Four independent workstreams examined product/market, source/AI governance, language/officialness and system readiness. A second cross-review reconciled thresholds, ownership, lifecycle and recovery disagreements. The audit is comprehensive across the promised operational paths, not a claim to have proven every line of code defect-free.

## 2. Evidence and ownership

| Report | Owns |
| --- | --- |
| [Product opportunities](REZICS-product-opportunities-and-user-scenarios-20260906.md) | Dated market evidence, U01–U15 scenarios, portfolio, cold start and outcome metrics |
| [Language and authority](REZICS-language-and-authority-audit-20260906.md) | Current language paths, BCP 47/IANA/CLDR distinctions, source-code mappings, official-name/translation contracts |
| [Sources and review](REZICS-source-integration-and-review-20260906.md) | Provider acquisition/rights, binding/observation/adoption, AI review, conformance and source capacity math |
| [System readiness](REZICS-system-readiness-audit-20260906.md) | Current-source defects/risks, preservation requirements, workers, query bounds, deployment and recovery |

The three earlier architecture reports remain the baseline for Unit capabilities, optional Work, domain ownership, composition, relations and Tag semantics. This program adds explicit language/authority and operational contracts, adds VNDB to the named adapter scope, and selects a replacement-environment cutover default. It does not reopen those reports' future GPU/compute/education/package-marketplace examples as mandatory launch scope.

Implementation plans own executable sequencing and final acceptance thresholds. Specialist reports own detailed research evidence. If a later implementation changes a selected decision, update this register and the owning plan/report together; do not create competing specifications.

## 3. Product portfolio selected from evidence

### 3.1 Several useful product lines

1. **Find and choose books:** title/alias/identifier search, intelligible editions, useful reviews, scoped ratings and book lists (U01–U03).
2. **Personal reading companion:** journal, repeat reads, deliberate resume, privacy and portable user records (U04/U13).
3. **Discover by preferences and people:** tags, same-character traits, creators/credits, version and cross-media relationships (U05/U06/U08).
4. **Multilingual VN and detailed catalog reference:** searchable names, original/release languages, official/unofficial translations, platforms and source evidence (U07/U09).
5. **Community curation and organized evaluation:** authentic lists/reviews, clearly scoped 1–10 scoring and bounded named evaluation rounds (U03/U11).
6. **Sustainable contribution and return use:** understandable corrections, source updates, opt-in meaningful follows and invited authorized organizations (U09/U10/U12).

These lines share identities and services but have separate acceptance and usage metrics. Users need not follow one funnel. Personal utility and rich reference can work before community density; reviews/lists require real contributors and curation in addition to data ingestion.

Primary evidence supports reading records, reviews and lists as actively used categories. StoryGraph's official 2026-01-30 announcement reports five million cumulative signups; Letterboxd reports actual diary, rating, review and list activity for 2025; Booklog's 2025 company announcement reports more than two million registrations. These are self-reported category signals, not audited active users or REZICS demand. The [product report](REZICS-product-opportunities-and-user-scenarios-20260906.md#2-research-method-and-strength-of-evidence) records direct links and limitations.

VNDB/Bangumi establish detailed relationship and language/version precedents. The opportunity for REZICS is their useful connection with reading/curation, not a promise that a translated interface alone will attract users. Korean VN demand and willingness to switch remain hypotheses to measure after a usable slice. No TAM, revenue, conversion or retention forecast is invented.

### 3.2 Explicit scope exclusions and expansion conditions

No new music streaming/scrobbling business, general social network, marketplace/settlement, full package registry, GPU/compute/education platform, mandatory multidimensional rating engine or advanced group-reading system is required for this operational release. Existing software, Audio/Video and licensed reading capabilities remain supported.

U14 reading groups/challenges and U15 third-party catalog/API consumers proceed only with a named consumer/cohort, repeated task, rights scope, workload, budget and support owner. Internal reusable contracts and authorized creator participation are built now, preserving those routes without empty services.

## 4. Selected architectural and product decisions

| ID | Decision | Reason and implementation owner |
| --- | --- | --- |
| D01 | One PostgreSQL business database initially, domain-owned table groups, PGroonga with measured partition/cutover limits | Preserve relational execution and transactions; do not confuse a future extensible catalog with mandatory microservices. P01/P06/P10 |
| D02 | Stable Unit IDs; explicit concrete versions; optional evidenced Work | Avoid empty parent records and accidental edition conflation. P01 |
| D03 | Typed stable columns, governed long-tail values and identified relation revisions with one writer | Strong semantics without all-facts-in-one-JSON or duplicate authority. P01 |
| D04 | Identified content occurrences; local commands, paged reads and segmented checkpoints | Existing whole-owner loads are unsafe for large structures/collections. P01/P07 |
| D05 | Unified public Entity, private Auth and scoped delegated/service principals | Catalog editing is not impersonation authority; AI attribution cannot forge a human reviewer. P02 |
| D06 | Versioned IANA BCP 47 contract for persisted content; Intl/CLDR for UI presentation/negotiation | A valid-looking code, locale alias and true content-language identity are different facts. P03 |
| D07 | Multiple identified names/translation records in one language, with separate origin, method and authorization | Preserve official variants, transliterations and machine/human provenance without collapsing them. P03 |
| D08 | Officialness is scoped to target revision plus authorizing organization/evidence; source assertion remains distinguishable | A language is not intrinsically official, and a catalog provider is not necessarily the authorizer. P03/P05 |
| D09 | Acquire once per source record/snapshot; independent binding, observation and adoption policies | Reader follows, editor inheritance and source fetching have different purposes. P04 |
| D10 | Shared proposal/apply protocol; separate identity, factual and publication-governance judgments | One opaque AI approval boolean cannot establish all three. P05 |
| D11 | Preserve human corrections; exact revision preconditions; reversible source rebinding before permanent identity merge | Repairs must not move user reviews/history/lists or overwrite unrelated edits. P04/P05 |
| D12 | Auto-apply only evaluated low-risk actions; high-impact changes require accountable review | Use action/source/language evidence, no model self-confidence shortcut or synthetic reviewer quorum. P05 |
| D13 | Two independent reviewers for irreversible/high-impact identity merges; no proposer self-approval | Four reviewers are not inherently necessary; one AI/operator recommendation does not prove safe identity destruction. If staffing is insufficient, retain separate identities and source correspondence. P05 |
| D14 | Title/alias/identifier retrieval plus explicit relevance semantics; correlated character/relationship filters | Current recency-labeled relevance and unbound related predicates cannot fulfill the target discovery promise. P06 |
| D15 | Governed multivalued book-format facets, separate from community tag judgments | Resolves the existing `format` single-vs-multiple TODO with explicit facet compatibility. P01 |
| D16 | Ordinary live Realm 1–10 ratings; frozen rounds only for promised historical organized judgments | Preserve current product behavior; avoid a speculative multidimensional engine. P07 |
| D17 | Identified per-item recommendation annotations/linked reviews, bounded list edits | Lists need clear curatorial reasons and cannot load all membership for each small change. P07 |
| D18 | Private-by-default new detailed history, explicit sharing, session-aware journal and data portability | Personal utility must not require public reading disclosure. Preserve intentional old visibility. P08 |
| D19 | No fabricated reviews/ratings or automatic source-user account import | Metadata supply and community participation are different assets. P04/P07/P12 |
| D20 | Isolated/fair worker workloads, fenced claims, durable enqueue and conditional application | Current serial coupling and email lease predicates need correction before introducing more external latency. P10 |
| D21 | Fresh isolated target + final write freeze; in-place destructive forward migration only if rehearsals justify it | Broad contract changes favor repeatable conversion. Released migrations remain immutable. P11 |
| D22 | Recovery must preserve target-era writes and reapply erasure/revocation decisions | Old backups/routing cannot silently resurrect deleted data or discard new records. P10/P11 |
| D23 | Source-aware acquisition/display/processing/export/withdrawal policies | Data license, hosted service terms, source-reported officialness and processing permission are independent. P04/P05 |
| D24 | Scenario acceptance, coverage manifests and measured operations define completion | A populated schema or raw import count does not establish usable, marketable coverage. P12 |
| D25 | Complete the four-source catalog schema before broader operational/product increments | Physical DDL, full field/object mapping and native conformance are the current minimum. `00`, P01/P03/P04/P09 |
| D26 | Include every source-required supporting catalog family now | MusicBrainz Area/Place/Event/Instrument/Label/Series/Genre/Mood/URL, VNDB quotes/taxonomies and Bangumi indices/Archive relations are not deferred general-purpose products. P01/P04 |
| D27 | A book-index provider is replaceable; its required semantics are not | Open Library Work/Edition plus permitted serialization/translation fixtures; Novel Updates availability does not gate the model. P01/P04/P09 |
| D28 | Verify authoritative API components against real public responses | Bangumi v0 belongs to `bangumi/server`; pin its complete component graph and encode the observed Infobox/nullability discrepancies explicitly. P04 |

## 5. Language and authority: material report additions

The maintainer's concern about custom language conventions exposed a wider problem, but the evidence does not support replacing everything that is lowercase. Main UI locales already use `zh-Hans`/`zh-Hant`; route/provider spellings may be adapters. Current content metadata is constrained by a small language enum, script-collapsing mappings and one localization/title per object/language. Fixed language search columns, document/history slots and metric foreign keys also participate in the migration.

BCP 47 tags are case-insensitive. Conventional casing is useful normalization; it does not make lowercased valid tags a new private language scheme. The persisted validator must distinguish IANA language identity from CLDR locale aliases. The audit's runtime probe shows why `Intl.Locale` alone is insufficient; even a structurally valid source code can mean something different in its source vocabulary.

In the inspected VNDB schema, `ta` is labeled Tagalog and `ck` Cherokee. Source-specific mapping must precede BCP 47 parsing; ordinary public BCP 47 `ta` must continue to mean Tamil. Preserve the source code, schema checksum and mapping revision. See [language audit](REZICS-language-and-authority-audit-20260906.md) and the [official source schema](https://api.vndb.org/kana/schema).

Example target contract:

```text
named form / translation / edition-language record
  target identity + exact target revision + BCP 47 tag
  original/translated/transliterated role
  human/machine/mixed/unknown method (independent dimension)

authority assertion
  target revision + assertion type + status
  source observation that reports the claim
  authorizing Entity and role, when evidenced
  territory/channel/time scope + evidence revision + decision
```

A source may report an official Korean release of a Japanese VN without identifying the authorizer. Store that report honestly; do not invent an organization or present an unverified claim as confirmed authorization. A human or machine-assisted translation can be official if the relevant authorization is evidenced. Source operator, publisher, translator, licensor, uploader and REZICS submitter remain distinct.

## 6. Current-system issue register

Severity is consequence and dependency, not a claim of observed production harm. Exact code evidence and qualifications are in the linked audits. Every item has a selected remedy and plan; none is an unsolved design blocker.

| Issue | Observed gap / risk | Selected treatment | Gate |
| --- | --- | --- | --- |
| I01 | Profile and Entity remain separate; governance assumes human Profile actors | Semantic FK inventory, private binding/delegation and service principal migration | P02 before automated adoption/claims |
| I02 | `relevance` is current update order | Explicit known-item and relevance plan with labeled quality tests | P06 before search promotion |
| I03 | Whole ContentStructure/Collection loads for local edits | Parent/member pagination, node commands, segmented history | P01/P07 before large-source/list activation |
| I04 | Serial worker awaits unrelated workloads | Independent bounded pools/queues with total connection budgeting | P10 before sustained ingestion/AI |
| I05 | Email terminal update checks ID/status rather than claim generation | Fenced state transitions; reproduce stale-worker race and fix | P10 before notification expansion |
| I06 | Auth email enqueue is fire-and-forget | Await/observe durable enqueue; retriable truthful result | P10 before account-flow acceptance |
| I07 | Language enum/script collapse; named-form/officialness gaps | D06–D08 and dependent document/search/history migration | P03 before multilingual injection |
| I08 | Provider code collision can pass generic language validation | Versioned source-vocabulary mapping before BCP 47 | P03/P04 before provider conformance |
| I09 | No general source observation/adoption/review pipeline | P04/P05; keep local fixture loader local-only | Before production source updates |
| I10 | Four-reviewer merge workflow and irreversible merge are conflated | D13; reversible correspondence is a separate workflow | P05 policy rollout |
| I11 | Current live scores cannot substantiate frozen panel outcomes | Preserve live values; explicit round snapshots if promised | P07 organized round activation |
| I12 | Collection items lack explicit recommendation annotation | Identified item note/linked review with retention/visibility behavior | P07 U03 |
| I13 | New detailed progress defaults public without first-save control | Private new detailed records; explicit selection, legacy choices preserved | P08 first-use acceptance |
| I14 | Per-Unit Tag count/window/sort lacks proven lifetime bound | Indexed/incremental ranking and hot-owner qualification | P06/P10 large-owner tests |
| I15 | Book format storage decision remains a TODO | Typed multivalued facets and reviewed conversion | P01 contract freeze |
| I16 | Logical daily backups do not meet proposed continuing-use RPO | Base/WAL recovery, off-host assets/keys, PGroonga qualification | P10/P11 activation |
| I17 | Independent releases and automatic revert can mismatch destructive schema | Deployment-generation fences; coordinated Web/API/worker versions | P11 failed-promotion test |
| I18 | Source disappearance/withdrawal can leave orphaned derived trust/data | Support-aware compensation, eligibility withdrawal and scoped purge | P04/P05/P10 recovery |
| I19 | Old backup restore can resurrect erased/revoked state | Protected erasure/revocation ledger with tested recovery replay | P08/P10/P11 before traffic |

The reviewed search, score, collection and privacy observations are code/contract findings. No screenshot or live UX acceptance was performed. Future user testing may identify additional issues; that does not invalidate the selected remediation work.

## 7. Capacity and feasibility decisions

The 500M-row baseline and 3B-row estimate apply separately to each growing relation. They are not current online counts and not a claim that existing machines hold that volume. Child rows can exceed both checkpoints. The source report models 2 bindings/object, 8 source facts/binding and 6 retained observations/binding: 500M objects become 1B bindings, 8B facts and 6B observation headers before local relationships and payloads. P10 must replace illustrative widths with real samples.

Recurring whole-source snapshots are an explicit source-scoped acquisition cost when no delta exists. Stream/chunk/partition comparison and emit only changes; do not call a full monthly corpus re-review “incremental.” Model raw bytes, decompression, sorting/temp I/O, network and publication cadence. A source's finite snapshot or rate limit cannot be wished away by adding consumers.

Groonga has table, key, term and index-size ceilings independent of SQL query limits. P10 requires flags/version-specific limits, operating margin, serving partition design and bounded routing before reaching them. A single permanent index is not a 500M/3B scaling proof. Keep PostgreSQL/PGroonga while qualifying the relevant partition/query subset; evaluate replacement only on measured semantic/cost evidence. [Groonga limitations](https://groonga.org/docs/limitations.html), [PostgreSQL partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html).

Selected initial targets are centralized in P10: 100 reads/s, 20 user writes/s and 50 changed source objects/s with a 5× foreground burst; detail p95 300 ms, search p95 400 ms/p99 1.2 s, simple writes p95 500 ms, projection p95 60 s; RPO 5 minutes/RTO 4 hours at the measured deployment. These are test targets, not accepted production performance.

AI is not mandatory per row. Deterministic mapping handles clear source records. For C daily changes, relevant-change fraction s and mean coalescing factor g, proposals ≈ Cs/g; AI calls ≈ proposals × a and human cases ≈ proposals × h, where h includes direct-to-human referrals. Both cost and staffing can force narrower admitted work. Quality thresholds and backpressure prevent an unbounded queue from disguising infeasibility.

## 8. Open evidence and activation gates

| Gate | Current state | Concrete path / fallback | Decision deadline |
| --- | --- | --- | --- |
| G01 Live legacy inventory and version | Production not inspected; local inventory/tooling exists | P11 bounded production inventory, export manifest and two rehearsals; preserve unknowns/source-less records | Before production conversion execution/scheduling; not a blocker for local schema code |
| G02 Actual host/extension/connection capacity | Repository docs are not live measurements | P10 hardware/query/recovery capture; add capacity or reduce admitted workload | Before sustained source/public activation |
| G03 Provider acquisition/processing/export eligibility | Public terms researched; no REZICS-specific grant inferred | Per-mode eligibility; permitted samples/private review; independent eligible inputs; obtain external arrangement if needed | Before that mode runs or material is published |
| G04 Model selection, price and autonomy quality | No evaluated model or price commitment | P05 frozen evaluation; deterministic/human path remains available; action allowlist stays off until qualified | Before auto-adoption cohort |
| G05 Human product acceptance | Not performed | P12 task scripts and maintainer/tester feedback; deterministic code gates remain mandatory | Before promoting affected flow |
| G06 Public coverage and commercial claim | No full source load performed | P04/P09 manifests, exclusions, field/relationship conformance and freshness | Before named coverage claim |
| G07 Recovery and post-cutover writes | No new recovery drill | P10/P11 restore + erase/revoke replay + failed-promotion test | Before opening target writes |

These gates do not become fictional completed work because the maintainer permits autonomous decisions. They are practical evidence/eligibility requirements, each with a defined owner and nonblocking work path. An ineligible named connector is not marked delivered; unrelated development and eligible product utility can proceed.

## 9. Later decisions with selected defaults

| Topic | Default now | Reconsider when |
| --- | --- | --- |
| General personalized recommendations | Useful explicit lists/tags/follows and existing qualified ranking | A real interaction corpus and evaluation show measurable improvement |
| Additional scoring dimensions | Simple scoped 1–10; frozen rounds only for promised outputs | A named organization supplies a repeated rubric-driven workflow |
| Nested/dynamic book lists | Stored ordered lists with annotations | Actual curator tasks require query-backed or nested semantics |
| Broad organization self-service | Invited participation with explicit grants | Claim verification/abuse workload is sustainable |
| More catalog domains/paid developer API | Preserve reusable contracts; no empty implementation | Named consumer, eligible data, workload and support budget |
| Exact hardware, model and staffing procurement | Measured P10/P05 gates | Baseline/cost experiment selects a feasible configuration |
| In-place instead of replacement migration | Replacement plus final freeze | Rehearsals demonstrate simpler equivalent preservation/recovery |
| New product/domain terminology | Reuse approved termbase; internal English contract names only | User-facing new concepts are implemented and reviewed under localization policy |

No question is parked merely because several solutions exist. Defaults above allow the corresponding implementation plan to start. Reopen a decision only on new evidence or a changed product requirement.

## 10. Documentation validation and next execution boundary

This task produces maintained English reports/plans as required by CONTRIBUTING. Existing Chinese architecture reports retain their historical discussion language. Documentation validation checks relative file links, whitespace, plan references, scenario coverage and cross-report policy consistency; it does not substitute for code tests or production acceptance.

Next implementation follows the source-complete schema stage: source inventory,
core and domain DDL, canonical commands, native source conformance, and conversion.
Supporting implementation is tracked separately in the program ledger. Do not
resume a general maintenance stream or report its test/commit count as progress
on the unimplemented catalog schema. No production operation is implied by this
documentation update.
