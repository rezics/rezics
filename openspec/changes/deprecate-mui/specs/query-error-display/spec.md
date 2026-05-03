## MODIFIED Requirements

### Requirement: shadcn Alert-based styling

The component SHALL use shadcn `Alert` (from `@rezics/ui/shadcn`) with destructive variant for the error container, consistent with existing error display patterns in auth pages and other rezics surfaces. Collapsible technical-detail sections SHALL use shadcn `Collapsible`.

#### Scenario: Visual consistency

- **WHEN** `<QueryErrorDisplay>` renders an error
- **THEN** it SHALL use shadcn `Alert` from `@rezics/ui/shadcn` with the destructive variant
- **AND** the collapsible section SHALL use shadcn `Collapsible` (not MUI `Collapse`)
- **AND** there SHALL be no import from `@mui/material` in the component file

#### Scenario: Token-aligned destructive variant

- **WHEN** the destructive variant of shadcn `Alert` renders
- **THEN** the surface and border SHALL derive from `--rezics-color-error-fill` / `--rezics-color-error-text` / `--rezics-color-border-error` tokens
- **AND** the visual outcome SHALL be equivalent to the prior MUI `Alert severity="error"` outcome

## REMOVED Requirements

### Requirement: ~~MUI Alert-based styling~~ (replaced by shadcn Alert-based styling)

**Reason:** MUI is removed from the project. The error-display container migrates to shadcn `Alert` with the destructive variant, and the collapsible technical-detail section migrates to shadcn `Collapsible`.

**Migration:** Every existing `<QueryErrorDisplay>` site continues to work at the call-site level (the component prop surface is unchanged). The internal MUI `Alert` and `Collapse` are replaced atomically inside the component implementation.
