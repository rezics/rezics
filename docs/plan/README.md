# REZICS implementation plan

Follow the [execution workflow](execution-workflow.md) for program authority, phase transitions, verification timing and commits.

## Active execution

| Field | Current selection |
| --- | --- |
| Scope | Whole-documentation reconciliation with the selected Resource, Agent, Space, language, logical-model and same-database storage contracts, requested on 2026-09-19. |
| Phase | `verification`: documentation reconciliation is complete, with focused regressions and strict source/link checks passing. No application implementation is activated. |
| Owners | `docs`, repository documentation entry points, applicable package/service README contracts and the owning documentation/design checkers. |
| Deliverables | Coherent terminology and contract ownership throughout maintained docs; updated navigation and plan; preserved dated evidence and operational commands; removal of obsolete target assumptions; reproducible generated-input and documentation checks. |
| Exclusions | Runtime/API/schema/migration changes, source-pin updates, deployment, browser QA and new capacity qualification. Published legal obligations and released evidence are not redefined by terminology maintenance. |
| Acceptance | [Documentation evidence](../testing/README.md#documentation-reconciliation-evidence): 207 Markdown files checked; 15 checker regressions pass; strict tracked-source and exact generated-input verification passes. Product gates and capacity qualification remain unchanged. |

## Selected model revision (documentation only)

On 2026-09-19 the maintainer selected the integrated
[Resource/model contracts](../architecture/schema-modeling.md),
[standards/profile adoption](../architecture/standards-adoption.md),
[physical fields and storage families](../architecture/database/resource-storage.md),
[shared Space identity](../architecture/space-composition.md) and
[Resource-targeting router/addresses](../architecture/resource-addressing.md).
The current task completes the documentation rewrite for this selection. It does
not reopen runtime implementation, advance a product gate, change source pins or
qualify the new target using earlier compiler results. The completed compiler scope
retains its [2026-09-18 evidence](../testing/schema.md), with broader failures visible
in [known failures](../testing/known-failures.md).

Resource is the selected name for the logical identity/reference contract; current
code/wire names remain implementation facts until changed together. Public Agent
and generic Entity responsibilities are distinct. Realm/Zone share a Space root
with separate capabilities and typed contexts; routes target Resources through
fixed, UUID, namespace-slug or admitted resolver bindings, with no native ZonePage.
Content languages are independent of UI locales. The deployment remains one
database with separate physical tables; table/partition counts are unqualified
configuration candidates, not capacity or throughput claims.

Dependency order for a separately activated implementation scope:

1. Reconcile current owners/fields/references and source pins against the seven
   native contracts; record per-field writer, value/language, query and exchange
   dispositions without rewriting released SQL or the installation baseline.
2. Complete shared values, names, references, assertions/acceptance and identified
   relations, then generic Recipe and retained provider/grain round-trips.
3. Integrate shared Space, typed routing/scoped addresses, public Agent authority
   and affected API/SDK/navigation/SEO consumers through their operation contracts.
4. Admit elected time/quantity/geometry/observation/dataset profiles with explicit
   preservation, validation, query and export limits; specialty workflows remain
   conditional rather than mandatory dependencies of every Resource.
5. Qualify physical specialization, inverse projections and measured workload/
   recovery using [MODEL01-MODEL40](../testing/model-contracts.md) and owning module
   cases. Semantic correctness, installation and capacity are separate results.

## Document ownership

| Owner | Authority |
| --- | --- |
| [Architecture](../architecture/database/README.md) and feature contracts | Target meaning, invariants, selected designs and supporting evidence. |
| This plan | Active scope/phase, dependencies, gates and the single progress table. |
| [Execution workflow](execution-workflow.md) | Program policy and execution rules. |
| [Modules](modules/) | Remaining deliverables and acceptance criteria. |
| [Testing](../testing/README.md) and owning code/Taskfiles | Scenarios, executable checks and evidence. |
| [Research](../research/README.md) | Unresolved decisions. |

Keep each fact with its owner. Remove completed work and rejected alternatives from the active plan; retain pending acceptance and durable contracts/tests. Git retains history; do not create parallel progress ledgers or archives.

## Acceptance gates

G2/G3 qualify named modules or contract scopes. Implement APIs with their persistence owners before G2 passes if dependencies are available. Frontend implementation requires its selected APIs to be implemented and inclusion in the active scope; it may precede G4. Acceptance requirements remain:

| Gate | Required result |
| --- | --- |
| G1: shared design | Domain identities, keys, states, references, authority and cross-module contracts are selected; unresolved Hub execution decisions are separately scoped. |
| G2: module persistence | DDL/domain commands satisfy positive, rejected-state and transition tests against real PostgreSQL. |
| G3: module API | Required persistence contracts pass G2; APIs and generated transports pass stateful flows using IDs produced by earlier requests. |
| G4: backend integration | The complete [backend acceptance matrix](backend-acceptance.md) passes. |
| G5: frontend | [Experiences](frontend.md) pass scoped integrity/rendered acceptance against qualified backend contracts. Whole-program frontend acceptance requires G4. |

Include affected cross-module cases in each scope's verification when dependencies are ready; G4 is the final combined gate. Existing code, specifications and skipped tests do not qualify revised contracts.

## Contract-first implementation sequence

1. Reconcile identity/owner/placement, cross-domain Work/releases and property applicability with the [dictionary](../architecture/database/data-dictionary.md); execute existing semantic matrices in verification.
2. Complete shared references/capability adapters and mixed authority with affected consumers, including membership, Groups, Roles, representation and connected-app privacy contracts in [M01](modules/foundation.md).
3. Implement exact content/adoption/published selections and staged [composition import/refresh](../architecture/database/content-composition.md), preserving source correspondence, local-edit conflicts and recovery; ordinary attachment remains reference-only.
4. Replace whole-structure reads with revision-bound child pagination, coalesced metrics and bounded reverse impact/read models. Retain current 2,048/64 protections until that replacement passes tests; do not raise in-memory limits as a substitute.
5. Qualify source-to-adoption/composition/publication/discovery and revocation/recovery journeys across domains, including freshness, workload limits and known failures before whole-program frontend acceptance.

The [native Work](../architecture/database/native-work.md), [logical Resource](../architecture/database/README.md#34-resource-capabilities-across-owner-tables) and composition contracts govern all modules. Cross-database operation and unresolved Hub execution remain separate activations.

[Schema.org and Wikidata interoperability](../architecture/semantic-interoperability.md)
is required for the full-index target. Its dependency order is M02 value/identity
contracts -> M07 preserved source representations with M09 minimum queries -> M04
native mappings and M09 exports -> combined update/recovery/capacity qualification.
First inventory all required profiles, then implement JSON-LD and full Wikidata
statements as initial milestones; Microdata/RDFa and lexical/shape coverage remain
required before full acceptance. Source indexing can precede native domain mapping.
The complete source-instance sequence remains separate from the active vocabulary/schema package scope.

[Information indexing and verification](../architecture/information-indexing-and-verification.md)
is a selected cross-module follow-on target: M02 owns claims, evidence assessments
and policy semantics; M07 owns exact observations, origin lineage and change intake;
M09 owns execution, quality indexes, queries, portable exchange and recovery. M04
participates when results are adopted into native fields, and M10 only when an
eligible index/service is commercially offered. The sequence is claim/assessment
and correction contracts -> initial methods and broad/selected queries -> empirical
qualification -> independent-consumer exchange and capacity -> separately selected
service packaging. [FACT/CAPFACT acceptance](../testing/information-verification.md)
remains unexecuted. This target neither activates runtime work nor depends on a
Realm, Pro site, full P2P network or execution-enabled Hub.

## Modules and current target qualification

[M10 Subscribe and Realm participation](modules/subscriptions-and-pro.md) is a
selected follow-on target: native multi-plan subscriptions, independent gifted
benefits and ordinary Realm quotas/review, with Rezics Pro as the first operated
Realm. Its implementation depends on selected M01/M03/M06/M09 contracts and requires
an explicit active-scope selection. Documenting that target does not activate new
runtime work, change the current phase or add unexecuted results to existing gates.

This is the sole progress table. Module files detail remaining work; linked test owners retain the exact scope and revision of earlier evidence. Partial evidence does not qualify the complete replacement target.

| ID | Module | Dependencies | Design | Implementation | Verification |
| --- | --- | --- | --- | --- | --- |
| M01 | [Foundation](modules/foundation.md) | None | Identity/access and adapter contracts selected | RoleBinding/representation/workload persistence, native subject/path evaluation, assignment ceilings, identity/default-context APIs, scope/Role/Binding/Ceiling management APIs and App declaration/lifecycle APIs implemented; OAuth client/consent/installation/context storage, live readers and bounded credential erasure implemented; private Group lifecycle/selection/roster/discovery/evaluation, independent approvals, original-path recovery and native Org/Realm enrollment APIs/consumers implemented; representation administration, Group-derived Org directory, all-scope representation policy, replacement recovery, remaining protocol integration and consumer/onboarding migration pending | G2 partial; new IAM/OAuth/default/ceiling/Group/Org/Realm/API work, migrations, generators and affected retained web consumers remain unqualified. Remaining [foundation](../testing/foundation.md) and [IAM/APP](../testing/identity-and-access.md) qualification pending. |
| M02 | [Knowledge and graph](modules/knowledge-and-graph.md) | M01 | Graph, Tag classification, Event temporal facts, source interoperability and verification/acceptance semantics selected | Standard ontology IR, 28 reviewed native profiles, model/runtime validation, 55 generated Drizzle declarations and complete shared table ownership implemented | [Selected standards/model/schema evidence](../testing/schema.md) passed, including exact meaning bindings, actual native writes and cross-database/table-family relocation. Broader M02/G2 remains separate. |
| M03 | [Content and media](modules/content-and-media.md) | M01, M02 contracts | Defined | Shared domain storage, indexed media grains, exact quantities and contextual sealed selections implemented; remaining product runtime pending | [Selected schema constraints](../testing/schema.md) passed; full M03 workflows/capacity pending |
| M04 | [Catalog](modules/catalog.md) | M01-M03 contracts | Cross-domain Work/releases and event-time adapters selected; domain mappings/source-free cases required | Pending target completion | Pending |
| M05 | [Creation and reading](modules/creation-and-reading.md) | M02-M04 | Composition selected; Book is the first journey | Pending target completion | Pending |
| M06 | [Community and governance](modules/community-and-governance.md) | M01-M03 | Membership, wiki composition and complete rating contexts selected; Dynamic Collections optional | Native Org/Realm enrollment uses shared admission generations with independent Realm enforcement, exact consent and current `Entity` projections; independent Wiki/page revision and message history storage implemented; remaining community contracts pending | G2 partial; new native enrollment work unqualified; [wiki evidence](../testing/wiki-composition.md), remaining content revisions, authority/history/capacity and community contracts pending. |
| M07 | [Sources and converters](modules/sources-and-converters.md) | M01/M02 source contracts; M01-M04 native adoption | Schema.org/Wikidata full-index profiles and verification evidence/lineage intake selected alongside catalog sources; field conformance pending | `@rezics/schema-importer` compiles standards and reviewed native models; provider contracts and content readers live in `@rezics/content-adapters` with existing native catalog writers | [Compiler/adapter boundary, pinned conversions and CLI qualification](../testing/schema.md) passed. Full provider acquisition/adoption and field coverage remain separate; declaration counts do not establish native coverage. |
| M08 | [Skill, Prompt and MCP Hub](modules/ai-hub.md) | M01-M04 | Catalog defined; execution/hosting open | Package, release, file, dependency, installation and capability declaration schemas implemented; runtime pending | [Selected registry constraints](../testing/schema.md) passed; execution/hosting remains unqualified |
| M09 | [Search and operations](modules/search-and-operations.md) | M01 and participating events | Rating distributions, event-date indexes, source-query/export profiles and verification execution/quality indexes/exchange selected | In progress; verification runtime not activated | G2 partial; [recommendation evidence](../testing/recommendations.md), [native diagnostics](../../services/main/performance/README.md#native-failure-artifacts) and [open failures](../testing/known-failures.md); source interoperability, information verification, disclosure, delivery, capacity and restoration pending. |
| M10 | [Subscribe and Realm participation](modules/subscriptions-and-pro.md) | Selected M01, M03, M06, M09 contracts | Native multi-plan, independent paid/complimentary benefits, Realm policies, multi-context reply connections and fixed-site Pro delivery selected | Runtime implementation not activated | [SUB/PRO, SITE/RPLY, capacity and experience scenarios](../testing/subscriptions-and-pro.md) specified; no M10 gate qualified. |
