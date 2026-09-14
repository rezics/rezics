# GUI design method

Use for changed interaction or information organization. Apply the
[product principles](../../../../docs/architecture/product-design-principles.md)
to the intended audience and task; do not mirror the API schema onto the screen.

## Tasks and capability fidelity

Identify what users need to find, compare, decide or perform. Separate frequent
tasks from collaboration and specialist administration where that distinction
helps; do not impose a fixed number of screens or disclosure levels. Give each
relevant user-facing capability a usable path for its intended audience. Identify
actual product/role restrictions and gaps rather than inventing restrictions to
dismiss a missing capability.

Preserve set/list/tuple meaning, multiple values, operators such as any-of/all-of/
none-of, supported nesting, ranges, cross-page selection, ordering and partial
outcomes. A summarized view must retain a way to inspect the actual selection.
Ordinary edits preserve advanced API-created state and omitted/null/empty values;
use a capable editor when a simple control cannot represent a configuration safely.
Never silently normalize a custom configuration into a preset.

## Information and interaction

Choose layout by task: tables support comparison, while lists or cards can support
browsing. Use meaningful groups and headings for
[scanning](https://www.nngroup.com/articles/layer-cake-pattern-scanning/).
Keep identity, units, current conditions and material consequences recognizable.

Use summaries and discoverable advanced entry points. Prototype original layouts
when useful; evaluate navigation and state handling instead of assuming a familiar
pattern or an extra disclosure layer is always better.

Choose controls by intent, option scale, frequency and device within
[the existing UI system](../../../../libraries/ui/README.md). These are examples,
not component mandates:

- Small multi-selection can use a [checkbox group](https://design-system.service.gov.uk/components/checkboxes/).
- Many or remote choices can use searchable multi-select with persistent
  [input chips](https://developer.android.com/develop/ui/compose/components/chip).
- Choose immediate or explicitly applied [filters](https://carbondesignsystem.com/patterns/filtering/)
  according to task complexity and query cost; distinguish draft from applied state.

Keep affected targets, attribution, consent and outcomes clear. Preserve input on
recoverable errors. Use the relevant [WAI-ARIA pattern](https://www.w3.org/WAI/ARIA/apg/patterns/)
for interaction semantics; keyboard focus and selection are different states.

## Validation and completion

Check a common task, an advanced task and a round trip through API-created state
where relevant. Examples include saving two selections together, preserving a
nested condition while editing its label, and retaining expiry/scope settings when
a user edits an ordinary field. Check whether advanced controls can actually be
found and whether the initial view makes the common task clear.

Use [external-content-value](../../external-content-value/SKILL.md) for changed
audience-facing text and [storybook-ui-review](../../storybook-ui-review/SKILL.md)
for visible implementation changes. Their owners govern localization and rendered
checks under [AGENTS.md](../../../../AGENTS.md#data-and-verification-boundaries).
Design-only work does not claim rendered results or start an application solely
for QA. API-only work does not acquire a screenshot requirement from this method.
Report scoped evidence and remaining limits; AI/static review is not measured
human usability. Finish when the authorized outcome and its required checks are met.
