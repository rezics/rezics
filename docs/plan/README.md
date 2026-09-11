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
| [Database architecture](../architecture/database/README.md) | Target meaning, relational dictionary, invariants and capacity assumptions. |
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

## Modules and current target qualification

Existing code provides foundations. The revised target has not passed G2-G4 merely because older APIs or fixtures exist. This table is the single progress authority; module files contain work and criteria rather than duplicate status ledgers.

| ID | Module | Dependencies | Design | Target persistence/API/integration |
| --- | --- | --- | --- | --- |
| M01 | [Foundation](modules/foundation.md) | None | Defined; reference allocation protocol specified | G2 in progress: [canonical reference storage, selected private consumers and authority protocols qualified](../testing/foundation.md); native private review/disclosure, reconciliation and selected worker recovery/current-executor fences qualified; reviewer authority and canonicalization/catalog-effect process recovery qualified; remaining recovery, consumers, revision/occurrence families, ownership/disclosure and other contracts pending |
| M02 | [Knowledge and graph](modules/knowledge-and-graph.md) | M01 | Defined; graph query contract specified | Pending |
| M03 | [Content and media](modules/content-and-media.md) | M01, M02 contracts | Defined | Pending |
| M04 | [Catalog](modules/catalog.md) | M01, M02, M03 contracts | Defined; source-free grain cases required | Pending |
| M05 | [Creation and reading](modules/creation-and-reading.md) | M02-M04 | Book/AO3 and original-creation requirements specified | Pending |
| M06 | [Community and governance](modules/community-and-governance.md) | M01-M03 | Defined; Realm/Collection/Zone wiki composition specified; Dynamic Collections optional | Pending |
| M07 | [Sources and converters](modules/sources-and-converters.md) | M01-M04 native commands | Defined; full field conformance pending | Pending |
| M08 | [Skill, Prompt and MCP Hub](modules/ai-hub.md) | M01-M04 | Catalog scope defined; execution/hosting questions open | Pending |
| M09 | [Search and operations](modules/search-and-operations.md) | M01 and participating module events | Defined; known runtime failures open | G2 in progress: [snapshot generations, lifecycle and catalog recommendation reads qualified](../testing/recommendations.md); remaining online disclosure, event delivery, capacity and restoration work pending |

G1 begins by reconciling the dictionary with Book/AO3, Graph API and Hub catalog requirements. Foundational harness work can proceed while independent Hub execution questions remain open. Do not declare an execution-enabled Hub complete without deciding and testing that scope.

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
