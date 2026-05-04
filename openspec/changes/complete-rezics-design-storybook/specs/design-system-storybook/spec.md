## ADDED Requirements

### Requirement: Foundation tokens documentation has seven MDX galleries

The `@rezics/ui` Storybook SHALL provide seven MDX token galleries under the `Foundation/Tokens` doc tree: **Colors, Typography, Spacing, Radius, Elevation, Motion, Iconography**. Each gallery SHALL render the live tokens as visual swatches / samples (not just text references) and SHALL conclude with a "Reference" callout naming the Apple HIG and / or Material Design 3 source and the rezics-specific divergence in one paragraph.

The seventh gallery — Iconography — SHALL document the `lucide-react` default icon library, the `@tabler/icons-react` named-fallback rule, the canonical mapping table from former MUI icon names to lucide names, and the rezics standard icon sizes (16 / 20 / 24 px).

The Colors gallery SHALL display computed contrast ratios against the closest `on-*` foreground role for each surface swatch, with a pass/fail badge per the proposal-1 contrast invariant.

#### Scenario: Seven Foundation galleries register

- **WHEN** `bun -F @rezics/ui run build-storybook` is run
- **THEN** the resulting `storybook-static/index.json` SHALL contain doc entries titled `Foundation/Tokens/Colors`, `Foundation/Tokens/Typography`, `Foundation/Tokens/Spacing`, `Foundation/Tokens/Radius`, `Foundation/Tokens/Elevation`, `Foundation/Tokens/Motion`, and `Foundation/Tokens/Iconography`

#### Scenario: Each gallery cites its research source

- **WHEN** any of the seven Foundation/Tokens MDX files is parsed
- **THEN** it SHALL include a "Reference" callout (rendered as a styled MDX block) naming the Apple HIG and/or MD3 source page
- **AND** SHALL state the rezics-specific divergence in one paragraph

#### Scenario: Colors gallery shows contrast badges

- **WHEN** the `Foundation/Tokens/Colors` page renders any surface swatch
- **THEN** the swatch SHALL display its computed contrast ratio against the closest `on-*` role
- **AND** SHALL display a pass/fail badge (≥4.5:1 for text pairs, ≥3:1 for non-text UI pairs)

### Requirement: Patterns documentation has six MDX pages

The `@rezics/ui` Storybook SHALL provide six MDX patterns pages under the `Foundation/Patterns` doc tree:

1. **Parchment Voice** — the rezics philosophy: borderless cards, parchment canvas, brand-fill is fill-only, depth-via-color-not-shadow, ellipsis-for-dialogs writing. Includes do/don't pairs and a rejection sample for "glossy glass dashboard."
2. **Density** — live three-mode demo (compact / comfortable / spacious) with a representative composite. Documents the opt-in / opt-out component lists. States the "density never affects type" rule.
3. **State Layer** — live demo of the 8/12/12/16 opacity ladder applied as quiet rectangular tints. Includes a rejection sample for MD3 full-bleed circular ripple.
4. **Depth Without Shadow** — live demo of the surface-container ladder. Includes a rejection sample for the MD3 dp shadow ladder. Documents that shadow is reserved for modals.
5. **Inverse Surface** — snackbar and pull-quote demos. Documents when and when not to use inverse-surface.
6. **Layout & Breakpoints** — visual ruler of all rezics breakpoints, container widths, and the rationale for `xsm:450px` and `8xl:1440px` as rezics-specific additions.

Each Patterns page SHALL include at least one live demo (not a screenshot) and SHALL pair every "we do" example with a "we don't do this" rejection sample where the contrast is instructive.

#### Scenario: Six Patterns pages register

- **WHEN** `bun -F @rezics/ui run build-storybook` is run
- **THEN** the resulting `storybook-static/index.json` SHALL contain doc entries titled `Foundation/Patterns/Parchment Voice`, `Foundation/Patterns/Density`, `Foundation/Patterns/State Layer`, `Foundation/Patterns/Depth Without Shadow`, `Foundation/Patterns/Inverse Surface`, and `Foundation/Patterns/Layout and Breakpoints`

#### Scenario: Each Patterns page has live demos and rejection samples

- **WHEN** any of the six `Foundation/Patterns/*` MDX files is parsed
- **THEN** it SHALL include at least one live `<Story>`, `<Canvas>`, or `<*Demo>` element from the `_gallery.tsx` helper
- **AND** SHALL include at least one "we don't do this" rejection sample where the contrast against MD3 / shadcn-default / Tailwind-default is instructive

### Requirement: Density global toolbar wires `[data-density]` on `<html>`

`package/storybook-config/src/preview.tsx` SHALL provide a global Density toolbar (Compact / Comfortable / Spacious) using Storybook's `globalTypes` mechanism. Switching the toolbar entry SHALL update the `data-density` attribute on the `<html>` element of the preview frame.

The Density toolbar SHALL be independent of the Light/Dark theme toggle — switching one SHALL NOT reset the other. The default density SHALL be `comfortable`. The default theme SHALL be `light`. Both globals SHALL persist across story navigation within a session.

The Density toolbar SHALL appear in every package's Storybook (the shared config provides it; per-package previews inherit). Stories for components that do not opt into density SHALL still render at every density level (they will look identical at all three).

#### Scenario: Global density toolbar present in every package's Storybook

- **WHEN** any package's Storybook (`@rezics/ui`, `@rezics/admin`, `@rezics/app`, `@rezics/folio`, `@rezics/editor`) is opened
- **THEN** a Density toolbar SHALL appear in the global toolbar with three options: Compact, Comfortable, Spacious
- **AND** switching the option SHALL update `[data-density]` on `<html>` without remount

#### Scenario: Density and theme are independent

- **WHEN** the user toggles the theme toolbar from Light to Dark
- **THEN** the density global SHALL retain its prior value (e.g. if it was Spacious, it stays Spacious)
- **AND** the same independence holds when toggling density first and theme second

### Requirement: Every shadcn primitive in `@rezics/ui` has a story file

Every primitive file under `package/ui/src/shadcn/` SHALL have a co-located `*.stories.tsx` file. Each story file SHALL cover, at minimum:

- A `Default` story (the most-common rendering).
- One story per documented user-facing variant.
- A `Disabled` story (where the primitive supports a disabled state).
- A `Loading` story (where applicable).
- An `InsideCard`, `InsideDialog`, or `InsideSidebar` embedded scenario for primitives where the surrounding surface affects the visual read.
- A `WithDensity` story for primitives in the density opt-in list, rendering compact / comfortable / spacious side-by-side.

The story files SHALL be co-located with the primitive source (`package/ui/src/shadcn/<primitive>/<Primitive>.stories.tsx`).

#### Scenario: Each shadcn primitive ships at least the Default story

- **WHEN** every `.tsx` file under `package/ui/src/shadcn/` (excluding test, story, and fixture files) is enumerated
- **THEN** each SHALL have a sibling `*.stories.tsx` file
- **AND** each story file SHALL define at least one `Default` story

#### Scenario: Density-aware primitives have a WithDensity story

- **WHEN** a shadcn primitive is in the density opt-in list (Table, ListItem, Toolbar, FormControl, Sidebar item, Editor toolbar, MenuItem, TabsList item, Breadcrumb item, CommandPalette item, plus any primitive added to the list by `design-system-density/spec.md`)
- **THEN** its story file SHALL include a `WithDensity` story rendering the primitive at compact / comfortable / spacious side-by-side

### Requirement: Storybook reads tokens from CSS at runtime, not from TS imports

The `_gallery.tsx` helper module SHALL expose a `useToken(name: string)` hook that reads the token's computed value via `getComputedStyle(document.documentElement).getPropertyValue(name)` and re-runs on `[data-theme]` and `[data-density]` change.

Foundation MDX galleries SHALL consume tokens via this hook, not via TS-level imports of `package/ui/src/config/tokens/`. Reasons: round-trip through the `.theme-rezics` cascade to match production resolution, theme-and-density switching automatically updates galleries without source-data refetch, decouple gallery surface from TS-export surface (tokens that aren't TS-exported still appear in galleries).

#### Scenario: Hook re-runs on theme change

- **WHEN** the theme global toolbar switches from Light to Dark
- **THEN** every `useToken` invocation in the rendered Foundation pages SHALL return the dark-mode value within one render cycle
- **AND** every swatch / sample SHALL update without a full page reload

#### Scenario: Hook re-runs on density change

- **WHEN** the density global toolbar switches between Compact / Comfortable / Spacious
- **THEN** any `useToken` invocation reading a density-aware token (e.g. `--rezics-comp-table-row-padding-y`) SHALL return the new value within one render cycle

#### Scenario: Galleries do not import from `package/ui/src/config/tokens/` for value display

- **WHEN** any Foundation/Tokens MDX file is parsed
- **THEN** it SHALL NOT import a TypeScript token module to read the displayed value
- **AND** the displayed value SHALL come from the `useToken` hook (or an equivalent runtime CSS-variable read)
