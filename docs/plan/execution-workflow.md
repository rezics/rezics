# Implementation execution workflow

This document owns execution timing for the current implementation program.
The [plan](README.md) owns the active scope, phase, dependencies and progress;
architecture owns contracts, module files own remaining deliverables, and
[testing](../testing/README.md) owns scenarios and evidence. Apply the current
user request first. A documentation, research or review task does not authorize
starting the implementation scope recorded in the plan.

## Scope, phase and gate

- A **scope** is a complete body of work targeting a gate across named modules,
  or the selected contracts in named sections of a large design document. Record
  included deliverables, required consumers, exclusions and completion conditions
  in the plan before implementation. A gate name alone does not identify modules.
- A **phase** selects the work to perform across that entire scope. Module,
  function, commit and conversation boundaries do not switch phases.
- A **gate** records acceptance supported by executed verification. Finishing
  implementation or committing code does not pass a gate.

Resolve material contract decisions before their dependent implementation. Reuse
existing decisions and scenario matrices. Complete independent work while a
material question is unresolved; record the affected dependency in its owner.
Do not silently add undecided extensions, expand the scope to postpone testing,
or shrink it to a convenient submodule to begin testing early.

APIs may be implemented with their persistence owners before G2 passes. Frontend
implementation may begin within an active scope when its selected API contracts
and required backend implementations are available, before whole-system G4.
Dependency order and server-enforced policy still apply. Acceptance follows the
G2-G5 evidence dependencies in the plan; early consumers remain unverified.

## Phases and transitions

| Phase | Work across the active scope | Exit condition and next phase |
| --- | --- | --- |
| `implementation` | Complete schemas, migrations, domain commands, policy, APIs, generated transports, workers and required consumers. Update owning contracts when necessary. Correct defects already apparent from reading the code. | Every included deliverable and consumer is implemented, with no stub or TODO substituting for required behavior. Record implementation complete and verification pending; continue to `test-authoring`. |
| `test-authoring` | Reuse existing cases and add or update necessary executable assertions, fixtures and harness support against the selected contracts. Include rejected states, transitions and affected cross-module boundaries. | Required cases have executable coverage and reproducible commands; continue to `verification`. Unavailable dependencies remain explicit and prevent claiming acceptance. |
| `verification` | Execute affected static checks and the required behavioral, persistence, API and authorized rendered checks. Run applicable integration, capacity and recovery acceptance when their dependencies are ready. Record commands, tested revisions, failures and limits in test owners. | On failure, continue to `repair`. On success, update only the gates and scope actually qualified, then select the next dependency-ready scope from the plan. |
| `repair` | Fix the identified defects and update related tests. A contract correction updates its architecture and affected consumers together. | Corrections and related assertions are ready; return to `verification` for affected checks. Reopen broader implementation only when the defect changes the required scope. |

Advance automatically when the recorded exit condition is met, within the user's
authorized task. Do not require another permission request at each phase. Preserve
the active phase across task continuations; a narrow maintenance task does not
reset it. Tests derive expectations from contracts, not from observed implementation
behavior. Do not weaken assertions or hide known failures to close a phase.

## Verification timing and permitted operations

During `implementation`, pause all test writing and test execution, fixture work,
test infrastructure tuning, manual behavioral QA and validation experiments.
Defer TypeScript/typechecks, lint, build verification, document/design checkers,
schema replay/checks, generated-contract checks, screenshots and benchmarks too.
There is no implicit static-check exception. `test-authoring` and `repair` prepare
their changes; execute checks in `verification` rather than interleaving phases.

Source inspection, contract research needed for an implementation decision,
editing, diff review and Git operations remain available. Use owning generators
to produce required production artifacts, including migrations and API/SDK code;
generation does not establish acceptance. Inspect the command before use: a task
that bundles tests or validation is not an exception merely because it also
generates files. Separate the required generation path from deferred validation
using the owning tools; do not hand-edit generated files or upstream mirrors.
Retain runtime policy and generator safety guards; the pause does not authorize
disabling authorization, integrity constraints or target-protection preconditions.

Retain existing tests, fixtures, deterministic checks and CI configuration. Do not
launch CI as a workaround for the pause; an independently running advisory CI job
does not switch the active phase. Preserve its failures for scoped verification.
The pause changes when verification happens, not the target's integrity, privacy,
installation, recovery or 500M/3B capacity obligations. Full-application browser QA
still requires the current task's explicit authorization under
[AGENTS.md](../../AGENTS.md#data-and-verification-boundaries).

## Progress, commits and completion

Keep implementation status separate from verification status in the plan's single
module table. Preserve applicable earlier evidence with its tested contract and
revision; mark changed guarantees as pending requalification. Retain unfinished
acceptance work after implementation is complete. Do not create another status
ledger in this workflow, a module file or a continuation report.

Commit coherent changes during any phase after reviewing the exact staged diff.
Include required production consumers and generated artifacts together; split
unrelated work and preserve other staged changes. During the implementation pause,
tests and checks are deferred rather than commit prerequisites. State that fact
in the commit body and handoff. Code should remain structurally coherent, but do
not claim that it builds or behaves correctly without executed evidence. A local
commit is an implementation checkpoint, not acceptance or release qualification.

Inspect local commit hooks before committing. If a hook would run paused checks,
use a command-scoped hook skip for that commit and disclose it; retain the hook
and CI configuration. Documentation-only maintenance can finish with source and
diff review during the pause without starting backend work or switching phases.

During verification, use the nearest meaningful checks, expanding for affected
dependencies, failures or unresolved concerns. Stop once the required checks pass
unless new changes invalidate them. Frontend acceptance includes affected workspace
TypeScript/deterministic checks and scoped Storybook screenshot inspection; never
report verified completion with outstanding integrity failures. Final combined
backend acceptance remains governed by [the acceptance matrix](backend-acceptance.md).

## Decision basis and limits

The maintainer selected document- or gate-sized implementation scopes with
concentrated test authoring, verification and repair. This reduces phase switching
by construction; its effect on total delivery time is unmeasured. The alternatives
were per-change test-first work and deferring all verification until the whole
product was implemented. This workflow fixes scope and transition conditions while
retaining the original acceptance requirements.

[Santos et al., 2020](https://arxiv.org/abs/2011.11942) aggregated 12 experiments
and found slightly higher quality for TDD novices using iterative test-last than
TDD. That does not establish the performance of large unverified agent changes.
[DORA's small-batch guidance, updated 2025-12-08](https://dora.dev/capabilities/working-in-small-batches/)
warns that accumulating changes before testing delays feedback; coherent commits
alone do not remove that tradeoff. Compare implementation, verification and repair
time over a completed scope before claiming a speed improvement.

[OpenAI model guidance, consulted 2026-09-15](https://developers.openai.com/api/docs/guides/latest-model)
recommends auditing conflicting instructions and calibrating verification to the
task. This workflow centralizes timing and leaves acceptance evidence with its
owners. Behavioral evaluation of these instructions is deferred with other tests.
Representative later evaluation should cover a cross-module identity/API change
that stays in implementation until the whole scope is ready, a verification failure
that enters scoped repair, and an ordinary documentation edit that neither starts
backend work nor triggers application QA.
