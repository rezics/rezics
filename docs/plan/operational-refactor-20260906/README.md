# REZICS operational refactor program

Date: 2026-09-06. Status: implementation in progress; production qualification remains pending.
Source baseline: `470aa6c0432fae1dacbd3be7d8ad62b566447ca9`.

## Mandate and outcome

Deliver multiple independently useful product lines: finding books and choosing through reviews, scores and lists; keeping a reading journal; discovering works through tags and characters; choosing languages and editions; exploring rich credits and cross-media relationships; contributing corrections to a maintained catalog. Three production source adapters (Bangumi, VNDB and MusicBrainz), continuous adoption and AI-assisted review are part of this program.

The maintainer permits destructive database migration for this refactor. Design for the correct target contract instead of preserving obsolete columns indefinitely. Preserve legitimate existing data and its meaning through explicit conversion, quarantine or archival. Permission for destructive schema changes does not designate user records as disposable.

Implementation was authorized on 2026-09-06, including autonomous adjustments and
verified commits. Production activation still requires the evidence below. This
plan does not add pre-v1 compatibility. Released SQL remains immutable; a new
forward migration may deliberately drop replaced structures after verified transfer.

## Research and decisions

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
| [P10 Capacity and operations](10-capacity-and-operations.md) | Isolated work, recovery, observability and measured resource gates | Starts immediately; integrates every write owner |
| [P11 Migration and cutover](11-migration-and-cutover.md) | Preserved legacy data and coordinated replacement deployment | Design starts immediately; final run depends on P01–P10 |
| [P12 Product acceptance and activation](12-product-acceptance-and-activation.md) | Scenario acceptance, truthful coverage claims and launch scorecard | Starts immediately; operational activation after relevant gates |

Prerequisites are contracts or integration gates, not a requirement to finish every upstream UI before starting downstream work. Plan drafting, fixture curation, baseline capture and operator work can proceed concurrently.

## Delivery order and useful increments

1. **Baseline and contracts:** P10/P11/P12 inventory and acceptance corpus; P01/P02/P03 identity, language and authority contracts. Record the actual production version and recoverable export structure before producing migration code.
2. **First complete data loop:** P04 Bangumi slice + P05 observation/proposal/adoption + P06 title lookup + P09 one correctly modeled subject. Demonstrate replay, source conflict and a protected human correction before increasing volume.
3. **Complete existing product lines:** P07/P08 in parallel with all-source mapping. Ship book search/reviews/lists, realm scoring and reading history against the new identities, including API/SDK consumers.
4. **All-source coverage and relationship discovery:** VNDB and MusicBrainz adapters, multilingual named forms, character filters, edition navigation and credit/music links. A working pilot does not count as completion of the three-adapter requirement.
5. **Qualification and conversion:** full declared source-scope reconciliation, capacity tests, AI shadow evaluation, user-flow acceptance and at least two repeatable legacy migration rehearsals.
6. **Controlled activation:** P11 coordinated maintenance cutover; P12 feature/connector activation and monitoring. Future GPU/compute/education/package-marketplace scope is not an entry condition.

Every increment must leave a runnable integrated system with one authoritative write path per fact. A large final database cutover does not justify months of unintegrated feature branches. Small reviewed slices may merge before activation; commit policy follows the maintainer's session authorization.

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

| Plan | Current implementation evidence | Remaining gate |
| --- | --- | --- |
| P10 | First operational slice: fenced email claims and renewal, acknowledged auth enqueue, independently scheduled lanes, isolated delivery process/pool, and real PostgreSQL race/plan checks. See [P10](10-capacity-and-operations.md#implementation-ledger). | Full resource ledger, admission/retention, source/AI executors, production inventory and recovery qualification. |
| P01–P09, P11–P12 | Planned; existing foundations do not imply the new acceptance contracts pass. | Owning implementation and acceptance slices. |

No fundamental design blocker has been identified. Source-use permissions, missing live inventory and unmeasured capacity are explicit, locally scoped activation gates with assigned work and fallback paths in the decision register. They do not suspend independent implementation.
