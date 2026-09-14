# REZICS implementation plan

Execute this plan autonomously in dependency order. After each coherent change passes its required checks, review the staged diff and create a local commit without requesting commit confirmation again. Keep commits independently understandable and do not include unrelated work.

Conduct autonomous web research: discover relevant sources, investigate alternatives, verify claims and resolve technical uncertainty without waiting for the user to supply links or approve individual searches. Prefer authoritative primary evidence for technical decisions and continue researching until the current decision is supported.

The agent has full control of the development and test environment for this program. Install, upgrade, configure or remove development dependencies and tools; download required material; create or rebuild environments; start, stop or replace development services and containers; reset databases and regenerate test data; and run the experiments needed to complete the work. These actions and local commits are covered by the maintainer's standing authorization and do not require repeated permission requests. Identify the actual resource being operated on and preserve unrelated user work.

There are no compatibility requirements. Design for the intended REZICS system without preserving old schemas, APIs, SDKs, stored data, IDs/URLs, serialized formats, deployment layouts or historical implementation behavior. Remove obsolete compatibility layers and update retained consumers together. Rebuild development/test state directly when appropriate; do not introduce legacy transfer, dual-write or online migration work merely to preserve an old contract. Integrity, source conversion, fresh installation and recovery of the new system remain acceptance requirements.

Keep maintained documentation, deterministic fixtures, converters and verification scripts in Git; large network datasets require reproducible acquisition manifests and checksums. No durable dependency may require a temporary directory or machine-local attachment. This explicit initiative/follow-through policy follows the maintainer's instruction and the [official model guidance](https://developers.openai.com/api/docs/guides/latest-model).

Complete the shared schema design first. Develop each backend module through test specifications, executable persistence/domain tests, implementation and APIs. Begin frontend implementation after the [backend acceptance gates](backend-acceptance.md) pass. This plan authorizes autonomous commits during its execution, not skipping checks or treating an existing implementation as proof of the revised target.

## Document ownership

| Location | Authority |
| --- | --- |
| [Database architecture](../architecture/database/README.md) and owning architecture contracts | Target meaning, relational dictionary, invariants and capacity assumptions; [identity/access](../architecture/identity-and-access.md), [connected apps](../architecture/connected-apps.md) and [layered GUI](../architecture/identity-and-access-experience.md) own their selected contracts. |
| This plan and [modules](modules/) | Remaining work, dependencies and activation gates. |
| [Testing](../testing/README.md) | Scenarios, source conformance, evidence and verification. |
| [Research](../research/README.md) | Unresolved questions that can change design; decided results move to their owner. |
| Owning code, tests and Taskfiles | Implemented contracts, executable checks and commands. |

Maintain one authority for each fact. Remove completed work and rejected alternatives from the active plan; preserve still-valid contracts in architecture and regressions in tests. Git retains historical records. Do not add a historical archive or revive a pending-review directory. Maintainer prose and filenames are English; source spelling, proper names, localized product resources and multilingual test data remain exact evidence.

## Execution stages

| Gate | Required result |
| --- | --- |
| G1: shared design | Selected domain identities, keys, states, references, authority and cross-module contracts are specified; unresolved Hub execution decisions are explicitly scoped. |
| G2: module persistence | Write positive/negative/state-transition tests, then implement DDL and domain commands until real PostgreSQL behavior satisfies them. |
| G3: module API | Implement API and generated contracts after G2; exercise stateful flows with IDs produced by earlier requests. |
| G4: backend integration | Source converters, Book/creation, graph/Hub conformance, privacy, concurrency, jobs, performance and recovery meet the acceptance matrix. |
| G5: frontend | Implement [frontend experiences](frontend.md) against qualified backend contracts, including Relationship Graph Blocks. |

Define cases before implementation. A specification or skipped/TODO test is not a passing executable test. Integrate cross-module tests as dependencies become available; G4 is the final combined gate, not the first integration attempt. Modules may progress independently after G1, but APIs cannot bypass their own persistence gate.

The selected [native Work](../architecture/database/native-work.md), [logical Unit capability](../architecture/database/README.md#34-unit-capabilities-across-owner-tables) and [composition](../architecture/database/content-composition.md) contracts govern the whole system. Reconcile domain keys, exact references, shared feature applicability and publication/import transitions before affected persistence/API work. Existing tables, APIs and implementation order can change to satisfy these contracts; older fixtures retain only their recorded qualification. Cross-database operation is a later activation, not a G2-G4 deliverable.

## Contract-first implementation sequence

1. Reconcile logical identity/owner/placement, cross-domain Work/release scope and property applicability with the dictionary; run the authored semantic matrices before selecting domain schema changes.
2. Qualify shared identity/revision/occurrence references, capability adapters and mixed AuthPrincipal/Entity authority together with affected consumers. Reconcile membership/group/role/representation state and assignment ceilings; resolve the external token privacy/adapter profile before its dependent DDL/APIs. Keep concrete domain invariants rather than replacing them with untyped references.
3. Implement exact content/adoption/published selections and staged composition import/refresh, including source correspondence, local-edit conflicts and recovery; ordinary node attachment remains reference-only.
4. Introduce revision-bound child pagination, coalesced metrics and bounded reverse impact/read models as one replacement path. Keep current 2,048/64 protections until that path passes its tests; do not solve large structures by raising in-memory limits.
5. Run end-to-end source -> adoption -> composition -> publication -> discovery/use -> revocation/recovery scenarios across domains. Qualify declared freshness, measured workload limits and known failures before frontend acceptance.

Modules may proceed independently where these contracts are resolved. This sequence changes dependency boundaries where needed; it is not authorization to skip persistence tests or to start unresolved execution/hosting work. [Design evidence](../architecture/database/design-evidence.md) records supporting sources and the limitations that the REZICS integration must still test.

## Modules and current target qualification

Existing code provides foundations. The revised target has not passed G2-G4 merely because older APIs or fixtures exist. This table is the single progress authority; module files contain work and criteria rather than duplicate status ledgers.

| ID | Module | Dependencies | Design | Target persistence/API/integration |
| --- | --- | --- | --- | --- |
| M01 | [Foundation](modules/foundation.md) | None | Shared identity/capability and mixed-grantee representation contracts selected; [opaque OAuth/public-client OIDC/MCP adapter profile qualified](../testing/identity-and-access.md#oauth-adapter-qualification), [Bun CIMD network boundary qualified](../testing/identity-and-access.md#cimd-network-qualification); client admission and live-domain integration pending | G2 in progress: [private mixed subjects and canonical authority roots qualified](../testing/foundation.md#mixed-authority-registry-qualification); [canonical reference storage, selected private/event consumers, canonical Following/Studio and Progress parent authority qualified](../testing/foundation.md); native private review/disclosure, reconciliation and selected worker recovery/current-executor fences qualified; reviewer authority and canonicalization/catalog-effect process recovery qualified; remaining recovery, consumers, revision/occurrence families, ownership/disclosure and other contracts pending; [IAM/APP target matrices](../testing/identity-and-access.md) pending; older Self/direct-grant evidence does not qualify this replacement |
| M02 | [Knowledge and graph](modules/knowledge-and-graph.md) | M01 | Defined; graph query contract specified | Pending |
| M03 | [Content and media](modules/content-and-media.md) | M01, M02 contracts | Defined | Pending |
| M04 | [Catalog](modules/catalog.md) | M01, M02, M03 contracts | Cross-domain Work/release selected; domain mappings and source-free cases required | Pending |
| M05 | [Creation and reading](modules/creation-and-reading.md) | M02-M04 | Cross-domain creation/composition contract selected; Book is the first journey | Pending |
| M06 | [Community and governance](modules/community-and-governance.md) | M01-M03 | Mixed membership/Groups/custom Roles and layered management selected; Realm/Collection/Zone composition specified; Dynamic Collections optional | G2 in progress: [stored wiki grouping, Zone pages and selected Collection read/curation authority, including target-read expiry rollback, qualified](../testing/wiki-composition.md); target content/adopted revisions, metadata/history/authority, batch/history capacity and remaining community contracts pending |
| M07 | [Sources and converters](modules/sources-and-converters.md) | M01-M04 native commands | Defined; full field conformance pending | Pending |
| M08 | [Skill, Prompt and MCP Hub](modules/ai-hub.md) | M01-M04 | Catalog scope defined; execution/hosting questions open | Pending |
| M09 | [Search and operations](modules/search-and-operations.md) | M01 and participating module events | Defined; known runtime failures open | G2 in progress: [snapshot generations, lifecycle, catalog/related-post reads and canonical event intake qualified](../testing/recommendations.md); [native failure diagnostics verified](../../services/main/performance/README.md#native-failure-artifacts); [Linux facet comparison passes, original crash unresolved](../testing/known-failures.md#native-facet-search-abort); remaining online disclosure, event delivery, capacity and restoration work pending |

G1 reconciles the dictionary with cross-domain Work/release, explicit composition/import, shared Unit features, mixed identity/representation, Groups/custom Roles, connected-app privacy, Graph API and Hub catalog requirements. The [identity/access capacity envelope](../architecture/identity-access-capacity.md) and [GUI layering](../architecture/identity-and-access-experience.md) are selected design obligations, not measured acceptance. Foundational harness work can proceed while independent Hub execution questions remain open. Do not declare an execution-enabled Hub complete without deciding and testing that scope.

## Per-module workflow

1. Inspect owning code and target dictionary; identify the semantic delta.
2. State valid/invalid examples, transitions, queries and workload assumptions.
3. Write fixtures and executable assertions before implementing changed behavior.
4. Implement owner-local schema/commands and exercise constraints, concurrency and recovery on a fresh development/test target.
5. Implement APIs, permissions, errors, OpenAPI/SDK generation and stateful request flows.
6. Add combined acceptance scenarios and reproducible evidence.
7. Review and commit the coherent change. Remove completed work, retaining lasting contracts/tests in their owners.

Test-discovered constraints update the owning design and dependent modules in the same logical change. Do not create a parallel target in a report or continuation memo.

## Verification entry points

From the repository root:

~~~sh
python docs/testing/database/check_design.py --check --require-tracked
python docs/testing/check_docs.py
~~~

Use owning Taskfiles for backend work. [Testing](../testing/README.md) distinguishes document checks from SQL/API, source and load qualification. Compatibility-free design still requires generated-contract integrity, reproducible installation and meaningful verification; follow [CONTRIBUTING](../../CONTRIBUTING.md) for the owning tools.
