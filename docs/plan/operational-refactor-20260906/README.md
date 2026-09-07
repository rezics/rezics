# REZICS operational refactor program

Date: 2026-09-06. Status: supporting implementation exists; **the current source-complete catalog schema milestone is not delivered**.
Source baseline: `470aa6c0432fae1dacbd3be7d8ad62b566447ca9`.

**Current boundary, 2026-09-07:** the maintainer has authorized autonomous
implementation, independent worktrees and research-led design decisions.
Documents are revisable records, not a reason to stop implementation. Resolve
the relevant [design obligations](00-source-complete-schema.md#design-review-gate)
for each slice using source evidence, code and checks; keep incomplete program
acceptance separate from a reviewed slice.
The native model must be provider-independent, with no mandatory Edition layer,
checked cross-domain distribution composition and generic source bindings,
subscriptions, scheduled checks and event-driven update jobs. Four-source
coverage remains required but does not define the native abstraction boundary.

**Event transport accepted, 2026-09-07:** use [NATS JetStream](../../architecture/event-streaming.md)
for persistent events and ready-task delivery, qualify Debezium Server as the
preferred outbox relay, and retain Bun business consumers. PostgreSQL owns
transactional state/plans/outbox/receipts. This closes service selection only;
the catalog design gate and integration/production qualification remain open.

## Mandate and outcome

**Current stage, clarified by the maintainer:** finish the database schema needed
to natively carry **VNDB, MusicBrainz, Bangumi and book-index data**. Novel Updates
is a reference for book/translation indexing, not an irreplaceable provider.
Start with [Current-stage schema plan](00-source-complete-schema.md) and its
[verified source/schema report](../../report/REZICS-source-complete-catalog-schema-20260906.md).
They own this stage's concrete source URLs, native table owners, coverage gates
and next implementation order. The broader product program below remains valid
after this milestone; it must not divert implementation into more peripheral fixes.

**Additional scope confirmed 2026-09-07:** Unit remains the logical identity,
reference and capability abstraction; physical identity/lifecycle moves to owning
table groups and the live global `unit` parent is retired in this stage. Fixed
domain structure and dynamic semantic relations must be classified explicitly.
Universe/world-setting, franchise and series identities, scoped memberships and
ordering are required native models now, including source-free authoring. P01/P11/
P12 own their implementation, all-consumer conversion and acceptance; four-source
coverage alone does not complete these shared-model gates.

Deliver multiple independently useful product lines: finding books and choosing through reviews, scores and lists; keeping a reading journal; discovering works through tags and characters; choosing languages and editions; exploring rich credits and cross-media relationships; contributing corrections to a maintained catalog. Three production source adapters (Bangumi, VNDB and MusicBrainz), continuous adoption and AI-assisted review are part of this program.

**Breaking replacement baseline, confirmed 2026-09-07:** the maintainer reports
the website is stopped and the entire legacy dataset is approximately 400k
records. There is no old API, old schema or persisted-data compatibility
requirement, including v1+ contracts. Implement the final model directly and
rewrite affected internal clients together. Separate offline migration software
owns legacy data conversion; it does not block new-schema implementation or
retirement of old runtime structures. Do not add dual writes, CDC, compatibility
adapters or old-URL guarantees. The authoritative
[baseline in `00`](00-source-complete-schema.md#breaking-replacement-baseline)
supersedes earlier preservation/cutover sequencing in this program.

The latest autonomous implementation instruction supersedes the earlier
documentation-only pause. Production activation still
requires the evidence below. This plan does not preserve old-version compatibility.
Released SQL remains immutable as history; generated replacement DDL may drop obsolete structures without a
legacy transfer first. RomVer identifies the breaking release; it does not require
old endpoints or rows to work in the target application.

## Research and decisions

- [Source-complete catalog schema and actual API verification](../../report/REZICS-source-complete-catalog-schema-20260906.md) — current-stage authority.
- [Provider-independent capabilities and Edition review](../../report/REZICS-Catalog领域边界与实施分期-20260906.md#23-provider-independent-native-model) — native semantic model and cross-provider qualification.
- [Generic source bindings, subscriptions and scheduled updates](../../report/REZICS-source-integration-and-review-20260906.md#44-generic-source-bindings-and-subscriptions) — common source lifecycle and execution protocol.
- [Accepted event streaming architecture](../../architecture/event-streaming.md) — NATS JetStream, preferred Debezium relay, event/task semantics, durability, deployment and capacity qualification.
- [Current-stage source baseline](source-contract-baseline.json) — pinned artifacts and observed HTTP/schema results, not implementation coverage.
- [Integrated decisions and issue register](../../report/REZICS-operational-refactor-decisions-20260906.md).
- [Product evidence and user scenarios](../../report/REZICS-product-opportunities-and-user-scenarios-20260906.md).
- [Language and authority audit](../../report/REZICS-language-and-authority-audit-20260906.md).
- [Source integration and review](../../report/REZICS-source-integration-and-review-20260906.md).
- [System readiness audit](../../report/REZICS-system-readiness-audit-20260906.md).
- [Existing architecture reports](../../report/README.md) remain the semantic baseline. The new decision report explicitly fills gaps; historical design text is not implementation evidence.

## Work packages and ownership

| Plan | Deliverable | Prerequisites for integration |
| --- | --- | --- |
| [P01 Catalog and relations](01-catalog-and-relations.md) | Correct identities, typed facts, versioned relations, scalable composition | Existing report contracts |
| [P02 Participation and access](02-participation-and-access.md) | Unified public Entity, private Auth, scoped delegation and service actors | P01 identity contract |
| [P03 Languages and authority](03-languages-and-authority.md) | Standard language tags, multiple named forms, scoped officialness | P01 reference contract; P02 authority integration |
| [P04 Sources and ingestion](04-sources-and-ingestion.md) | Three adapters, replayable initial loads and continuing observations | P01/P03 contracts; P10 worker runtime |
| [P05 Review and reconciliation](05-review-and-reconciliation.md) | Change proposals, matching, AI evaluation, controlled adoption | P02/P03/P04 contracts |
| [P06 Search and discovery](06-search-and-discovery.md) | Useful title retrieval, tags and same-character relation queries | P01/P03; P04 samples; P10 budgets |
| [P07 Reviews, lists and scoring](07-reviews-lists-and-scoring.md) | Complete public evaluation and curation journeys | P02/P03 and P06 read contracts |
| [P08 Reading journal and library](08-reading-journal-and-library.md) | Reliable personal history, resume, privacy, import/export | P01/P02/P03 identity/language contracts |
| [P09 VN and cross-media catalogs](09-vn-and-cross-media-catalogs.md) | Usable multilingual VN, program and music experiences | P01/P03/P04/P05/P06 |
| [P10 Capacity and operations](10-capacity-and-operations.md) | JetStream/relay qualification, isolated consumers, recovery, observability and measured resource gates | Infrastructure choice accepted; implementation follows the design gate and integrates every affected write owner |
| [P11 Replacement and offline transfer](11-migration-and-cutover.md) | Separate new-system acceptance, standalone legacy conversion and site reopening | New-system implementation is independent of legacy import; the offline tool consumes the final target contract |
| [P12 Product acceptance and activation](12-product-acceptance-and-activation.md) | Scenario acceptance, truthful coverage claims and launch scorecard | Starts immediately; operational activation after relevant gates |

Prerequisites are contracts or integration gates, not a requirement to finish every upstream UI before starting downstream work. Plan drafting, fixture curation, baseline capture and operator work can proceed concurrently.

## Delivery order and useful increments

**For each increment below:** resolve its native/source mappings, exact
references/revisions, physical routing/capacity and executable acceptance
specification before treating the implementation as integrated. Independent
contracts may advance concurrently while broader design gaps remain open.

1. **Finish the source-complete database milestone:** follow `00` in order: full
   source contract inventory, shared DDL, actual domain tables, canonical commands/
   reads/queries, destructive runtime replacement, four-source native conformance
   and local capacity/replay checks on a fresh target. P01/P03/P04/P09 are the primary owners. Use P02/P10/P11
   only for dependencies that this work actually needs.
2. **Complete source operations:** continuous acquisition/adoption, proposal and
   operator flows, full selected snapshot-count reconciliation and source freshness.
   A few imported examples do not establish either schema coverage or corpus coverage.
3. **Complete the wider product portfolio:** P06/P07/P08/P09 discovery, reviews,
   lists, scoring and journals on the new identities; invited participation and
   P12 human product acceptance. CJK campaigns do not narrow the schema milestone.
4. **Separate offline transfer and reopening:** the standalone migration software
   inventories the frozen approximately 400k legacy export, transforms and
   reconciles it against the final target, and records unresolved mappings.
   P10 recovery/capacity, P05 AI evaluation where enabled and P11/P12 reopening
   follow independently. Legacy access or migration-tool completion does not
   block schema acceptance or removal of the old runtime contract.

Implement in isolated worktrees and integrate reviewed slices into `main`, with
one target write authority per fact.
The stopped old site need not run at intermediate commits. Complete affected
new-contract call sites and deterministic checks before declaring a slice
integrated; do not preserve compatibility merely to keep the old build runnable.
Commit policy follows the maintainer's session authorization.

## Release acceptance matrix

| Scenario | Primary plans | Required evidence |
| --- | --- | --- |
| U01 Find a book by title/alias/identifier | P03/P06 | Labeled multilingual retrieval set and stable filtered pagination |
| U02 Reviews and scores | P07 | Discover, read, contribute, edit and moderate; scope/visibility preserved |
| U03 Book lists | P07 | Ordered membership, per-entry reason, save/share and deletion behavior |
| U04 Journal and repeat reads | P08 | Backdated/repeated sessions, edit/delete, privacy, resume |
| U05 Tags; U06 character traits to works | P01/P06/P09 | Same-entity binding, provenance, spoiler/visibility filtering and indexed plans |
| U07 Language/edition choice | P03/P09 | Script-preserving names and evidence-backed officialness |
| U08 Creators and cross-media discovery | P01/P09 | Correct credit/recording/occurrence scope; source-backed navigation |
| U09 Corrections and duplicate proposals | P04/P05 | Stale decision rejection, protected edits, source rebinding and recovery |
| U10 Relevant follows | P07/P09/P10 | Opt-in delivery, deduplication and correct notification lease fencing |
| U11 Organized scoring | P02/P07 | Named scope/rules, independent counts, frozen rounds only when promised |
| U12 Authorized creator participation | P02 | Invited scoped delegation; impersonation/revocation denial tests |
| U13 Personal import/export | P08/P11 | Versioned export roundtrip and permission-preserving import |

U14 group challenges and U15 third-party commercial API are expansion experiments. Existing software/media capabilities remain supported where already implemented; this is not a deletion plan for non-book users.

## Definition of done for every plan

- Concrete current owner paths, final types/schema/API behavior and migration of internal callers.
- Reproducible semantic fixtures, rejection cases, applicable deterministic checks and evidence.
- Bounded work and storage amplification for every growing relation at 500M rows and a 3B-row estimate; qualification limits remain explicit.
- Operator visibility, retry/recovery and data privacy appropriate to that feature.
- Updated implementation architecture docs and this completion ledger with commits/evidence after delivery.
- User-facing strings in their typed owner locale resources; SharkUI and feature-owned Web implementation.
- Frontend TypeScript checks are mandatory. Human maintainer acceptance covers rendered experience; AI browser/visual QA requires a separate explicit request.
- Generated OpenAPI/SDK and mirrors are never hand-edited. Existing deterministic checks are not weakened. GitHub Check remains advisory as documented.

## Completion ledger

**Latest checkpoint:** the native/source/event integration batch is complete as
a locally verified slice. The maintainer requested a pause and new session;
use [the continuation handoff](NEXT_SESSION.md) and
[current batch ledger](00-source-complete-schema.md#current-integrated-batch-and-pause).
Complete VNDB/MusicBrainz/Bangumi coverage, native update writers, global identity
cutover and product/API/Web integration remain required. P02 work is retained
on a separate draft branch, not merged as a supposedly finished migration.

**2026-09-07 autonomous wave:** source-coverage bookkeeping, native software
participation-context replacement, JetStream transport, PostgreSQL task/outbox/
receipt durability and transactional source-observation events are integrated.
The [current schema ledger](00-source-complete-schema.md#autonomous-implementation-wave)
records exact scope and remaining dependencies. Targeted tests, real database
races, a skewed context fixture and a real local broker supply separate evidence;
they do not establish source completeness or production qualification.

**Current-stage result: not complete.** VNDB, MusicBrainz, Bangumi and book-index
native schema gates are all unqualified. Owner-local Unit identity cutover and
universe/franchise/series native acceptance are also unqualified. The first native
storage DDL, typed domain structures and initial four-source sample projections
are delivered; complete source semantics, historical restoration and consumer
cutover are not. Track the concrete
[schema ledger](00-source-complete-schema.md#implementation-ledger--2026-09-07);
supporting commit counts and general test totals cannot substitute for it.

| Plan | Current implementation evidence | Remaining gate |
| --- | --- | --- |
| P10 | First operational slice: fenced email claims and renewal, acknowledged auth enqueue, independently scheduled lanes, isolated delivery process/pool, and real PostgreSQL race/plan checks. See [P10](10-capacity-and-operations.md#implementation-ledger). | Full resource ledger, admission/retention, source/AI executors, production inventory and recovery qualification. |
| P06 | Traced and removed the orphan exact-count/whole-owner global Tag query; active landscape contracts remain authoritative. | Relevance, active ranking bounds, correlated filters, retrieval corpus and product acceptance. |
| P03 | Pinned IANA consumption-language validation, scoped private-use parsing, registry-bound Search hashes and bounded stored-value audit. | Open metadata localization, source mappings, named forms, authority and production/history conversion. |
| P05 | Two-reviewer versioned merge policy, retired direct bypass, preserved historical decisions and actual transaction acceptance checks; repaired existing merge blockers. | Source proposal lifecycle, AI evaluation, actor independence and full operational review workflow. |
| P08 | New progress defaults private in canonical writers and the Web editor; first-save visibility is selectable and existing choices are retained. | Session/checkpoint semantics, portability, account privacy defaults and user acceptance. |
| P11 | Read-only schema/runtime inventory and the revised independent acceptance tracks. | Separate offline conversion software and reopening; these do not gate the new-schema implementation. |
| P01 | Owner-local foundation, 50 typed domain tables, scoped relations/grouping, shared credits and local command/constraint/query evidence; see `00`. | Complete source mapping, full revisions/restore, shared authorization/API integration and global-parent cutover. |
| P04 | Immutable source observations, checked inline reference evidence, first-adoption bindings, changed-snapshot proposals and four selected live-source native roundtrips. | Complete field/object semantic mapping, canonical-path integration, proposal application/withdrawal, dependency scheduling and operational qualification. |
| P02, P07, P09, P12 | Planned; existing foundations do not imply the new acceptance contracts pass. | Owning implementation and acceptance slices. |

Verified implementation commits: `0535b1141` (P10 email/worker foundation),
`a8d3af36e` (P06 orphan Tag query removal).
`c8a89a705` (P08 first-save privacy), `8e984d081` (P10/P11 runtime pin and inventory).
`cc8bb65b6` (P03 pinned IANA validation and audit).
`698461619` (authoring terminology correction), `4b55bac34` (P05 reviewed merge
policy and acceptance/projection repairs).
`8db9a5732` (native catalog foundation), `2741c9d6c` (typed domain structures and
streamed immutable artist credits).

Sequencing clarification: production access is a production conversion/activation
gate. It does not prevent local migration generation, disposable rehearsal or
independent contract implementation. This aligns the implementation order with
the issue register's explicitly local activation gates.

Source-use permissions and missing production inventory do not block completing
local design. The revised catalog design obligations still govern acceptance;
accepted broker selection does not close reference, physical-key, recovery or
capacity evidence requirements. Activation follows the qualified contracts and
scoped operational gates in the decision register.
