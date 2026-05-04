## ADDED Requirements

### Requirement: System tier exposes a state-layer opacity ladder

The rezics system tier SHALL expose four state-layer opacity tokens implementing the MD3 8/12/12/16 ladder:

- `--rezics-sys-state-hover-opacity: 0.08`
- `--rezics-sys-state-focus-opacity: 0.12`
- `--rezics-sys-state-pressed-opacity: 0.12`
- `--rezics-sys-state-dragged-opacity: 0.16`

The state-layer overlay color SHALL be the `on-*` role of the underlying surface (e.g. `--rezics-sys-color-on-surface` over a `surface` container), so contrast holds in both light and dark modes without per-state color decisions.

The overlay SHALL be applied as a quiet rectangular tint matching the rezics borderless aesthetic. The MD3 full-bleed circular ripple SHALL NOT be adopted as the visual treatment.

#### Scenario: State-layer tokens are present in light and dark modes

- **WHEN** `tokens.css` is inspected
- **THEN** all four `--rezics-sys-state-*-opacity` tokens SHALL be defined under `.theme-rezics`
- **AND** the values SHALL be 0.08, 0.12, 0.12, 0.16 respectively

#### Scenario: UnoCSS exposes state-layer shortcuts

- **WHEN** `package/ui/src/config/uno-config.ts` is inspected
- **THEN** the `shortcuts` object SHALL include `state-hover`, `state-focus`, `state-pressed` entries
- **AND** each SHALL emit an overlay using the state-layer opacity tokens

### Requirement: System tier exposes the MD3 motion duration and easing ladder

The rezics system tier SHALL expose 16 duration tokens (`--rezics-sys-motion-duration-{short1,short2,short3,short4,medium1,medium2,medium3,medium4,long1,long2,long3,long4,extra-long1,extra-long2,extra-long3,extra-long4}`) with values 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 700, 800, 900, 1000 milliseconds respectively.

It SHALL also expose 7 easing tokens (`--rezics-sys-motion-easing-{linear,standard,standard-decelerate,standard-accelerate,emphasized,emphasized-decelerate,emphasized-accelerate}`) with cubic-bezier values matching the MD3 specification.

A rezics-specific `--rezics-sys-motion-easing-spring` token SHALL also be exposed with a tactile-overshoot curve (`cubic-bezier(0.34, 1.56, 0.64, 1)`) for use cases where Apple-style spring feedback is preferred.

The legacy rezics motion names (`--rezics-motion-fast/base/slow/page` and `--rezics-ease-out/in-out/spring`) SHALL be retained as aliases pointing into the MD3 ladder per the mapping in the change's design document.

#### Scenario: Duration ladder is present and ordered

- **WHEN** `tokens.css` is inspected
- **THEN** all 16 `--rezics-sys-motion-duration-*` tokens SHALL be defined
- **AND** their numeric values SHALL be monotonically increasing across the `short1 → extra-long4` sequence

#### Scenario: Rezics motion aliases point into the ladder

- **WHEN** `--rezics-motion-fast`, `--rezics-motion-base`, `--rezics-motion-slow`, `--rezics-motion-page` are inspected
- **THEN** each SHALL be a `var(--rezics-sys-motion-duration-…)` reference
- **AND** SHALL NOT hold a literal `ms` value

### Requirement: System tier exposes the surface-container ladder and container color variants

The rezics system tier SHALL expose a five-step surface-container ladder: `surface-container-lowest`, `surface-container-low`, `surface-container`, `surface-container-high`, `surface-container-highest`. Each step SHALL be a curated rezics parchment-tint shift, not a shadow. Higher containers SHALL be perceptually closer to the viewer; in light mode this typically means slightly lighter, in dark mode slightly tinted toward the brand.

The system tier SHALL also expose container variants for the brand and semantic-state color families: `primary-container` / `on-primary-container`, `error-container` / `on-error-container`, `success-container` / `on-success-container`, `warning-container` / `on-warning-container`, `info-container` / `on-info-container`. Container variants are the quieter, container-shaped role used by chips, badges, quiet buttons, tonal banners, and similar surfaces.

The system tier SHALL also expose inverse roles: `inverse-surface`, `inverse-on-surface`, `inverse-primary`. These are used by snackbars, dark-on-light pull-quotes, and any UI element that needs to break the prevailing surface contrast for emphasis.

#### Scenario: Surface-container ladder resolves in both modes

- **WHEN** `tokens.css` is inspected in light and dark `[data-theme]` blocks
- **THEN** all five `--rezics-sys-color-surface-container-*` tokens SHALL resolve to distinct values
- **AND** the perceptual lightness SHALL change monotonically across the `lowest → highest` sequence

#### Scenario: Container variants pair with their on-* counterpart

- **WHEN** any `*-container` token is defined (e.g. `primary-container`)
- **THEN** the matching `on-*-container` token (e.g. `on-primary-container`) SHALL also be defined
- **AND** the pair SHALL clear the contrast invariant (≥4.5:1 for text, ≥3:1 for non-text UI)

#### Scenario: Inverse-surface contrast is high

- **WHEN** the `inverse-surface` ↔ `inverse-on-surface` pair is checked
- **THEN** in light mode, `inverse-surface` SHALL be a near-black tone with `inverse-on-surface` near-white (≥7:1 contrast)
- **AND** in dark mode, the pair SHALL invert (≥7:1 in the opposite direction)

### Requirement: System tier exposes the chart palette and sidebar chrome roles

The rezics system tier SHALL expose:

- `--rezics-sys-color-chart-1` through `--rezics-sys-color-chart-5` — a curated 5-step palette for data visualization, distinct from the brand and semantic-state palettes, color-blind-tolerant in either mode.
- `--rezics-sys-color-sidebar-{background, foreground, primary, primary-foreground, accent, accent-foreground, border, ring}` — sidebar chrome roles used by long-running navigation surfaces (admin sidebar, app shell drawer).

The shadcn `--chart-1..5` and `--sidebar*` slots SHALL alias to these system-tier values via `var()`.

#### Scenario: Chart slots are not literal values

- **WHEN** `tokens.css` is inspected
- **THEN** `--chart-1` through `--chart-5` SHALL each resolve to `var(--rezics-sys-color-chart-…)`
- **AND** SHALL NOT hold literal OKLCH or hex values

#### Scenario: Sidebar slots are aliased to rezics roles

- **WHEN** any `--sidebar*` slot is inspected
- **THEN** it SHALL resolve to a `var(--rezics-sys-color-sidebar-…)` reference

### Requirement: Token contrast invariant is enforced by a script

A script at `tool/scripts/check-tokens.ts` SHALL assert that the rezics token table satisfies the WCAG contrast invariant in both light and dark modes:

- Every `surface*` ↔ `on-surface*` text pair SHALL clear 4.5:1.
- Every `*-container` ↔ `on-*-container` pair SHALL clear 4.5:1 (text) or 3:1 (non-text UI).
- Every `primary` / `secondary` / `tertiary` / `error` / `success` / `warning` / `info` ↔ corresponding `on-*` pair SHALL clear 4.5:1.
- Every `outline` / `outline-variant` SHALL clear 3:1 against its target surface.

The script SHALL be invokable via `bun run check:tokens` and SHALL exit with status 1 when any pair fails. The script SHALL run as part of the PR merge gate.

#### Scenario: Designer breaks contrast invariant

- **WHEN** a designer changes a system-tier token to a value that no longer clears the contrast invariant for any pair
- **THEN** `bun run check:tokens` SHALL exit with status 1
- **AND** the failing pair, the achieved contrast, the required contrast, and the mode (light or dark) SHALL be reported

#### Scenario: Clean contrast passes

- **WHEN** all pairs satisfy their invariant
- **THEN** `bun run check:tokens` SHALL exit with status 0 and print a one-line "all pairs pass" summary
