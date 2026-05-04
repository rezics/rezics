## ADDED Requirements

### Requirement: Density is a three-mode user-facing system

The rezics design system SHALL expose density as a three-mode user-facing system: `compact`, `comfortable`, and `spacious`. The default mode SHALL be `comfortable`.

The three modes SHALL map to perceptual intent:

- **compact** — admin tables, editor toolbars, dense data lists, debug overlays, command-palette item rows. Tight spacing, intended for keyboard-driven pro use.
- **comfortable** — the default for application content. Cards, navigation, forms, dialogs, list items in the consumer-facing app. Balanced spacing, intended for both touch and pointer.
- **spacious** — hero sections, reading view, onboarding flows, marketing surfaces. Open spacing, intended for leisurely consumption.

The system SHALL NOT expose more than three modes. The MD3 four-step density model (default, -1, -2, -3) is the underlying engineering reference; rezics maps it to three labeled modes for clarity. Adding a fourth mode SHALL require an OpenSpec change updating this Requirement.

#### Scenario: The three modes are the only valid values

- **WHEN** the active density is read from the `<html>` element's class list
- **THEN** the encoding SHALL be exactly one of: no density class (= `comfortable`), `density-compact`, or `density-spacious`
- **AND** any other class encoding (or simultaneous presence of both `density-compact` and `density-spacious`) SHALL be treated as `comfortable`

### Requirement: Density propagates via class on `<html>`, emitted by the existing preflight

The active density mode SHALL be encoded as a class on the `<html>` element:

- `comfortable` — no class (default).
- `compact` — `<html class="density-compact">`.
- `spacious` — `<html class="density-spacious">`.

The system-tier token `--density-step` SHALL be emitted by the preflight in `package/ui/src/config/uno-config.ts`:

```css
:root, :host  { --density-step: 0px; }   /* comfortable default */
.density-compact  { --density-step: -2px; }
.density-spacious { --density-step:  2px; }
```

Component-tier tokens that opt into density SHALL be `calc(<base> + var(--density-step))` expressions, also emitted by the same preflight.

The class-on-`<html>` placement coexists with the existing theme switch (`.dark`); the two are independent. Density propagates automatically into Radix-based portals (Dialog, Tooltip, Dropdown, Toast, Sonner) because portals inherit the `<html>` cascade.

The legacy `--rezics-*` namespace, attribute-based `data-density` switching, and any resurrection of `package/ui/src/config/tokens.css` are FORBIDDEN by R9 of `convention-enforcement` and SHALL NOT be introduced by any density-related implementation.

#### Scenario: Density token resolves per mode

- **WHEN** `<html class="density-compact">` is set
- **THEN** `getComputedStyle(document.documentElement).getPropertyValue('--density-step')` SHALL return `"-2px"` (or equivalent resolved value)

#### Scenario: Modal portal inherits density

- **WHEN** a Radix Dialog is rendered with `<html class="density-spacious">` set
- **THEN** the dialog's portal subtree SHALL resolve `var(--density-step)` to `2px`
- **AND** any density-aware composite rendered inside the dialog SHALL use the spacious spacing

#### Scenario: Density and theme classes coexist

- **WHEN** `<html class="dark density-compact">` is set
- **THEN** dark-mode color tokens SHALL resolve from the `.dark { --colors-* }` overrides
- **AND** density-aware spacing SHALL resolve from `--density-step: -2px`

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

- **WHEN** `package/ui/src/config/uno-config.ts` is grepped for `var(--density-step)`
- **THEN** every match SHALL appear inside a `calc(...)` whose product is assigned to a `--padding-*`, `--gap-*`, `--min-height-*`, or other spacing-named token
- **AND** SHALL NOT appear inside a `--font-size-*`, `--line-height-*`, `--letter-spacing-*`, or `--font-weight-*` declaration

### Requirement: Component opt-in / opt-out lists are explicit

Density-aware components (the opt-in list) SHALL include at minimum: `Table` row, `List` item, `Toolbar`, FormField (the rezics input wrapper covering TextField, Select, Combobox), `Sidebar` item, `MenuItem`, `TabsList` item, `Breadcrumb` item, `CommandPalette` item.

Density-fixed components (the opt-out list) SHALL include at minimum: hero sections, reading view, book covers, dialog content surfaces (the dialog frame opts in; the *content* doesn't), onboarding screens, marketing surfaces.

The component-tier `--padding-*` tokens for opt-in components SHALL be emitted by the preflight in `package/ui/src/config/uno-config.ts` and SHALL be consumed by their target components via UnoCSS theme classes or direct CSS variable references.

Adding a new density-aware component SHALL require:
1. A component-tier `--padding-*` token emitted by the preflight.
2. A consumer wiring the component to that token.
3. A `WithDensity` story added to the component's story file (per `design-system-storybook/spec.md`).

#### Scenario: Opt-in component consumes a density token

- **WHEN** any density-aware component's source is inspected
- **THEN** at least one spacing dimension SHALL resolve via `var(--padding-<component>-...)` to a `calc()` expression involving `var(--density-step)`

#### Scenario: Density-fixed component does not vary

- **WHEN** the density toolbar switches between any two modes
- **THEN** rendered hero sections, reading-view containers, book-cover frames, and onboarding screens SHALL render at identical dimensions

#### Scenario: Adding a new density-aware component is governed

- **WHEN** a contributor wires a component to consume `var(--density-step)` directly (skipping the component-tier indirection)
- **THEN** code review SHALL block the merge
- **AND** the contributor SHALL be redirected to add a component-tier `--padding-*` token first

### Requirement: Density default per app reflects the app's surface

The density class on `<html>` per app SHALL reflect the app's primary use case:

- `@rezics/admin` SHALL set `<html class="density-compact">` on mount (admin tables and forms are dense by intent).
- `@rezics/app` SHALL leave `<html>` without a density class (consumer-facing app at the platform default = comfortable).
- `@rezics/folio` and `@rezics/editor` SHALL leave `<html>` without a density class (mixed reading and editing contexts default to comfortable).

The user MAY override the default via a preference setting (out of scope for this spec; if introduced, it adds or removes the corresponding `density-*` class on `<html>`).

#### Scenario: Admin defaults to compact

- **WHEN** `@rezics/admin` mounts
- **THEN** the `<html>` element SHALL have `class="density-compact"` (or the class SHALL be present alongside other classes such as `dark`)

#### Scenario: App defaults to comfortable

- **WHEN** `@rezics/app` mounts
- **THEN** the `<html>` element SHALL NOT carry a `density-compact` or `density-spacious` class
- **AND** `getComputedStyle(document.documentElement).getPropertyValue('--density-step')` SHALL return `"0px"`
