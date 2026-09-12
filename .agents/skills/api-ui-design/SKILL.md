---
name: api-ui-design
description: Design or review REZICS UI when information organization, interaction capabilities, or API-to-UI mappings change.
---

# API and UI design

Structured APIs are the primary interface for REZICS capabilities. UI makes
those capabilities understandable and usable by people. Preserve the API's
business meaning while organizing information and actions around the user's task.
Follow the current request and the [repository scope and evidence rules](../../../AGENTS.md#task-scope-and-evidence).

## Capability fidelity

Ground coverage in the owning request and response schemas, runtime validation,
server capability and permission policies, and affected consumers. Check the
effective contract for the current context; a shared type's alternatives may
exceed what a particular operation permits.

- Give each relevant user-facing API capability a discoverable, usable UI path.
  Do not reduce cardinality, valid choices or operations to fit a control.
  Identify actual role or product restrictions and uncovered capabilities;
  do not invent restrictions to dismiss a gap.
- Preserve identities, limits and collection meaning: a set, ordered list and
  tuple need different interactions. Multiple values and their relationship
  are separate capabilities; retain operators such as `any-of`, `all-of` and
  `none-of`, including supported nesting.
- Preserve unchanged meaning through editing, submission and redisplay,
  including state created through the API and switches between basic and
  advanced controls. Retain distinctions between omitted values, `null` and
  empty collections where the contract makes them meaningful.
- Carry operation semantics through the UI: range boundaries, selection scope
  across pages, batch behavior and partial failures matter when supported.
  Protocol details such as opaque continuation tokens can be handled by the
  client without requiring users to edit them.

For a complex change or audit, a small mapping from capability to UI expression,
request/result behavior, evidence and remaining gap can clarify coverage. Choose
the useful granularity for the affected feature; a table is not a required artifact.

## Reading

Identify what users need to find, compare or decide. Choose the information and
presentation for that task: a table can support comparison across common
attributes; a list or cards can support browsing individual subjects. Group
related content and use descriptive headings to support
[scanning](https://www.nngroup.com/articles/layer-cake-pattern-scanning/).
Keep identity, units, missing values and status understandable.

Use summaries and [progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
to prioritize common needs while keeping detail and advanced capabilities
reachable. Make the route to those capabilities clear, and keep active conditions
and consequences visible enough to understand the current result.

## Interaction

Choose controls by intent, option scale, frequency and device within the
[existing UI system](../../../libraries/ui/README.md). These are conditional
patterns, not component mandates:

- A small set of multiple choices can use a
  [checkbox group](https://design-system.service.gov.uk/components/checkboxes/).
- Many or remotely searched choices can use a searchable multi-select with
  persistent selected items. [Input chips](https://developer.android.com/develop/ui/compose/components/chip)
  can display and remove chosen objects; filter chips can toggle short filter
  choices. Keep the full selection inspectable and editable when summarizing it.
- Choose instant or explicit application of filters according to task complexity
  and response cost. Keep draft and applied state distinguishable, and make
  clearing behavior clear. [Carbon filtering](https://carbondesignsystem.com/patterns/filtering/)
  provides examples of these tradeoffs.

Make the affected objects, selection state and execution outcome clear. Preserve
input on recoverable failure and expose relevant per-item results for batch work.
Use the chosen component's keyboard and accessibility behavior; focus and
selection are distinct states. Consult the relevant
[WAI-ARIA pattern](https://www.w3.org/WAI/ARIA/apg/patterns/) when needed.

## Completion

Use evidence that matches the changed capability. For example, verify that two
distinct selections reach the request together and survive redisplay, or that
editing a condition preserves its operator and grouping. Component props alone
do not prove coverage. Reuse or update relevant behavior checks proportionally.

Use [external-content-value](../external-content-value/SKILL.md) for changed
audience-facing text and [storybook-ui-review](../storybook-ui-review/SKILL.md)
for visible implementation changes. Those owners govern localization, rendered
evidence and required checks; this skill adds no separate approval gate.
Finish when the authorized outcome is met, scoped findings are resolved and
required checks pass. Report remaining gaps and unverified boundaries accurately;
AI review and static checks do not establish measured human usability.
