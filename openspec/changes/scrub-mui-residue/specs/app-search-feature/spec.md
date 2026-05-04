## MODIFIED Requirements

### Requirement: TagPicker chips render via shadcn Badge

`TagPicker` SHALL render the current tag list as removable shadcn `Badge` components (from `@rezics/ui/shadcn`) and accept new tags via:

1. Typing a token and pressing Enter or comma → chip `{ slug: token }` appended.
2. Pasting a comma-separated string → each comma-separated token added as its own chip.

Each rendered badge SHALL include an inline remove affordance — a small button containing a `lucide-react` `X` icon — that on activation removes the corresponding tag from the controlled value.

#### Scenario: Chip rendered as Badge

- **WHEN** `TagPicker` is rendered with one or more selected tags
- **THEN** each tag SHALL render as a shadcn `Badge`
- **AND** each badge SHALL include a remove button with a `lucide-react` `X` icon

#### Scenario: Remove tag via badge close button

- **WHEN** the user clicks the `X` icon on a tag badge
- **THEN** the corresponding tag SHALL be removed from the controlled value
- **AND** `onChange` SHALL emit the new tag list

### Requirement: AppliedFilterChips renders via shadcn Badge

`AppliedFilterChips` SHALL render residual-display chips for filter values not surfaced by a primitive component. Each chip SHALL be a shadcn `Badge` (from `@rezics/ui/shadcn`) with a remove affordance using a `lucide-react` `X` icon.

#### Scenario: Applied filter chip renders

- **WHEN** `AppliedFilterChips` is rendered with one or more residual filter values
- **THEN** each value SHALL render as a shadcn `Badge` with a remove affordance using a `lucide-react` `X` icon

## REMOVED Requirements

### Requirement: TagPicker provides real chip-based tag input

**Reason**: Superseded by "TagPicker chips render via shadcn Badge" (preserved above as a MODIFIED requirement). The obsolete version specified MUI chips; the active version specifies shadcn `Badge` from `@rezics/ui/shadcn`. MUI is permanently removed from the project, so the prior contract cannot be implemented.

**Migration**: None at the codebase level — `TagPicker` already renders tags as shadcn `Badge`. The active "TagPicker chips render via shadcn Badge" requirement is the sole authority going forward.
