## ADDED Requirements

### Requirement: Token vocabulary is organized in three tiers

The rezics token system SHALL be organized into three tiers, each with a distinct prefix:

1. **Reference tier** (`--rezics-ref-*`) — raw palette, type ramp, spacing scale, radius scale, shadow recipes, ease curves. Mode-invariant. Authored once, referenced by the system tier.
2. **System tier** (`--rezics-sys-*`) — semantic roles (surface, on-surface, primary, on-primary, primary-container, error, error-container, surface-container-low/high, inverse-surface, motion durations, easings, state-layer opacities, etc.). Light/dark resolved at this tier by remapping system tokens to different reference values.
3. **Component tier** (`--rezics-comp-*`) — only authored where a component's mapping is non-obvious or where a structural variant deserves an explicit name.

A consumer SHALL choose the lowest tier sufficient for the role it needs. Application code (UnoCSS classes, primitives) SHALL prefer system-tier tokens. Reference-tier tokens SHALL NOT be referenced from application code; their consumers are the system-tier definitions.

#### Scenario: System token references a reference token, not a literal value

- **WHEN** the `--rezics-sys-color-on-surface` system token is defined in `package/ui/src/config/tokens.css`
- **THEN** its value SHALL be a `var(--rezics-ref-color-…)` reference, not a literal hex / OKLCH / RGB value
- **AND** the literal value SHALL appear only in the reference-tier block

#### Scenario: Component token references a system token, not a reference token

- **WHEN** any `--rezics-comp-*` token is defined
- **THEN** its value SHALL be a `var(--rezics-sys-…)` reference
- **AND** it SHALL NOT skip the system tier and reference `--rezics-ref-*` directly

#### Scenario: Application code reaches for the system tier

- **WHEN** a UnoCSS theme class or a custom primitive resolves a color, motion duration, or easing
- **THEN** the resolution SHALL terminate at a `--rezics-sys-*` token (or a `--rezics-comp-*` alias of one)
- **AND** SHALL NOT terminate at a `--rezics-ref-*` token

### Requirement: Tokens are scoped under `.theme-rezics` on `<html>`

The full token table — reference, system, component, and shadcn-superset slots — SHALL be authored under a single `.theme-rezics { … }` selector. Dark mode SHALL be authored as a sibling block: `.theme-rezics[data-theme="dark"] { … }`.

The `.theme-rezics` class SHALL be applied to `<html>` in every app shell and Storybook preview that consumes the design system. Subtree-only application is forbidden, because Radix-based shadcn primitives render portals into `document.body` and require the cascade to reach the portal subtree.

#### Scenario: Tokens are not authored at `:root`

- **WHEN** `package/ui/src/config/tokens.css` is inspected
- **THEN** there SHALL be no `:root { … }` selector authoring rezics tokens
- **AND** the entire token table SHALL be under `.theme-rezics` (or its `[data-theme="dark"]` variant)

#### Scenario: `.theme-rezics` is on `<html>`, not `<body>` or subtree

- **WHEN** any application shell or Storybook preview mounts
- **THEN** the `<html>` element SHALL carry the `theme-rezics` class
- **AND** the `data-theme` attribute SHALL be authored on the same `<html>` element

#### Scenario: Modal/tooltip/dropdown portal inherits tokens

- **WHEN** a Radix Dialog, Tooltip, or Dropdown renders a portal into `document.body`
- **THEN** the portal subtree SHALL resolve `var(--rezics-sys-color-*)` to the same values as the in-tree app
- **AND** opening any modal in light mode SHALL render with the rezics-light palette; switching `[data-theme="dark"]` SHALL update the modal's resolved values without remount

### Requirement: Token files live under `config/`, not `shared/styles/`

The canonical token table SHALL live at `package/ui/src/config/tokens.css`. The baseline globals (`:lang()` font routing, `prefers-reduced-motion`, legacy resets) SHALL live at `package/ui/src/config/base.css`. The previous file `package/ui/src/shared/styles/layers.css` SHALL be deleted; consumers SHALL import the two new files directly.

`package/ui/components.json` `tailwind.css` field SHALL point to `src/config/tokens.css`. UnoCSS theme classes (defined in `package/ui/src/config/uno-config.ts`) and the shadcn primitive layer SHALL read tokens from this single canonical file.

#### Scenario: layers.css is deleted

- **WHEN** the change `complete-rezics-token-system` is fully landed
- **THEN** `package/ui/src/shared/styles/layers.css` SHALL NOT exist
- **AND** `rg "shared/styles/layers.css" package/` SHALL return zero matches

#### Scenario: components.json points to tokens.css

- **WHEN** `package/ui/components.json` is inspected
- **THEN** the `tailwind.css` field SHALL be `src/config/tokens.css`

#### Scenario: Storybook preview does not import baseline

- **WHEN** any package's `.storybook/preview.tsx` is inspected
- **THEN** it SHALL import `@rezics/ui/config/tokens.css`
- **AND** it SHALL NOT import `@rezics/ui/config/base.css` (Storybook supplies its own preview-level resets)

### Requirement: rezics is a strict superset of the shadcn slot vocabulary

The rezics system tier SHALL contain a semantic role for every slot in the shadcn-ui standard token table. The shadcn slots SHALL be authored as flat unprefixed CSS variables under `.theme-rezics` and SHALL each resolve to a `--rezics-sys-color-*` value via `var()` chain.

When a future shadcn primitive added to `package/ui/src/shadcn/` references a new slot not currently bound, the rezics system tier SHALL be extended *first* with a corresponding role, then the shadcn slot SHALL be wired to it. The reverse order — adding a shadcn slot bound to a literal value or to a non-existent rezics role — is forbidden.

The minimum required role list (system tier) SHALL include, at minimum: `background`, `on-background`, `surface`, `on-surface`, `surface-variant`, `on-surface-variant`, `surface-container-lowest`, `surface-container-low`, `surface-container`, `surface-container-high`, `surface-container-highest`, `surface-tint`, `primary`, `on-primary`, `primary-container`, `on-primary-container`, `secondary`, `on-secondary`, `secondary-container`, `on-secondary-container`, `tertiary`, `on-tertiary`, `tertiary-container`, `on-tertiary-container`, `error`, `on-error`, `error-container`, `on-error-container`, `success`, `on-success`, `warning`, `on-warning`, `info`, `on-info`, `outline`, `outline-variant`, `inverse-surface`, `inverse-on-surface`, `inverse-primary`, `ring`, plus the chart palette (`chart-1..5`) and sidebar chrome family.

#### Scenario: Shadcn slot resolves to a system token

- **WHEN** any shadcn slot (`--card`, `--primary`, `--background`, `--ring`, `--radius`, `--chart-*`, `--sidebar*`, etc.) is inspected in `tokens.css`
- **THEN** its value SHALL be a `var(--rezics-sys-…)` reference (or a `var(--rezics-ref-…)` for `--radius`)
- **AND** SHALL NOT be a literal hex, OKLCH, RGB, or `rem` value

#### Scenario: Adding a new shadcn primitive cannot bypass the system tier

- **WHEN** a new shadcn primitive added to `package/ui/src/shadcn/` references a slot that does not yet exist in `tokens.css`
- **THEN** code review SHALL block the merge
- **AND** the contributor SHALL be redirected to extend the rezics system tier first

#### Scenario: `--radius` aliases the rezics radius scale

- **WHEN** the shadcn `--radius` slot is defined
- **THEN** it SHALL resolve to `var(--rezics-ref-radius-md)` (or another rezics-radius scale entry by explicit choice)
- **AND** it SHALL NOT hold a literal `rem` or `px` value

### Requirement: Legacy generation token names remain as deprecated aliases

The 11 legacy color names — `--rezics-color-fg`, `--rezics-color-fg-muted`, `--rezics-color-bg`, `--rezics-color-bg-muted`, `--rezics-color-bg-canvas`, `--rezics-color-bg-elevated`, `--rezics-color-bg-hover`, `--rezics-color-bg-selected`, `--rezics-color-primary`, `--rezics-color-secondary`, `--rezics-color-accent` — SHALL be retained in `tokens.css` as live aliases, each resolving to its successor system-tier role via `var()` and each annotated with a `@deprecated` comment naming the successor and the migration's target proposal.

These aliases SHALL be deleted in a follow-up change after `migrate-to-theme-config-classes` (proposal 2) drives consumer references to zero.

#### Scenario: Legacy alias is annotated and live

- **WHEN** `tokens.css` is inspected
- **THEN** each legacy name SHALL appear with a `/* @deprecated — use --rezics-sys-color-… instead. Removed after migrate-to-theme-config-classes lands. */` comment
- **AND** its CSS value SHALL be a `var(--rezics-sys-color-…)` reference

#### Scenario: Premature deletion is rejected

- **WHEN** a pull request prior to the completion of `migrate-to-theme-config-classes` removes any of the 11 legacy aliases from `tokens.css`
- **THEN** code review SHALL block the merge
- **AND** the contributor SHALL be redirected to land `migrate-to-theme-config-classes` first
