## MODIFIED Requirements

### Requirement: Score input renders as RatingInput primitive

Every interactive score-value input in the frontend (`package/app`, `package/admin`, `package/ui`) SHALL render the rezics-owned `RatingInput` primitive imported from `@rezics/ui` (source: `package/ui/src/primitive/control/RatingInput.tsx`). Custom score pickers — including `ToggleButtonGroup`-based number rows, bespoke star implementations, or any equivalent — SHALL NOT be used for score entry.

#### Scenario: Remark inline form uses RatingInput

- **WHEN** the remark inline creation form is rendered on the book detail review tab
- **THEN** the score input component SHALL be `<RatingInput>` from `@rezics/ui`
- **AND** no `ToggleButtonGroup`, numeric-button row, or custom widget SHALL appear as the score input

#### Scenario: Remark edit dialog uses RatingInput

- **WHEN** the remark edit dialog is opened
- **THEN** the score input component SHALL be `<RatingInput>` from `@rezics/ui`

#### Scenario: Any new score-input form uses RatingInput

- **WHEN** a new form is introduced that accepts a score value
- **THEN** it SHALL render `<RatingInput>` from `@rezics/ui` directly
- **AND** it SHALL NOT introduce a separate component or a new wrapper over `<RatingInput>`

### Requirement: Score input integer 1–SCORE_MAX configuration

Every `<RatingInput>` used as a score input SHALL be configured with `max={SCORE_MAX}` (re-exported from `@rezics/contract`) and `precision={1}`, so the control emits integer values consistent with `scoreValueSchema`.

#### Scenario: Max matches the contract constant

- **WHEN** a score input is rendered
- **THEN** the `max` prop SHALL be `SCORE_MAX` (currently 10)
- **AND** it SHALL NOT be a hard-coded literal that could drift from the contract

#### Scenario: Precision is integer

- **WHEN** a user interacts with a score input
- **THEN** the `<RatingInput>` SHALL be configured with `precision={1}`
- **AND** emitted values SHALL be integers in the range 1–`SCORE_MAX` or `null`

### Requirement: Score input emits null when cleared

A score input SHALL be controlled with a `number | null` value; clearing the selection (e.g., clicking the currently selected star, or pressing the `0` key) SHALL emit `null` to the parent, matching the "score is optional" semantics enforced elsewhere in the system.

#### Scenario: Clearing emits null via click

- **WHEN** the user clicks the currently selected star in a score input
- **THEN** the `onChange` handler SHALL receive `null` as the new value

#### Scenario: Clearing emits null via keyboard

- **WHEN** the user presses the `0` key while a score input has keyboard focus
- **THEN** the `onChange` handler SHALL receive `null` as the new value

#### Scenario: Initial empty state is null

- **WHEN** a score input is rendered with no prior value
- **THEN** the `value` prop SHALL be `null`
- **AND** the `<RatingInput>` SHALL display no selected stars

### Requirement: @rezics/ui exposes only the RatingInput primitive

`@rezics/ui` SHALL expose exactly one rating-input component, the `<RatingInput>` primitive itself, and SHALL NOT expose any additional wrapper components over it for score-input purposes. If a future need arises to encapsulate additional score-input behavior (e.g., inline validation, keyboard shortcuts beyond those built in), it SHALL be introduced only after this requirement is updated by a new change proposal.

#### Scenario: UI package contains no rating wrapper

- **WHEN** `@rezics/ui` is inspected
- **THEN** no module SHALL export a component that wraps `<RatingInput>` for score input (e.g., `RatingWithInput`, `ScoreFormEdit`, `ScoreSelector`, or equivalent)

## REMOVED Requirements

### Requirement: Score input renders as MUI Rating

**Reason**: Superseded by "Score input renders as RatingInput primitive" (preserved above). The prior MUI-based contract is obsolete now that MUI is permanently removed; keeping it as historical text in the active spec creates two contradictory statements of the same rule.

**Migration**: None at the codebase level — `RatingInput` is already in place and the prior MUI Rating is gone. The active "Score input renders as RatingInput primitive" requirement is the sole authority going forward.

### Requirement: Score input is configured as integer 1–SCORE_MAX

**Reason**: Superseded by "Score input integer 1–SCORE_MAX configuration" (preserved above). The prior version named MUI `<Rating>` as the configured component; the active version names `<RatingInput>`. Removing the obsolete entry collapses the spec to a single current statement.

**Migration**: None at the codebase level.

### Requirement: Optional score emits null when cleared

**Reason**: Superseded by "Score input emits null when cleared" (preserved above). The two requirements describe the same null-clearing semantics; the surviving version covers both click and keyboard paths and references `<RatingInput>`.

**Migration**: None at the codebase level.

### Requirement: No custom or wrapper rating components in @rezics/ui

**Reason**: Superseded by "@rezics/ui exposes only the RatingInput primitive" (preserved above). The prior version forbade wrappers over MUI `<Rating>`; the active version forbids wrappers over `<RatingInput>`. Same intent, current vocabulary.

**Migration**: None at the codebase level.
