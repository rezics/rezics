# REZICS implementation plan

Follow the [execution workflow](execution-workflow.md) for program authority, phase transitions, verification timing and commits.

## Active execution

| Field | Current selection |
| --- | --- |
| Scope | Complete selected identity, membership, mixed authorization and connected-application backend contracts. |
| Phase | `implementation`. |
| Owners | [Identity/access](../architecture/identity-and-access.md), [connected apps](../architecture/connected-apps.md), [access vocabulary](../../libraries/access/README.md) and [capacity obligations](../architecture/identity-access-capacity.md). |
| Deliverables | M01 persistence, domain commands, account/security/management APIs, OAuth/OIDC/MCP adapters, transports and workers; M06 Org/Realm membership, Groups, Roles and representation; affected existing authorization/disclosure consumers across modules. Include required revocation, erasure and recovery implementations. |
| Exclusions | Frontend experiences, unrelated domain features and complete M02-M09 implementations; optional token exchange, third-party hosted accounts, uploaded-agent/Hub execution and cross-database operation. Record newly discovered prerequisites explicitly. |
| Acceptance | Scoped G2/G3 using [IAM01-IAM28 and APP01-APP14](../testing/identity-and-access.md) and affected foundation/community cases, including applicable concurrency, erasure and capacity obligations. Unavailable full-system dependencies remain for G4; this scope does not qualify all of M01/M06/G4. |

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
This follow-on sequence does not change the active IAM scope or phase above.

## Modules and current target qualification

This is the sole progress table. Module files detail remaining work; linked test owners retain the exact scope and revision of earlier evidence. Partial evidence does not qualify the complete replacement target.

| ID | Module | Dependencies | Design | Implementation | Verification |
| --- | --- | --- | --- | --- | --- |
| M01 | [Foundation](modules/foundation.md) | None | Identity/access and adapter contracts selected | RoleBinding/representation/workload persistence, native subject/path evaluation, assignment ceilings, identity/default-context APIs, scope/role-definition APIs and App declaration/lifecycle APIs implemented; OAuth client/consent/installation/context storage, live readers and bounded credential erasure implemented; private Group lifecycle/selection/roster/discovery/evaluation, independent approvals, original-path recovery and native Org/Realm enrollment APIs/consumers implemented; Role/Binding/Ceiling and representation administration, Group-derived Org directory, all-scope representation policy, replacement recovery, remaining protocol integration and consumer/onboarding migration pending | G2 partial; new IAM/OAuth/default/ceiling/Group/Org/Realm/API work, migrations, generators and affected retained web consumers remain unqualified. Remaining [foundation](../testing/foundation.md) and [IAM/APP](../testing/identity-and-access.md) qualification pending. |
| M02 | [Knowledge and graph](modules/knowledge-and-graph.md) | M01 | Graph, Tag classification, Event temporal facts and source interoperability semantics selected | Pending target completion | Pending |
| M03 | [Content and media](modules/content-and-media.md) | M01, M02 contracts | Defined | Pending target completion | Pending |
| M04 | [Catalog](modules/catalog.md) | M01-M03 contracts | Cross-domain Work/releases and event-time adapters selected; domain mappings/source-free cases required | Pending target completion | Pending |
| M05 | [Creation and reading](modules/creation-and-reading.md) | M02-M04 | Composition selected; Book is the first journey | Pending target completion | Pending |
| M06 | [Community and governance](modules/community-and-governance.md) | M01-M03 | Membership, wiki composition and complete rating contexts selected; Dynamic Collections optional | Native Org/Realm enrollment uses shared admission generations with independent Realm enforcement, exact consent and Entity projections; remaining community contracts pending | G2 partial; new native enrollment work unqualified; [wiki evidence](../testing/wiki-composition.md), remaining content revisions, authority/history/capacity and community contracts pending. |
| M07 | [Sources and converters](modules/sources-and-converters.md) | M01/M02 source contracts; M01-M04 native adoption | Schema.org/Wikidata full-index profiles selected alongside catalog sources; field conformance pending | Pending target completion | Pending |
| M08 | [Skill, Prompt and MCP Hub](modules/ai-hub.md) | M01-M04 | Catalog defined; execution/hosting open | Pending target completion | Pending |
| M09 | [Search and operations](modules/search-and-operations.md) | M01 and participating events | Rating distributions, event-date indexes and source-query/export profiles selected | In progress | G2 partial; [recommendation evidence](../testing/recommendations.md), [native diagnostics](../../services/main/performance/README.md#native-failure-artifacts) and [open failures](../testing/known-failures.md); source interoperability, disclosure, delivery, capacity and restoration pending. |
