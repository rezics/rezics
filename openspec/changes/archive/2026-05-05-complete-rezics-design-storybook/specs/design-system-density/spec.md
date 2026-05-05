## ADDED Requirements

### Requirement: Density is per-component-type intrinsic, not a user-facing toggle

The rezics design system SHALL treat density as an **intrinsic property of each component type**, decided at design time. Density is **not** a runtime toggle the user (or developer) flips per surface.

The reasoning: a `Table` row is naturally dense (rows pack scannable data); a hero section is naturally spacious (it breathes); a `MenuItem` sits in between. These are design-time facts about the component's purpose, not user preferences. Same-component density variants (e.g. "compact-table vs spacious-table") are explicitly out of scope — they add cost (3 stories per primitive, per-app density-class plumbing, runtime cascade flips) without proportionate benefit.

The system SHALL NOT expose:

- A user-facing toggle (toolbar, settings panel, preference) that changes density across the app.
- Class-based density propagation on `<html>` (no `density-compact` / `density-spacious` classes).
- A `--density-step` system token, or `calc(<base> + var(--density-step))` component-tier expressions.
- Per-app density defaults written into app mount code.
- `WithDensity` stories for primitives.

If a future need for per-component runtime density variants emerges, it SHALL require an OpenSpec change updating this Requirement. The current scope is intentionally narrower than the MD3 4-step density model.

#### Scenario: No `--density-step` token is emitted

- **WHEN** `package/ui/src/config/uno-config.ts` is grepped for `--density-step`
- **THEN** zero matches SHALL be returned
- **AND** no preflight rule SHALL emit a `.density-compact` or `.density-spacious` selector

#### Scenario: No density toggle in Storybook

- **WHEN** the Storybook toolbar is inspected (in `package/storybook-config/src/preview.tsx`)
- **THEN** there SHALL be no `density` `globalType` entry
- **AND** no decorator SHALL toggle a `density-*` class on `<html>`

### Requirement: Density vocabulary is a closed set of fixed-value padding tokens

The component-tier `--padding-*` tokens SHALL be emitted by the preflight in `package/ui/src/config/uno-config.ts` as **fixed values** (not `calc()` expressions), one per density-bearing rezics-authored component type:

```css
:root, :host {
  --padding-table-row-y:    8px;
  --padding-list-item-y:    12px;
  --padding-toolbar-y:      8px;
  --padding-formfield-y:    8px;
  --padding-sidebar-item-y: 8px;
  --padding-tab-item-y:     8px;
  --padding-menu-item-y:    6px;
  --padding-breadcrumb-y:   4px;
  --padding-command-item-y: 8px;
}
```

These nine tokens are the closed **density vocabulary** for rezics-authored components. They encode the intrinsic density tier of each component type (`Table` row tight, `List` item relaxed, `Breadcrumb` tightest because it's a sibling-of-text affordance, etc.).

The vocabulary is for **rezics-authored** primitives and composites in `package/ui/src/primitive/` and `package/ui/src/composite/`. Vendored shadcn primitives (in `package/ui/src/shadcn/`) consume the values shadcn ships with — they SHALL NOT be patched to consume these tokens. (See `migrate-shadcn-to-base-ui-luma` for the rezics-tokens-vs-shadcn-tokens boundary.)

Adding a new entry to this vocabulary SHALL require:
1. A new `--padding-*` token emitted by the preflight at a fixed value chosen against the existing nine.
2. A consumer wiring the rezics-authored component to that token.

Modifying a token's value SHALL be done case-by-case, justified against the visual rhythm of neighbour components (e.g. tightening `--padding-menu-item-y` may require revisiting `--padding-command-item-y` since both render dropdown-style item rows).

#### Scenario: Padding tokens are fixed values

- **WHEN** any `--padding-*` value is read from `getComputedStyle(document.documentElement)`
- **THEN** it SHALL resolve to a single `<length>` (e.g. `"8px"`)
- **AND** it SHALL NOT contain `calc(...)` or reference any `var(--density-*)`

#### Scenario: Vocabulary is closed at nine entries

- **WHEN** the preflight in `package/ui/src/config/uno-config.ts` is inspected
- **THEN** exactly nine `--padding-*-y` tokens SHALL be emitted (one per row in the table above)
- **AND** adding a tenth SHALL require an OpenSpec change updating this Requirement

### Requirement: Density affects only spacing dimensions, never typography

Component-tier density tokens SHALL affect only padding, gap, min-height, row-height, item-height, icon-button-size, and similar spacing/sizing dimensions. They SHALL NOT affect:

- Font size (`font-size`).
- Line height (`line-height`).
- Letter spacing (`letter-spacing`).
- Font weight (`font-weight`).
- Any other typographic property.

Type carries information; varying it across the design vocabulary breaks reading habits. This rule mirrors both Apple HIG and MD3.

#### Scenario: Density tokens are spacing-named only

- **WHEN** `package/ui/src/config/uno-config.ts` is grepped for tokens emitted alongside the padding vocabulary
- **THEN** every density-bearing token SHALL be named `--padding-*`, `--gap-*`, `--min-height-*`, `--row-height-*`, or similar spacing concept
- **AND** SHALL NOT be named `--font-size-*`, `--line-height-*`, `--letter-spacing-*`, or `--font-weight-*`

### Requirement: Component opt-in / opt-out lists are explicit

Density-bearing components (the opt-in list — components that consume one of the nine `--padding-*` tokens) SHALL include at minimum: `Table` row, `List` item, `Toolbar`, FormField (the rezics input wrapper covering TextField, Select, Combobox), `Sidebar` item, `MenuItem`, `TabsList` item, `Breadcrumb` item, `CommandPalette` item.

Density-fixed components (the opt-out list — components that use ad-hoc spacing utilities not from the density vocabulary) SHALL include at minimum: hero sections, reading view, book covers, dialog content surfaces (the dialog frame opts in if it has chrome rows; the *content* doesn't), onboarding screens, marketing surfaces.

The classification reflects intrinsic density: opt-in components are repeating-row affordances where consistent vertical rhythm matters across primitives; opt-out components are bespoke compositions where ad-hoc spacing is the right tool.

#### Scenario: Opt-in component consumes a density vocabulary token

- **WHEN** any rezics-authored density-bearing component's source is inspected
- **THEN** at least one spacing dimension SHALL resolve via `var(--padding-<component>-y)` to one of the nine fixed-value tokens

#### Scenario: Density-fixed component uses ad-hoc spacing

- **WHEN** a hero section, reading-view container, or book-cover frame's source is inspected
- **THEN** its spacing SHALL be expressed via fixed UnoCSS spacing utilities (`p-8`, `gap-12`, etc.) or component-specific local values
- **AND** SHALL NOT consume any `--padding-*-y` from the density vocabulary
