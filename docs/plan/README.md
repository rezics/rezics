# REZICS implementation plan

Follow the [execution workflow](execution-workflow.md) for program authority, phase transitions, verification timing and commits.

## Active execution

| Field | Current selection |
| --- | --- |
| Scope | Complete the domain-organized shared Drizzle schema, multi-source schema conversion tools and main-service integration, selected by the maintainer on 2026-09-18. REZICS-owned namespaces use rezics.com. |
| Phase | `verification`. Selected shared-schema/package and PostgreSQL scenarios passed; the broader main gate remains open for the existing IAM type errors and Group command/fixture mismatch documented in [schema qualification](../testing/schema.md). |
| Owners | `libraries/schema`, `libraries/schema-importer`, the main database migration owner, [semantic interoperability](../architecture/semantic-interoperability.md), and [database contracts](../architecture/database/README.md). |
| Deliverables | Move the existing complete domain declarations into their shared owners and update consumers; implement missing selected schema families, structured vocabulary statements and semantic/storage bindings; expose source-specific converters and complete inventories; generate the full table/column/key/index catalogue and the main-service forward migrations. |
| Exclusions | Full HTTP/API feature acceptance and frontend work. Schema-required commands and integration are included; production trillion-row load and deploying a different database engine are not prerequisites for architectural qualification. |
| Acceptance | Owning type checks and source conversion tests, full typed schema catalogue/coverage, main migration replay/drift, real PostgreSQL schema invariants, translation/history/selection/erasure cases and portable migration proofs. Preserve prior IAM evidence without claiming its unexecuted API gates. |

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

The [native Work](../architecture/database/native-work.md), [logical Unit](../architecture/database/README.md#34-unit-capabilities-across-owner-tables) and composition contracts govern all modules. Cross-database operation and unresolved Hub execution remain separate activations.

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
| M02 | [Knowledge and graph](modules/knowledge-and-graph.md) | M01 | Graph, Tag classification, Event temporal facts, source interoperability and verification/acceptance semantics selected | Complete shared domain Drizzle model and native consumer refactoring implemented, including structured ontologies, media/wiki/messaging additions and semantic relations | [Schema qualification](../testing/schema.md): package types/tests, full replay/drift, native integrity and relation relocation passed. Broader M02/G2 and inherited main-service failures remain separate. |
| M03 | [Content and media](modules/content-and-media.md) | M01, M02 contracts | Defined | Shared domain storage, indexed media grains, exact quantities and contextual sealed selections implemented; remaining product runtime pending | [Selected schema constraints](../testing/schema.md) passed; full M03 workflows/capacity pending |
| M04 | [Catalog](modules/catalog.md) | M01-M03 contracts | Cross-domain Work/releases and event-time adapters selected; domain mappings/source-free cases required | Pending target completion | Pending |
| M05 | [Creation and reading](modules/creation-and-reading.md) | M02-M04 | Composition selected; Book is the first journey | Pending target completion | Pending |
| M06 | [Community and governance](modules/community-and-governance.md) | M01-M03 | Membership, wiki composition and complete rating contexts selected; Dynamic Collections optional | Native Org/Realm enrollment uses shared admission generations with independent Realm enforcement, exact consent and Entity projections; independent Wiki/page revision and message history storage implemented; remaining community contracts pending | G2 partial; new native enrollment work unqualified; [wiki evidence](../testing/wiki-composition.md), remaining content revisions, authority/history/capacity and community contracts pending. |
| M07 | [Sources and converters](modules/sources-and-converters.md) | M01/M02 source contracts; M01-M04 native adoption | Schema.org/Wikidata full-index profiles and verification evidence/lineage intake selected alongside catalog sources; field conformance pending | Independent `@rezics/schema-importer` implements 11 vocabulary inputs, 4 provider schema converters and Wikibase/IIIF/fragment exchange readers; full source acquisition remains separate | [Schema qualification](../testing/schema.md): complete pinned declaration conversion, PostgreSQL import/retry/export and storage bindings passed. Broader acquisition/native-adoption gates remain pending. |
| M08 | [Skill, Prompt and MCP Hub](modules/ai-hub.md) | M01-M04 | Catalog defined; execution/hosting open | Package, release, file, dependency, installation and capability declaration schemas implemented; runtime pending | [Selected registry constraints](../testing/schema.md) passed; execution/hosting remains unqualified |
| M09 | [Search and operations](modules/search-and-operations.md) | M01 and participating events | Rating distributions, event-date indexes, source-query/export profiles and verification execution/quality indexes/exchange selected | In progress; verification runtime not activated | G2 partial; [recommendation evidence](../testing/recommendations.md), [native diagnostics](../../services/main/performance/README.md#native-failure-artifacts) and [open failures](../testing/known-failures.md); source interoperability, information verification, disclosure, delivery, capacity and restoration pending. |
| M10 | [Subscribe and Realm participation](modules/subscriptions-and-pro.md) | Selected M01, M03, M06, M09 contracts | Native multi-plan, independent paid/complimentary benefits, Realm policies, multi-context reply connections and fixed-site Pro delivery selected | Runtime implementation not activated | [SUB/PRO, SITE/RPLY, capacity and experience scenarios](../testing/subscriptions-and-pro.md) specified; no M10 gate qualified. |
