## ADDED Requirements

### Requirement: Density is a three-mode user-facing system

The rezics design system SHALL expose density as a three-mode user-facing system: `compact`, `comfortable`, and `spacious`. The default mode SHALL be `comfortable`.

The three modes SHALL map to perceptual intent:

- **compact** — admin tables, editor toolbars, dense data lists, debug overlays, command-palette item rows. Tight spacing, intended for keyboard-driven pro use.
- **comfortable** — the default for application content. Cards, navigation, forms, dialogs, list items in the consumer-facing app. Balanced spacing, intended for both touch and pointer.
- **spacious** — hero sections, reading view, onboarding flows, marketing surfaces. Open spacing, intended for leisurely consumption.

The system SHALL NOT expose more than three modes. The MD3 four-step density model (default, -1, -2, -3) is the underlying engineering reference; rezics maps it to three labeled modes for clarity. Adding a fourth mode SHALL require an OpenSpec change updating this Requirement.

#### Scenario: The three modes are the only valid values

- **WHEN** the `data-density` attribute is read from the `<html>` element
- **THEN** its value SHALL be one of `compact`, `comfortable`, or `spacious`
- **AND** any other value (or absence of the attribute) SHALL be treated as `comfortable`

### Requirement: Density propagates via `data-density` on the `.theme-rezics` scope

The active density mode SHALL be encoded as a `data-density` attribute on the same element that carries the `.theme-rezics` class (typically `<html>`). The system-tier token `--rezics-sys-density-step` SHALL be defined per mode:

```css
.theme-rezics[data-density="compact"]     { --rezics-sys-density-step: -4px; }
.theme-rezics                              ,
.theme-rezics[data-density="comfortable"] { --rezics-sys-density-step:  0px; }
.theme-rezics[data-density="spacious"]    { --rezics-sys-density-step: +6px; }
```

Component-tier tokens that opt into density SHALL be `calc(<base> + var(--rezics-sys-density-step))` expressions.

The `.theme-rezics` class SHALL be on `<html>` (per `ui-component-foundation/spec.md`); density therefore propagates automatically into Radix-based portals (Dialog, Tooltip, Dropdown, Toast).

#### Scenario: Density token resolves per mode

- **WHEN** `<html data-density="compact">` is set
- **THEN** `getComputedStyle(document.documentElement).getPropertyValue('--rezics-sys-density-step')` SHALL return `"-4px"` (or equivalent resolved value)

#### Scenario: Modal portal inherits density

- **WHEN** a Radix Dialog is rendered with `<html data-density="spacious">` set
- **THEN** the dialog's portal subtree SHALL resolve `var(--rezics-sys-density-step)` to `+6px`
- **AND** any density-aware composite rendered inside the dialog SHALL use the spacious spacing

### Requirement: Density affects only spacing dimensions, never typography

Density SHALL affect only padding, gap, min-height, row-height, item-height, icon-button-size, and similar spacing/sizing dimensions. Density SHALL NOT affect:

- Font size (`font-size`).
- Line height (`line-height`).
- Letter spacing (`letter-spacing`).
- Font weight (`font-weight`).
- Any other typographic property.

The "density never affects type" rule mirrors both Apple HIG and MD3 — type carries information, and density that re-flows type breaks reading habits.

#### Scenario: Typography is density-invariant

- **WHEN** the density global toolbar switches between any two modes
- **THEN** the rendered font-size, line-height, letter-spacing, and font-weight of any text element SHALL be identical at both modes
- **AND** only padding / gap / min-height / similar spacing SHALL change

#### Scenario: Density token's only callers are spacing-related

- **WHEN** `package/ui/src/config/tokens.css` is grepped for `var(--rezics-sys-density-step)`
- **THEN** every match SHALL be inside a `padding`, `margin`, `gap`, `min-height`, `min-width`, `height`, `width`, `top`, `bottom`, `left`, `right`, `inset`, `block-size`, `inline-size`, `row-gap`, or `column-gap` declaration
- **AND** SHALL NOT appear inside a `font-size`, `line-height`, `letter-spacing`, or `font-weight` declaration

### Requirement: Component opt-in / opt-out lists are explicit

Density-aware components (the opt-in list) SHALL include at minimum: `Table` row, `List` item, `Toolbar`, `FormControl` (the rezics input wrapper covering TextField, Select, Combobox), `Sidebar` item, `Editor` toolbar, `MenuItem`, `TabsList` item, `Breadcrumb` item, `CommandPalette` item.

Density-fixed components (the opt-out list) SHALL include at minimum: hero sections, reading view, book covers, dialog content surfaces (the dialog frame opts in; the *content* doesn't), onboarding screens, marketing surfaces.

The component-tier tokens for opt-in components SHALL be defined in `package/ui/src/config/tokens.css` under the component-tier section. Each opt-in component SHALL consume the corresponding component-tier token via UnoCSS theme classes or direct CSS variable references.

Adding a new density-aware component SHALL require:
1. A component-tier token in `tokens.css`.
2. A consumer wiring the component to the token.
3. A `WithDensity` story added to the component's story file (per `design-system-storybook/spec.md`).

#### Scenario: Opt-in component consumes a density token

- **WHEN** any density-aware component's source CSS is inspected
- **THEN** at least one spacing dimension SHALL resolve via `var(--rezics-comp-<component>-…)` to a `calc()` expression involving `var(--rezics-sys-density-step)`

#### Scenario: Density-fixed component does not vary

- **WHEN** the density toolbar switches between any two modes
- **THEN** rendered hero sections, reading-view containers, book-cover frames, and onboarding screens SHALL render at identical dimensions

#### Scenario: Adding a new density-aware component is governed

- **WHEN** a contributor wires a component to consume `var(--rezics-sys-density-step)` directly (skipping the component-tier indirection)
- **THEN** code review SHALL block the merge
- **AND** the contributor SHALL be redirected to add a component-tier token first

### Requirement: Density default per app reflects the app's surface

The `<html data-density="…">` default per app SHALL reflect the app's primary use case:

- `@rezics/admin` SHALL default to `compact` (admin tables and forms are dense by intent).
- `@rezics/app` SHALL default to `comfortable` (consumer-facing app at the platform default).
- `@rezics/folio` and `@rezics/editor` SHALL default to `comfortable` (mixed reading and editing contexts).

The user MAY override the default via a preference setting (out of scope for this spec; if introduced, it writes the chosen value to the same `<html data-density>` attribute).

#### Scenario: Admin defaults to compact

- **WHEN** `@rezics/admin` mounts
- **THEN** the `<html>` element SHALL have `data-density="compact"`

#### Scenario: App defaults to comfortable

- **WHEN** `@rezics/app` mounts
- **THEN** the `<html>` element SHALL have `data-density="comfortable"` (or no `data-density` attribute, which is treated as comfortable per the prior Requirement)
