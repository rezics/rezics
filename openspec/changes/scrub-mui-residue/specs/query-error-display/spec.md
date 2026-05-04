## MODIFIED Requirements

### Requirement: shadcn Alert-based styling

The component SHALL use shadcn `Alert` (from `@rezics/ui/shadcn`) with destructive variant for the error container, consistent with existing error display patterns in auth pages and other rezics surfaces. Collapsible technical-detail sections SHALL use shadcn `Collapsible`.

#### Scenario: Visual consistency

- **WHEN** `<QueryErrorDisplay>` renders an error
- **THEN** it SHALL use shadcn `Alert` from `@rezics/ui/shadcn` with the destructive variant
- **AND** the collapsible section SHALL use shadcn `Collapsible`

#### Scenario: Token-aligned destructive variant

- **WHEN** the destructive variant of shadcn `Alert` renders
- **THEN** the surface and border SHALL derive from `--rezics-color-error-fill` / `--rezics-color-error-text` / `--rezics-color-border-error` tokens

## REMOVED Requirements

### Requirement: MUI Alert-based styling

**Reason**: Superseded by "shadcn Alert-based styling" (preserved above). MUI is permanently removed from the project; `<QueryErrorDisplay>` already uses shadcn `Alert` and `Collapsible`. Keeping the obsolete MUI-Alert requirement creates two contradictory statements of how the component should style itself.

**Migration**: None at the codebase level — `<QueryErrorDisplay>` was migrated to shadcn during the deprecate-mui change.
