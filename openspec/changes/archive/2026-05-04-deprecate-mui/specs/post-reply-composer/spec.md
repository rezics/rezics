## ADDED Requirements

### Requirement: Reply composer mode is single-line on mount in progressive mode

When mounted with `mode="progressive"`, the composer SHALL initially render as a single-line placeholder control whose visible height matches the rezics small-input scale (anchored to `var(--rezics-space-10)` / 40px), with no toolbar or action buttons visible. The control SHALL expand to the full editor region only when focused.

#### Scenario: Progressive mode initial render

- **WHEN** a `<ReplyComposer mode="progressive" />` mounts
- **THEN** the rendered element is a single-line placeholder control with a visible height of `var(--rezics-space-10)` (40px), matching the rezics small-input scale
- **AND** no toolbar or action buttons are visible

#### Scenario: Progressive mode expands on focus

- **WHEN** the user focuses the progressive composer
- **THEN** the control expands to the full editor region
- **AND** the body input retains focus
