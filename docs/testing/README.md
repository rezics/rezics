# Testing and evidence

This directory owns test scenarios and evidence. Follow the [active scope](../plan/README.md#active-execution) and [execution timing](../plan/execution-workflow.md) during the current program.

| Owner | Scope |
| --- | --- |
| [Database scenarios](database/scenarios.tsv) | Cross-domain invariant cases; specifications until executed against the target. |
| [Shared schema and converters](schema.md) | Complete shared Drizzle storage, pinned multi-source declarations, real PostgreSQL integrity and bounded relocation evidence. |
| [Integrated model contracts](model-contracts.md) | Unexecuted MODEL01-MODEL40: Resource/value/relationship contracts, standards coverage/loss, open languages, shared Space, scoped routing, physical specialization and recovery. |
| [Foundation persistence](foundation.md) | Concrete reference constraints, immutable allocation, concurrency and selective lookup evidence. |
| [Identity, access and connected apps](identity-and-access.md) | Pending mixed-principal/Entity, groups/roles/representation, OAuth/MCP, privacy, revocation and layered-GUI acceptance; older Self fixtures are not qualification. |
| [Subscribe and Realm participation](subscriptions-and-pro.md) | Selected M10 SUB/PRO, SITE/RPLY, capacity and experience scenarios: multi-plan commerce, independent gifts, local policies, fixed-site context and authorized multi-Realm reply delivery; runtime activation and qualification remain pending. |
| [Native Work and release](native-work.md) | Cross-domain identity/continuity, virtual/actual releases, applicable properties and source mappings. |
| [Content composition](content-composition.md) | Explicit local occurrences, ordinary Post/chapter reuse, fixed/reviewed selections, staged import/refresh, metrics, progress and recovery. |
| [Source conformance](source-conformance.md) | Provider data -> source queries -> reviewed native writes -> API/export -> update/withdraw/replay; SIO01-SIO18 cover Schema.org/Wikidata preservation, indexing, mapping and recovery. |
| [Information verification](information-verification.md) | FACT01-FACT36 and CAPFACT01-CAPFACT06: broad claims versus selected answers, evidence/AI assessments, calibration, independent evaluators, portable results, correction and optional Subscribe services; specified, not executed. |
| [Native recipes](recipes.md) | First-stage recipe authoring, ingredient/step occurrences, quantities, Recipe exchange and recovery; pending. |
| [Book and creation](book-and-creation.md) | Complete Book, original and AO3-derived native workflows. |
| [Relationship Graph](relationship-graph.md) | Subgraph semantics, permissions, budgets and Block descriptor contracts. |
| [Ratings and event time](ratings-and-event-time.md) | Context/observation/revision identity, latest/history aggregation, time histograms, event-date queries and explicit user actions. |
| [Skill/Prompt/MCP Hub](ai-hub.md) | Catalog/package/template and controlled protocol conformance. |
| [Wiki composition](wiki-composition.md) | Independent stored Collections, Realm publication, Zone presentations and membership disclosure. |
| [Recommendation generations](recommendations.md) | Bounded partition scoring, repeated snapshots, failure/replay and atomic activation. |
| [Backend integration](backend-integration.md) | Cross-module security, concurrent state, jobs, recovery and load. |
| [Known failures](known-failures.md) | Open regressions with reproducible diagnostics; remove after lasting test coverage closes them. |

## Execution levels

Pure tests verify parsing, typed contracts and deterministic algorithms. Real PostgreSQL verifies constraints, transactions, locks, triggers, permissions and persistence. Stateful API tests carry actual produced IDs through later requests. Authored semantic regressions run offline; external-site compatibility uses current dynamically acquired inputs, with live acquisition/conversion failures separately reported. Representative load/recovery tests retain failures and explicit dataset/runtime evidence.

Derive assertions from owning contracts and scenario matrices. Use normal authorized command paths for valid operations and deliberate direct SQL for rejected-state backstops; preserve admission, authorization and integrity checks. Identify disposable targets and isolate concurrent test lanes.

Useful verification-phase entry points from the repository root; these are not implementation-phase prerequisites:

~~~sh
python -B -m unittest discover -s docs/testing -p 'test_documentation.py'
python -B docs/testing/check_docs.py
python -B docs/testing/database/check_design.py --check --require-tracked
yarn exec vitest run --project main
task services-main:db:check
task openapi:check
~~~

Use the relevant owning Taskfile and focused suites before broader integration. No API test may use a fabricated ID where a preceding create/import response should provide it. Retain positive, rejected, missing-data, conflict, retry and revocation outcomes. A fixture, generated SQL file or skipped test is not qualification.

Fresh checkouts first follow the owning [artifact preparation procedure](../../libraries/schema-importer/README.md).
The design checker compares the registered model derivatives against the production
emitter without writing schema, verifies pinned vocabulary bytes, and records
producer/output digests. `--require-tracked` requires authored models, generator
recipes, pins and all ordinary dependencies in Git. Only exact verified model
outputs are exempt; another generator's tracked snapshot remains tracked. Missing,
modified, symlinked and unregistered ignored files fail rather than disappear from
the schema inventory. Preparation needs the installed Node/Yarn workspace; checks
then run offline and never connect to a database.

## Documentation reconciliation evidence

The 2026-09-19 reconciliation covers maintained target architecture, execution
plans, domain/API documentation, navigation and the implementation/release boundary.
The Resource/Agent/Space terminology, open language model, physical field policy,
typed relationships and same-database capacity contracts replace conflicting target
prose. Dated fixture results, actual command identifiers, legal text and released
SQL retain their own authority. [Current implementation](../reference/current-implementation.md)
records concrete remaining runtime gaps.

Verification for this documentation scope:

- 15 focused regressions pass, covering role-aware terminology, nested source
  fences, exact derivative registration, altered/missing/orphan/symlinked outputs,
  tracked producers, separately tracked protocol snapshots and pinned source bytes.
- The maintained-document check passes across 207 Markdown files, including local
  targets/anchors, English maintainer prose and ownership/terminology guards.
- The strict design check passes after artifact preparation and staging. Seven
  model-emitted Drizzle modules match the production emitter exactly; twelve pinned
  vocabulary sources match their declared bytes/digests. Inventory mapping covers
  249 schema/SQL modules and 42 API owners, with 132 specified cross-domain scenarios.
  The capacity generator also derives five specialized/generic relationship profiles
  from registered row-role widths; these remain planning arithmetic, not load evidence.

These are documentation, provenance and arithmetic results. No application, DDL,
migration, product gate, full-standard field conformance, 3B deployment or throughput
qualification is implied. The [model scenarios](model-contracts.md) remain
prospective. The earlier generated-input guard failure is repaired; other backend
[failures](known-failures.md) remain open under their own reproductions.

## Reproducibility and retention

### First-stage scope revision evidence

The 2026-09-20 documentation checkpoint selects the seven indexing domains,
preserves native product scope, makes ordinary chapters reuse eligible published
Post content, and selects current external-site validation. Recipe, BOOK31-BOOK35,
COMP25-COMP27 and LIVE01-LIVE07 are prospective acceptance cases, not runtime passes.

The existing 15 documentation/design regressions pass. The maintained-document
check passes for 209 Markdown files and 1,226 local links. After regenerating the
owning design artifacts, strict tracked-input and exact generated-output checks
pass; the inventory remains 249 schema/SQL modules, 42 API owners and 132 existing
cross-domain database scenarios. No product, live-source or capacity gate is
qualified by this documentation checkpoint. Commands are the documentation and
design entry points in [execution levels](#execution-levels).

Commit authored deterministic semantic fixtures, acquisition definitions, mapping expectations, generators and checks. Current external-site responses, generated inventories and run reports live in ignored directories under [live source validation](source-conformance.md#live-acquisition-and-validation). Large network runs use bounded streaming and receipts of the actual captured inputs, not a frozen version prerequisite for future checks. Normative vocabulary pins remain compiler dependencies. Do not depend on a local working attachment or temporary reports. Record source/target contracts, data seed/digest, runtime/images/settings, tested commit, exact command, failures and limitations. Source-private data and credentials do not enter public fixtures.

Multilingual source strings remain intact to test semantic preservation. Numeric scenario/capacity outputs are regenerated by [check_design.py](database/check_design.py); [check_docs.py](check_docs.py) checks links, language, policy-owner sections and entry-point references. These structural checks establish neither policy semantics nor backend behavior.

### Isolated PGroonga fixture copies

A same-cluster disposable copy of an initialized PGroonga database needs
`CREATE DATABASE ... TEMPLATE ... STRATEGY FILE_COPY` on the qualified PostgreSQL
18 stack, with no connections to the source template. The default `WAL_LOG` copy
produced missing PGroonga backing objects (`PGrnLookupWithSize: Sources...`) in the
copy; `FILE_COPY` preserved them and allowed indexed writes. PostgreSQL documents
that [FILE_COPY copies complete database directories](https://www.postgresql.org/docs/18/sql-createdatabase.html)
and requires checkpoints. This is an observed development-fixture procedure,
not backup/WAL restoration or production recovery qualification. Keep the normal
fresh `db:check` replay as the schema acceptance path.

Keep candidate-sensitive fixtures in separate lanes. Creating a copy does not
make its data empty: prepare only the owned copy for the fixture's stated
preconditions, preserve the source and remove the copy when verification ends.
