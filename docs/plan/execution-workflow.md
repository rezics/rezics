# Implementation execution workflow

This document owns policy for the current implementation program. The [plan](README.md) records the active scope, phase and progress; [AGENTS.md](../../AGENTS.md#task-scope-and-evidence) governs task boundaries.

## Program authority

- The maintainer authorizes autonomous research, local commits under the phase policy, and full development/test environment operation: dependency/tool changes, downloads, services/containers, database resets and data regeneration. Use this authorization without repeated confirmation, within the active task and phase. Identify the actual target and preserve unrelated work; a fixture requirement alone never authorizes deleting unrelated data.
- There are no compatibility requirements for old schemas, APIs, SDKs, stored data, IDs/URLs, formats, deployment layouts or implementation behavior. Update retained consumers together and remove obsolete compatibility layers within scope; rebuild development/test state without legacy transfer, dual-write or online migration solely for compatibility. New-system integrity, source conversion, installation and recovery remain acceptance requirements. Released SQL and the completed installation baseline retain their [contribution rules](../../CONTRIBUTING.md#database-and-catalog).

## Scope, phase and gate

A scope covers a gate across named modules or selected sections of a large design document. Record deliverables, required consumers and exclusions in the plan. Resolve material contracts before dependent implementation; do not silently expand or shrink the scope to change when testing begins.

A phase applies to that entire scope across modules, commits and conversations. A gate records executed acceptance. Follow the plan's dependency rules; implementation completion never passes a gate.

## Phases and transitions

| Phase | Work and exit condition |
| --- | --- |
| `implementation` | Complete all included schemas, commands, policy, APIs, generated artifacts, workers and consumers; fix defects apparent from source inspection. Once no required behavior remains a stub/TODO, record implementation complete and continue to `test-authoring`. |
| `test-authoring` | Reuse contract scenarios; add/update necessary assertions, fixtures and harness support, including rejected states, transitions and affected cross-module cases. Continue to `verification` when required cases and reproducible commands are ready. |
| `verification` | Run applicable static, behavioral, persistence, API and authorized rendered checks, plus integration/capacity/recovery checks whose dependencies are ready. Failures lead to `repair`; success qualifies only the covered scope/gates, then advances to the next dependency-ready scope. |
| `repair` | Fix identified defects and related tests; update owning contracts and consumers when semantics change. Return to `verification` for affected checks. Reopen broader implementation only if the defect changes scope. |

Advance automatically within the authorized task. Narrow maintenance tasks do not reset the phase or start backend work. Missing dependencies remain explicit and unqualified. Test expectations come from contracts; never weaken assertions or hide failures to close a phase.

## Verification timing and permitted operations

During `implementation`, pause test writing/execution, fixture work, test infrastructure tuning, manual/rendered QA and validation experiments. This includes TypeScript/typechecks, lint, build verification, document/design checkers, schema replay/checks, generated-contract checks, screenshots and benchmarks. There is no implicit static-check exception. Test-authoring and repair prepare changes; checks run in verification.

Source inspection, necessary contract research, editing, diff review, Git and production artifact generation remain allowed. Inspect owning generator tasks and separate bundled tests/validation from necessary generation. Preserve runtime authorization, integrity constraints, generator safety guards and target-protection preconditions; never hand-edit generated files or upstream mirrors.

Do not launch CI to circumvent the pause; independent advisory CI neither switches phase nor hides failures. Existing acceptance requirements and [browser authorization boundaries](../../AGENTS.md#data-and-verification-boundaries) still apply.

## Progress, commits and completion

Use the plan's single progress table. Record implementation and verification separately, retain pending acceptance, and preserve earlier evidence only for its tested contracts/revisions. [Testing](../testing/README.md) owns commands, fixtures, results and limitations.

Follow [commit conventions](../../CONTRIBUTING.md#commits-and-verification). During the pause, tests/checks are deferred rather than commit prerequisites: state this in the commit body and handoff, and do not claim build/runtime success or release qualification. Inspect local hooks; use and disclose a command-scoped skip if they would run paused checks, preserving their configuration. Documentation maintenance can finish with source/diff review.

## Decision basis and limits

The maintainer selected concentrated phases at document/gate scope. [Santos et al., 2020](https://arxiv.org/abs/2011.11942) found slightly higher quality for TDD novices using iterative test-last across 12 experiments; this does not establish large-scope agent performance. [DORA, updated 2025-12-08](https://dora.dev/capabilities/working-in-small-batches/) warns that accumulating changes delays feedback. Compare total implementation, verification and repair time before claiming a speed improvement.

Instruction routing follows [OpenAI guidance, consulted 2026-09-15](https://developers.openai.com/api/docs/guides/latest-model). Behavioral evaluation remains deferred: later assess a cross-module implementation, a verification-to-repair transition and a documentation-only task under the [research skill](../../.agents/skills/research-and-validation/SKILL.md).
