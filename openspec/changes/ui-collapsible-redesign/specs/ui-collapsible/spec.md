## ADDED Requirements

### Requirement: Visual-line truncation

The `<Collapsible>` primitive SHALL clamp its rendered children to a caller-specified number of visual lines using CSS line-clamp semantics, regardless of the underlying character count, glyph width, or markup shape of the children.

#### Scenario: Collapsed state clamps to `maxLines`

- **WHEN** a consumer renders `<Collapsible maxLines={3}>{longContent}</Collapsible>` in a container narrow enough that the children would wrap to more than three visual lines
- **THEN** the rendered output SHALL display exactly three visual lines of content with the remainder hidden via CSS clamping
- **AND** the full children SHALL remain present in the DOM (not removed by JavaScript slicing)

#### Scenario: CJK and emoji content respect visual lines

- **WHEN** the children contain CJK characters, combined emoji, or mixed-width glyphs
- **THEN** the collapsed state SHALL still clamp to exactly `maxLines` visual rows
- **AND** the toggle visibility SHALL NOT be influenced by the raw character count of the children

### Requirement: Overflow-gated toggle rendering

The `<Collapsible>` primitive SHALL render its expand/collapse toggle if and only if the children actually overflow the clamped container at the current container width. The toggle MUST NOT appear when the un-clamped children already fit within `maxLines` visual rows.

#### Scenario: Short content shows no toggle

- **WHEN** the children, when rendered un-clamped, fit within `maxLines` visual rows at the current container width
- **THEN** the toggle SHALL NOT be visible
- **AND** the primitive SHALL render the children at their natural height

#### Scenario: Toggle appears only after overflow is detected

- **WHEN** the un-clamped children would exceed `maxLines` visual rows at the current container width
- **THEN** after the initial client-side measurement the toggle SHALL be visible
- **AND** the collapsed state SHALL show exactly `maxLines` rows with the remainder hidden

#### Scenario: Container widens until content fits

- **WHEN** the parent container is resized such that the children fit within `maxLines` visual rows without clamping
- **THEN** the toggle SHALL be hidden without requiring a manual re-render by the consumer
- **AND** the primitive SHALL return to showing the natural-height children

#### Scenario: Container narrows back into overflow

- **WHEN** the parent container is resized from a wide state back into a narrow state where children again overflow
- **THEN** the toggle SHALL reappear automatically
- **AND** the collapsed clamp SHALL be re-applied

### Requirement: Toggle styling is background-agnostic

The toggle affordance SHALL NOT introduce a background color, opaque overlay, or any visual treatment that depends on knowing the surrounding container background. The toggle SHALL blend with any parent surface (card, page, modal, hover state, dark mode) without configuration.

#### Scenario: Toggle on any surface

- **WHEN** the primitive is placed inside a container with an arbitrary background color (including but not limited to default paper, hovered card, selected row, dark-mode page)
- **THEN** the toggle SHALL be visually consistent with that background
- **AND** no opaque rectangle or gradient that assumes a specific parent color SHALL render

#### Scenario: Fade edge is background-agnostic

- **WHEN** the primitive is rendered with a fade edge applied to the collapsed state
- **THEN** the fade SHALL be implemented by fading the content's own opacity, not by overlaying a colored gradient
- **AND** the fade SHALL render correctly over any parent surface without the consumer configuring a background-color variable

### Requirement: Toggle placement and semantics

The toggle SHALL be rendered below the content as a dedicated row, not inline with an ellipsis. The toggle SHALL be keyboard-accessible and expose standard expand/collapse ARIA semantics.

#### Scenario: Toggle rendered as a separate row

- **WHEN** the primitive is in its collapsed-with-overflow state
- **THEN** the toggle SHALL occupy its own row below the clamped content
- **AND** the toggle SHALL NOT be composed inline with the trailing ellipsis of the clamped text

#### Scenario: Keyboard activation

- **WHEN** the toggle receives keyboard focus
- **AND** the user activates it via Enter or Space
- **THEN** the expanded/collapsed state SHALL flip identically to a pointer click

#### Scenario: ARIA attributes reflect state

- **WHEN** the primitive is rendered
- **THEN** the toggle element SHALL carry an `aria-expanded` attribute whose value reflects the current expanded state
- **AND** the toggle SHALL carry an `aria-controls` attribute referencing the id of the content region

### Requirement: Children-based API

The `<Collapsible>` primitive SHALL accept any `ReactNode` as children, including `Typography` elements, mixed text and inline nodes, and rendered markdown output. The primitive SHALL NOT require children to be a plain string.

#### Scenario: Rich content is supported

- **WHEN** a consumer renders `<Collapsible maxLines={4}>` wrapping multiple `<Typography>` blocks or markdown output
- **THEN** the primitive SHALL clamp the rendered visual output correctly without modifying the children
- **AND** the toggle SHALL still appear only when the rendered content overflows

### Requirement: Controlled and uncontrolled modes

The primitive SHALL support both an uncontrolled mode (managing its own expanded state) and a controlled mode (expanded state supplied by the consumer with a change callback).

#### Scenario: Uncontrolled mode

- **WHEN** the primitive is rendered without an `expanded` prop
- **THEN** its expanded state SHALL be managed internally, defaulting to collapsed
- **AND** activating the toggle SHALL flip the internal state

#### Scenario: Controlled mode

- **WHEN** the primitive is rendered with an `expanded` prop
- **THEN** the displayed state SHALL always reflect the `expanded` prop value
- **AND** activating the toggle SHALL invoke the `onExpandedChange` callback with the next desired value
- **AND** the primitive SHALL NOT update its own state in response to activation

### Requirement: Animated expand and collapse

The primitive SHALL animate the height transition between collapsed and expanded states without layout jank, and SHALL respect the user's reduced-motion preference.

#### Scenario: Smooth expansion

- **WHEN** the toggle is activated to expand
- **THEN** the content height SHALL transition smoothly from the clamped height to the full intrinsic height
- **AND** the transition SHALL NOT require the consumer to supply a fixed height value

#### Scenario: Reduced motion honored

- **WHEN** the user's environment indicates `prefers-reduced-motion: reduce`
- **THEN** the expand/collapse SHALL complete instantly without a height transition

### Requirement: Server-side rendering safety

The primitive SHALL render without hydration mismatch warnings in SSR scenarios and SHALL NOT flash a suddenly-appearing toggle on client hydration.

#### Scenario: SSR initial render

- **WHEN** the primitive is rendered on the server
- **THEN** the rendered output SHALL include the toggle element in the DOM
- **AND** the toggle SHALL be visible by default pending client-side measurement

#### Scenario: Client hydration without mismatch

- **WHEN** the client hydrates the SSR output and measures actual overflow
- **THEN** if the content does not overflow, the toggle SHALL be hidden via a style change only (not by adding or removing the element)
- **AND** no React hydration mismatch warning SHALL be emitted

### Requirement: Accessible full-text exposure

The full children SHALL always be present and readable to assistive technologies regardless of collapsed visual state.

#### Scenario: Screen reader reads full content when collapsed

- **WHEN** the primitive is in its collapsed state and a screen reader traverses the content region
- **THEN** the assistive tool SHALL announce the full children text, not only the clamped portion

### Requirement: Replacement of legacy primitive

The new primitive SHALL replace the existing `CollapsibleText` family of exports (`CollapsibleTextShow`, `CollapsibleTextContainer`) within `@rezics/ui`, and the legacy exports SHALL be removed in the same change.

#### Scenario: Legacy exports removed

- **WHEN** consuming code imports from `@rezics/ui`
- **THEN** the symbols `CollapsibleTextShow` and `CollapsibleTextContainer` SHALL NOT be exported
- **AND** the legacy source directory `package/ui/src/primitive/typography/collapsible-text/` SHALL be removed

#### Scenario: All call sites migrated

- **WHEN** the change is archived
- **THEN** no call site in `package/app` or `package/admin` SHALL reference the legacy symbols
- **AND** every previous usage SHALL be rendered with the new `<Collapsible>` primitive using an explicit `maxLines` value appropriate for its surface
