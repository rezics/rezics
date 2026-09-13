# Next-version proposals

This directory collects candidate initiatives for a later REZICS product
version. It is an index of independent proposals, not the roadmap or execution
authority for the [current implementation program](../plan/README.md). A proposal
here has no assigned release, implementation status or standing authorization
unless its own document explicitly records a later activation decision.

## Proposals

| Proposal | Supporting assessment | Status |
| --- | --- | --- |
| [World comments and spatial views](world-comments.md) | [Logical feasibility and commercial value](world-comments-feasibility.md) | Proposed; researched, not activated |

Each primary proposal owns its prospective product outcome, scope, dependencies,
logical design and activation criteria. A supporting assessment owns the external
evidence, alternatives, limitations and commercial reasoning used to shape that
proposal. Future initiatives should receive their own primary document and an
entry in this table; they should not be added as unrelated sections of an existing
proposal.

## Relationship to maintained documentation

- The [current implementation plan](../plan/README.md) remains the sole authority
  for active program work and progress.
- [Architecture](../architecture/) owns selected, lasting contracts. A proposal
  may describe prospective contracts, but does not supersede current architecture.
- [Open research](../research/README.md) holds unresolved questions that can change
  the current target. Research retained here supports a deferred proposal instead.
- When a proposal is activated, reconcile it with the then-current system, move
  lasting contracts to their architecture owners and put remaining implementation
  work in the active plan. Remove completed or rejected proposal documents once
  they no longer serve an active decision; Git retains their history.
