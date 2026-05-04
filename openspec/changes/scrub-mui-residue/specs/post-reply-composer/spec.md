## MODIFIED Requirements

### Requirement: ReplyComposer mode prop selects start state

`ReplyComposer` SHALL accept a required `mode` prop with two values:

- `"progressive"`: renders a single-line, low-height placeholder that looks like an input field with placeholder text (localised, content-type-aware). Focusing the field SHALL expand it into the full editor region (toolbar, multi-line body area, Cancel / Post buttons).
- `"expanded"`: renders the full editor region immediately on mount (toolbar, body area, Cancel / Post buttons, body focused).

`ReplyComposer` SHALL NOT expose any prop named `variant`, `collapsed`, or `initialOpen` — `mode` is the single axis of control.

#### Scenario: Progressive mode collapsed on mount

- **WHEN** a `<ReplyComposer mode="progressive" />` mounts
- **THEN** the rendered element is a single-line placeholder control matching the rezics small-input scale (per "Reply composer mode is single-line on mount in progressive mode")
- **AND** no toolbar or action buttons are visible

#### Scenario: Progressive mode expands on focus

- **WHEN** the user focuses the progressive composer
- **THEN** the control expands to the full editor region
- **AND** the body input retains focus

#### Scenario: Expanded mode renders full editor on mount

- **WHEN** a `<ReplyComposer mode="expanded" />` mounts
- **THEN** the full editor region is visible immediately
- **AND** the body input is focused
