# REZICS implementation plan

Execute this plan autonomously in dependency order using the [execution workflow](execution-workflow.md). Review each coherent change's staged diff and create a local commit under its phase-specific policy without requesting commit confirmation again. Keep commits independently understandable and do not include unrelated work. Report deferred checks; a commit does not pass an acceptance gate.

Conduct autonomous web research: discover relevant sources, investigate alternatives, verify claims and resolve technical uncertainty without waiting for the user to supply links or approve individual searches. Prefer authoritative primary evidence for technical decisions and continue researching until the current decision is supported.

The agent has full control of the development and test environment for this program. Install, upgrade, configure or remove development dependencies and tools; download required material; create or rebuild environments; start, stop or replace development services and containers; reset databases and regenerate test data; and run the experiments needed to complete the work. These actions and local commits are covered by the maintainer's standing authorization and do not require repeated permission requests. Identify the actual resource being operated on and preserve unrelated user work.

There are no compatibility requirements. Design for the intended REZICS system without preserving old schemas, APIs, SDKs, stored data, IDs/URLs, serialized formats, deployment layouts or historical implementation behavior. Remove obsolete compatibility layers and update retained consumers together. Rebuild development/test state directly when appropriate; do not introduce legacy transfer, dual-write or online migration work merely to preserve an old contract. Integrity, source conversion, fresh installation and recovery of the new system remain acceptance requirements.

Keep maintained documentation, deterministic fixtures, converters and verification scripts in Git; large network datasets require reproducible acquisition manifests and checksums. No durable dependency may require a temporary directory or machine-local attachment. This explicit initiative/follow-through policy follows the maintainer's instruction and the [official model guidance](https://developers.openai.com/api/docs/guides/latest-model).

Resolve shared contracts before dependent implementation. Complete the active document- or gate-sized scope's implementation before concentrating on test authoring, verification and repair. APIs can be implemented with their persistence owners; frontend implementation depends on its selected APIs being implemented and available, while acceptance still requires qualified backend contracts. The [backend acceptance matrix](backend-acceptance.md) remains the combined qualification requirement.

## Active execution

| Field | Current selection |
| --- | --- |
| Scope | Complete selected identity, membership, mixed authorization and connected-application backend contracts. |
| Phase | `implementation`; testing and all validation commands are deferred under the [execution workflow](execution-workflow.md#verification-timing-and-permitted-operations), with no extra static-check exception. |
| Contract owners | [Identity and access](../architecture/identity-and-access.md), [connected applications](../architecture/connected-apps.md), [access vocabulary](../../libraries/access/README.md) and [identity/access capacity obligations](../architecture/identity-access-capacity.md). |
| Included work | M01 identity/access and connected-app persistence, domain commands, account/security/management APIs, OAuth/OIDC/MCP adapters, generated transports and workers; M06 Org/Realm membership, Groups, Roles and representation consumers; affected existing authorization/disclosure consumers across modules. Complete server policy, revocation, erasure and recovery implementations required by those contracts. |
| Excluded work | Frontend experiences; unrelated domain features and complete M02-M09 implementations; optional token exchange, third-party hosted account infrastructure, uploaded-agent/Hub execution and cross-database operation. A newly discovered prerequisite must be recorded explicitly rather than silently broadening this scope. |
| Acceptance targets | Scoped G2/G3 qualification using [IAM01-IAM28 and APP01-APP14](../testing/identity-and-access.md) and affected foundation/community cases. Applicable concurrency, erasure and capacity obligations remain in verification; unrelated full-system dependencies remain pending for G4. Completing this scope does not qualify all of M01, M06 or G4. |
| Implementation exit | All included backend contracts and required consumers are implemented, generated production artifacts are updated, and no required behavior remains a stub/TODO. Record implementation complete and verification pending without claiming build/runtime success. |
| Next phase | Continue automatically to `test-authoring` for this same scope when the implementation exit is met; then follow verification and repair transitions. A documentation-only task does not start this backend work. |

This section is the single active execution selection. The module table below
separately records implementation and qualification. After scoped acceptance,
select the next complete document- or gate-sized scope in dependency order; a
gate-based selection must name its participating modules and deliverables.

## Document ownership

| Location | Authority |
| --- | --- |
| [Database architecture](../architecture/database/README.md) and owning architecture contracts | Target meaning, relational dictionary, invariants and capacity assumptions; [identity/access](../architecture/identity-and-access.md), [connected apps](../architecture/connected-apps.md) and [layered GUI](../architecture/identity-and-access-experience.md) own their selected contracts. |
| This plan | Active scope/phase, dependencies, acceptance gates and the single implementation/verification progress table. |
| [Execution workflow](execution-workflow.md) | Phase behavior, transitions, verification timing and commit/completion rules; no duplicate progress ledger. |
| [Modules](modules/) | Remaining deliverables and acceptance criteria; shared phase timing comes from the execution workflow. |
| [Testing](../testing/README.md) | Scenarios, source conformance, evidence and verification. |
| [Research](../research/README.md) | Unresolved questions that can change design; decided results move to their owner. |
| Owning code, tests and Taskfiles | Implemented contracts, executable checks and commands. |

Maintain one authority for each fact. Remove completed work and rejected alternatives from the active plan; preserve still-valid contracts in architecture and regressions in tests. Git retains historical records. Do not add a historical archive or revive a pending-review directory. Maintainer prose and filenames are English; source spelling, proper names, localized product resources and multilingual test data remain exact evidence.

## Acceptance gates

Gates describe evidence requirements, not switches between implementation and
testing. G2/G3 qualify the named module or contract scope; G4 qualifies their
composition across the backend. The active scope may contain implementation work
for several gates before entering verification.

| Gate | Required result |
| --- | --- |
| G1: shared design | Selected domain identities, keys, states, references, authority and cross-module contracts are specified; unresolved Hub execution decisions are explicitly scoped. |
| G2: module persistence | Implemented DDL and domain commands satisfy executable positive/negative/state-transition tests against real PostgreSQL. |
| G3: module API | API and generated contracts pass stateful flows with IDs produced by earlier requests; their required persistence contracts have passed G2. Implementation can precede that qualification. |
| G4: backend integration | Source converters, Book/creation, graph/Hub conformance, privacy, concurrency, jobs, performance and recovery meet the acceptance matrix. |
| G5: frontend | [Frontend experiences](frontend.md), including Relationship Graph Blocks, meet their scoped integrity/rendered acceptance against qualified backend contracts; whole-program frontend acceptance requires G4. |

Reuse existing scenario specifications during implementation and author executable tests in the corresponding phase. A specification or skipped/TODO test is not a passing executable test. Include affected cross-module cases in each scope's verification when dependencies are ready; G4 remains the final combined gate. APIs and consumers may be implemented before their owners pass acceptance, but cannot inherit unexecuted qualification.

The selected [native Work](../architecture/database/native-work.md), [logical Unit capability](../architecture/database/README.md#34-unit-capabilities-across-owner-tables) and [composition](../architecture/database/content-composition.md) contracts govern the whole system. Reconcile domain keys, exact references, shared feature applicability and publication/import transitions before affected persistence/API work. Existing tables, APIs and implementation order can change to satisfy these contracts; older fixtures retain only their recorded qualification. Cross-database operation is a later activation, not a G2-G4 deliverable.

## Contract-first implementation sequence

1. Reconcile logical identity/owner/placement, cross-domain Work/release scope and property applicability with the dictionary and existing semantic matrices; execute the matrices during verification.
2. Implement shared identity/revision/occurrence references, capability adapters and mixed AuthPrincipal/Entity authority together with affected consumers, then qualify the selected scope in verification. Reconcile membership/group/role/representation state and assignment ceilings; resolve the external token privacy/adapter profile before its dependent DDL/APIs. Keep concrete domain invariants rather than replacing them with untyped references.
3. Implement exact content/adoption/published selections and staged composition import/refresh, including source correspondence, local-edit conflicts and recovery; ordinary node attachment remains reference-only.
4. Introduce revision-bound child pagination, coalesced metrics and bounded reverse impact/read models as one replacement path. Keep current 2,048/64 protections until that path passes its tests; do not solve large structures by raising in-memory limits.
5. During verification, run end-to-end source -> adoption -> composition -> publication -> discovery/use -> revocation/recovery scenarios across domains. Qualify declared freshness, measured workload limits and known failures before frontend acceptance.

Modules within the active scope may proceed where their contracts are resolved. This sequence preserves dependencies while the execution workflow defers testing; persistence acceptance and separately unresolved execution/hosting decisions remain required. [Design evidence](../architecture/database/design-evidence.md) records supporting sources and the limitations that the REZICS integration must still test.

## Modules and current target qualification

Existing code provides foundations. The revised target has not passed G2-G4 merely because older APIs or fixtures exist. This table is the single module progress authority: implementation records code readiness, while verification records executed evidence and remaining qualification. Module files contain work and criteria rather than duplicate status ledgers. Preserve existing evidence only for its recorded contracts and revisions.

| ID | Module | Dependencies | Design | Implementation | Verification: target persistence/API/integration |
| --- | --- | --- | --- | --- | --- |
| M01 | [Foundation](modules/foundation.md) | None | Shared identity/capability and mixed-grantee representation contracts selected; [explicit permission ceiling algebra qualified](../testing/identity-and-access.md#explicit-permission-ceiling-cases); [request-context model qualified](../testing/identity-and-access.md#authority-context-model); [opaque OAuth/public-client OIDC/MCP adapter profile qualified](../testing/identity-and-access.md#oauth-adapter-qualification), [Bun CIMD network boundary qualified](../testing/identity-and-access.md#cimd-network-qualification); client admission and live-domain integration pending | In progress; target incomplete | G2 in progress: [generation-bound Group assignments and inherited paths qualified](../testing/identity-and-access.md#generation-bound-group-assignment-cases); [Group topology and admission placement qualified](../testing/identity-and-access.md#group-topology-persistence-cases); [shared membership generations and admission placement qualified](../testing/identity-and-access.md#shared-membership-generation-cases); [scoped role definitions, activation, receipts and admission placement qualified](../testing/identity-and-access.md#role-definition-persistence-cases); [private mixed subjects and canonical authority roots qualified](../testing/foundation.md#mixed-authority-registry-qualification); [canonical reference storage, selected private/event consumers, canonical Following/Studio and Progress parent authority qualified](../testing/foundation.md); native private review/disclosure, reconciliation and selected worker recovery/current-executor fences qualified; reviewer authority and canonicalization/catalog-effect process recovery qualified; remaining recovery, consumers, revision/occurrence families, ownership/disclosure and other contracts pending; [IAM/APP target matrices](../testing/identity-and-access.md) pending; older Self/direct-grant evidence does not qualify this replacement |
| M02 | [Knowledge and graph](modules/knowledge-and-graph.md) | M01 | Defined; graph queries, shared Tag classification and Event temporal facts selected | Pending target completion | Pending |
| M03 | [Content and media](modules/content-and-media.md) | M01, M02 contracts | Defined | Pending target completion | Pending |
| M04 | [Catalog](modules/catalog.md) | M01, M02, M03 contracts | Cross-domain Work/release and native event-time adapters selected; domain mappings and source-free cases required | Pending target completion | Pending |
| M05 | [Creation and reading](modules/creation-and-reading.md) | M02-M04 | Cross-domain creation/composition contract selected; Book is the first journey | Pending target completion | Pending |
| M06 | [Community and governance](modules/community-and-governance.md) | M01-M03 | Mixed membership/Groups/custom Roles and layered management selected; Realm/Collection/Zone composition and complete standing/daily/per-experience rating contexts/history selected; Dynamic Collections optional | In progress; target incomplete | G2 in progress: [stored wiki grouping, Zone pages and selected Collection read/curation authority, including target-read expiry rollback, qualified](../testing/wiki-composition.md); target content/adopted revisions, metadata/history/authority, batch/history capacity and remaining community contracts pending |
| M07 | [Sources and converters](modules/sources-and-converters.md) | M01-M04 native commands | Defined; full field conformance pending | Pending target completion | Pending |
| M08 | [Skill, Prompt and MCP Hub](modules/ai-hub.md) | M01-M04 | Catalog scope defined; execution/hosting questions open | Pending target completion | Pending |
| M09 | [Search and operations](modules/search-and-operations.md) | M01 and participating module events | Rating latest/history distributions and event-date indexes selected; known runtime failures open | In progress; target incomplete | G2 in progress: [snapshot generations, lifecycle, catalog/related-post reads and canonical event intake qualified](../testing/recommendations.md); [native failure diagnostics verified](../../services/main/performance/README.md#native-failure-artifacts); [Linux facet comparison passes, original crash unresolved](../testing/known-failures.md#native-facet-search-abort); remaining online disclosure, event delivery, capacity and restoration work pending |

G1 reconciles the dictionary with cross-domain Work/release, explicit composition/import, shared Unit features, mixed identity/representation, Groups/custom Roles, connected-app privacy, Graph API, complete [rating contexts/history](../architecture/database/ratings.md), [event-time discovery](../architecture/database/event-time.md) and Hub catalog requirements. The [identity/access capacity envelope](../architecture/identity-access-capacity.md) and [GUI layering](../architecture/identity-and-access-experience.md) are selected design obligations, not measured acceptance. Foundational implementation can proceed while independent Hub execution questions remain open; fixture/harness work follows test-authoring. Do not declare an execution-enabled Hub complete without deciding and testing that scope.

## Execution rules

Follow the [execution workflow](execution-workflow.md) across the entire active
scope rather than restarting it for each module or commit. It owns phase exits,
deferred checks, defect repair and unverified implementation commits. Keep
test-discovered contract changes with their owning design and affected consumers.
Remove only completed work; retain pending acceptance after code is implemented.

## Verification entry points

During the verification phase, from the repository root:

~~~sh
python docs/testing/database/check_design.py --check --require-tracked
python docs/testing/check_docs.py
~~~

Use owning Taskfiles for backend work. [Testing](../testing/README.md) distinguishes document checks from SQL/API, source and load qualification. Compatibility-free design still requires generated-contract integrity, reproducible installation and meaningful verification; follow [CONTRIBUTING](../../CONTRIBUTING.md) for the owning tools.
