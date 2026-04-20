## ADDED Requirements

### Requirement: Score input renders as MUI Rating

Every interactive score-value input in the frontend (`package/app`, `package/admin`, `package/ui`) SHALL render MUI's `<Rating>` component (`@mui/material/Rating`). Custom score pickers — including `ToggleButtonGroup`-based number rows, bespoke star implementations, or any equivalent — SHALL NOT be used for score entry.

#### Scenario: Remark inline form uses MUI Rating
- **WHEN** the remark inline creation form is rendered on the book detail review tab
- **THEN** the score input component SHALL be `<Rating>` from `@mui/material/Rating`
- **AND** no `ToggleButtonGroup`, numeric-button row, or custom widget SHALL appear as the score input

#### Scenario: Remark edit dialog uses MUI Rating
- **WHEN** the remark edit dialog is opened
- **THEN** the score input component SHALL be `<Rating>` from `@mui/material/Rating`

#### Scenario: Any new score-input form uses MUI Rating
- **WHEN** a new form is introduced that accepts a score value
- **THEN** it SHALL render `<Rating>` from `@mui/material/Rating` directly
- **AND** it SHALL NOT introduce a custom component or a new wrapper over `<Rating>`

### Requirement: Score input is configured as integer 1–SCORE_MAX

Every MUI `<Rating>` used as a score input SHALL be configured with `max={SCORE_MAX}` (re-exported from `@rezics/contract`) and `precision={1}`, so the control emits integer values consistent with `scoreValueSchema`.

#### Scenario: Max matches the contract constant
- **WHEN** a score input is rendered
- **THEN** the `max` prop SHALL be `SCORE_MAX` (currently 10)
- **AND** it SHALL NOT be a hard-coded literal that could drift from the contract

#### Scenario: Precision is integer
- **WHEN** a user interacts with a score input
- **THEN** the `<Rating>` SHALL be configured with `precision={1}`
- **AND** emitted values SHALL be integers in the range 1–`SCORE_MAX` or `null`

### Requirement: Optional score emits null when cleared

A score input SHALL be controlled with a `number | null` value; clearing the selection (e.g., clicking the currently selected star) SHALL emit `null` to the parent, matching the "score is optional" semantics enforced elsewhere in the system.

#### Scenario: Clearing emits null
- **WHEN** the user clicks the currently selected star in a score input
- **THEN** the `onChange` handler SHALL receive `null` as the new value

#### Scenario: Initial empty state is null
- **WHEN** a score input is rendered with no prior value
- **THEN** the `value` prop SHALL be `null`
- **AND** the `<Rating>` SHALL display no selected stars

### Requirement: No custom or wrapper rating components in @rezics/ui

`@rezics/ui` SHALL NOT expose wrapper components over MUI `<Rating>` for score-input purposes. If a future need arises to encapsulate additional score-input behavior (e.g., inline validation, keyboard shortcuts), it SHALL be introduced only after this requirement is updated by a new change proposal.

#### Scenario: UI package contains no rating wrapper
- **WHEN** `@rezics/ui` is inspected
- **THEN** no module SHALL export a component that wraps `<Rating>` for score input (e.g., `RatingWithInput`, `ScoreFormEdit`, or equivalent)
