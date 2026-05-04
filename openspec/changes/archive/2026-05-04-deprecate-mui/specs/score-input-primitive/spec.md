## ADDED Requirements

### Requirement: Score input renders as RatingInput primitive

Every interactive score-value input in the frontend (`package/app`, `package/admin`, `package/ui`) SHALL render the rezics-owned `RatingInput` primitive imported from `@rezics/ui` (source: `package/ui/src/primitive/control/RatingInput.tsx`). Custom score pickers — including `ToggleButtonGroup`-based number rows, bespoke star implementations, MUI `<Rating>`, or any equivalent — SHALL NOT be used for score entry. The prior "Score input renders as MUI Rating" contract is superseded by this requirement; MUI is permanently removed from the project per R8 of `convention-enforcement`.

#### Scenario: Remark inline form uses RatingInput

- **WHEN** the remark inline creation form is rendered on the book detail review tab
- **THEN** the score input component SHALL be `<RatingInput>` from `@rezics/ui`
- **AND** no `ToggleButtonGroup`, numeric-button row, MUI `<Rating>`, or custom widget SHALL appear as the score input

#### Scenario: Remark edit dialog uses RatingInput

- **WHEN** the remark edit dialog is opened
- **THEN** the score input component SHALL be `<RatingInput>` from `@rezics/ui`

#### Scenario: Any new score-input form uses RatingInput

- **WHEN** a new form is introduced that accepts a score value
- **THEN** it SHALL render `<RatingInput>` from `@rezics/ui` directly
- **AND** it SHALL NOT introduce a separate component or a new wrapper over `<RatingInput>`

### Requirement: RatingInput primitive has documented prop surface

The `<RatingInput>` primitive SHALL accept the following props:

- `value: number | null` — the current selection, in the inclusive range `1`–`max`, or `null` when no value is selected.
- `onChange: (next: number | null) => void` — invoked when the user interacts with the control. The `next` value SHALL be an integer in `1`–`max` or `null` (clearing).
- `max: number` — the upper bound of the rating. Defaults to `SCORE_MAX` re-exported from `@rezics/contract`.
- `precision: 1` — currently fixed at integer precision; the prop is reserved for future fractional support but SHALL NOT accept other values today.
- `size?: "sm" | "md" | "lg"` — visual size; defaults to `"md"`. Sizes SHALL derive their dimensions from `--rezics-space-*` tokens.
- `disabled?: boolean` — when true, the control SHALL render in a disabled state (visually muted, no pointer/keyboard interaction, `aria-disabled="true"`).
- `readOnly?: boolean` — when true, the control SHALL render the current value but SHALL NOT accept interaction. Distinct from `disabled` in that it preserves visual emphasis (used for displaying a peer's existing score).
- `aria-label?: string` — required when no surrounding `<label>` provides an accessible name.

#### Scenario: Props are typed and documented

- **WHEN** `package/ui/src/primitive/control/RatingInput.tsx` is inspected
- **THEN** the exported `RatingInputProps` type SHALL include all eight props above
- **AND** the JSDoc / TSDoc SHALL describe `value === null`, `onChange(null)`, and the `disabled` vs `readOnly` distinction

### Requirement: RatingInput supports keyboard interaction

The `<RatingInput>` primitive SHALL support full keyboard interaction:

- Arrow Right / Arrow Up: increment the selected value by 1, up to `max`.
- Arrow Left / Arrow Down: decrement the selected value by 1, down to 1.
- `1` through `9` keys (and `0` if `max >= 10`): set the selected value to that digit.
- `0` key (when `max < 10`): clear the selection (`onChange(null)`).
- `Home`: set to 1.
- `End`: set to `max`.
- `Tab` / `Shift+Tab`: move focus into / out of the rating control as a single tab stop.

The control SHALL implement a roving-tabindex pattern with a single accessible name on the wrapping `[role="radiogroup"]` element. Each star SHALL render with `[role="radio"]` and `aria-checked` reflecting selection state.

#### Scenario: Arrow key increments

- **WHEN** the rating has focus with `value = 3` and the user presses Arrow Right
- **THEN** `onChange(4)` SHALL be called

#### Scenario: Digit key sets value

- **WHEN** the rating has focus with any value and the user presses `7`
- **THEN** `onChange(7)` SHALL be called

#### Scenario: Boundary increment is clamped

- **WHEN** the rating has focus with `value = max` and the user presses Arrow Right
- **THEN** the value SHALL remain at `max`
- **AND** no spurious `onChange` SHALL be emitted

#### Scenario: Tab moves out

- **WHEN** the rating has focus on a star and the user presses Tab
- **THEN** focus SHALL leave the rating control entirely
- **AND** SHALL NOT cycle between stars

### Requirement: RatingInput uses lucide Star icon

The `<RatingInput>` primitive SHALL render its stars using the `Star` icon from `lucide-react`. Filled stars SHALL use the `--rezics-color-brand-fill` color via UnoCSS class. Empty stars SHALL render the same lucide `Star` glyph with `fill="none"` and `--rezics-color-text-tertiary` stroke. There SHALL NOT be a switch to a different star glyph (e.g. `Sparkles`, `Heart`) without an OpenSpec change.

#### Scenario: Filled star color

- **WHEN** a `<RatingInput>` has `value = 3` and `max = 5`
- **THEN** the first three stars SHALL render with `lucide-react`'s `Star` filled in `var(--rezics-color-brand-fill)`
- **AND** the last two stars SHALL render with `Star` outlined in `var(--rezics-color-text-tertiary)`

### Requirement: Score input integer 1–SCORE_MAX configuration

Every `<RatingInput>` used as a score input SHALL be configured with `max={SCORE_MAX}` (re-exported from `@rezics/contract`) and `precision={1}`, so the control emits integer values consistent with `scoreValueSchema`. This requirement supersedes the prior "Score input is configured as integer 1–SCORE_MAX" contract that referenced MUI `<Rating>`.

#### Scenario: Max matches the contract constant

- **WHEN** a score input is rendered
- **THEN** the `max` prop SHALL be `SCORE_MAX` (currently 10)
- **AND** it SHALL NOT be a hard-coded literal that could drift from the contract

#### Scenario: Precision is integer

- **WHEN** a user interacts with a score input
- **THEN** the `<RatingInput>` SHALL be configured with `precision={1}`
- **AND** emitted values SHALL be integers in the range 1–`SCORE_MAX` or `null`

### Requirement: Score input emits null when cleared

A score input SHALL be controlled with a `number | null` value; clearing the selection (e.g., clicking the currently selected star, or pressing the `0` key) SHALL emit `null` to the parent, matching the "score is optional" semantics enforced elsewhere in the system. This requirement supersedes the prior "Optional score emits null when cleared" contract.

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

`@rezics/ui` SHALL expose exactly one rating-input component, the `<RatingInput>` primitive itself, and SHALL NOT expose any additional wrapper components over it for score-input purposes. If a future need arises to encapsulate additional score-input behavior (e.g., inline validation, keyboard shortcuts beyond those built in), it SHALL be introduced only after this requirement is updated by a new change proposal. This requirement supersedes the prior "No custom or wrapper rating components in @rezics/ui" contract.

#### Scenario: UI package contains no rating wrapper

- **WHEN** `@rezics/ui` is inspected
- **THEN** no module SHALL export a component that wraps `<RatingInput>` for score input (e.g., `RatingWithInput`, `ScoreFormEdit`, `ScoreSelector`, or equivalent)
