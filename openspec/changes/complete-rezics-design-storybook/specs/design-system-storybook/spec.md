## ADDED Requirements

### Requirement: Foundation tokens documentation has seven MDX galleries

The `@rezics/ui` Storybook SHALL provide seven MDX token galleries under the `Foundation/Tokens` doc tree: **Colors, Typography, Spacing, Radius, Elevation, Motion, Iconography**. Each gallery SHALL render the live tokens as visual swatches / samples (not just text references) and SHALL conclude with a "Reference" callout naming the Apple HIG and / or Material Design 3 source and the rezics-specific divergence in one paragraph.

The seventh gallery — Iconography — SHALL document the `lucide-react` default icon library, the `@tabler/icons-react` named-fallback rule, the canonical mapping table from former MUI icon names to lucide names for icons currently used in the codebase, and the rezics standard icon sizes (16 / 20 / 24 px).

The Colors gallery SHALL display computed contrast ratios against the closest `on-*` foreground role for each surface swatch, with a pass/fail badge at the WCAG AA threshold (≥4.5:1 for text pairs, ≥3:1 for non-text UI pairs).

#### Scenario: Seven Foundation galleries register

- **WHEN** `bun -F @rezics/ui run build-storybook` is run
- **THEN** the resulting `storybook-static/index.json` SHALL contain doc entries titled `Foundation/Tokens/Colors`, `Foundation/Tokens/Typography`, `Foundation/Tokens/Spacing`, `Foundation/Tokens/Radius`, `Foundation/Tokens/Elevation`, `Foundation/Tokens/Motion`, and `Foundation/Tokens/Iconography`

#### Scenario: Each gallery cites its research source

- **WHEN** any of the seven `Foundation/Tokens/*` MDX files is parsed
- **THEN** it SHALL include a "Reference" callout (rendered as a styled MDX block) naming the Apple HIG and/or MD3 source page
- **AND** SHALL state the rezics-specific divergence in one paragraph

#### Scenario: Colors gallery shows contrast badges

- **WHEN** the `Foundation/Tokens/Colors` page renders any surface swatch
- **THEN** the swatch SHALL display its computed contrast ratio against the closest `on-*` role
- **AND** SHALL display a pass/fail badge (≥4.5:1 for text pairs, ≥3:1 for non-text UI pairs)

### Requirement: Patterns documentation has seven MDX pages

The `@rezics/ui` Storybook SHALL provide seven MDX patterns pages, comprising the two existing index-tier pages and five new detail pages:

**Existing (under `package/ui/src/docs/`):**

1. **Voice** (`voice.mdx`) — the rezics philosophy: parchment-archive-not-glass-dashboard mood, the four mood pillars, the canvas/text/brand color rationale, the typography family selection rationale.
2. **Patterns** (`patterns.mdx`) — abstraction-vs-split, do/don't pairs at the layout level. Index page that cross-links to the detail pages below.

**New (under `package/ui/src/docs/patterns/`):**

3. **Density** (`density.mdx`) — live nine-token `--padding-*` ladder showing intrinsic per-component density. Documents the opt-in / opt-out component lists. States the "density never affects type" rule and that density is not a runtime toggle.
4. **State Layer** (`state-layer.mdx`) — live demo of the 8/12/12/16 opacity ladder applied as quiet rectangular tints. Includes a rejection sample for MD3 full-bleed circular ripple.
5. **Depth Without Shadow** (`depth-without-shadow.mdx`) — live demo of the canvas → base → elevated → subtle → sunken surface ladder. Includes a rejection sample for the MD3 dp shadow ladder. Documents that shadow is reserved for modals only.
6. **Inverse Surface** (`inverse-surface.mdx`) — snackbar and pull-quote demos. Documents when and when not to use inverse-surface.
7. **Layout & Breakpoints** (`layout-and-breakpoints.mdx`) — visual ruler of all rezics breakpoints, container widths, and the rationale for `xsm:450px` and `8xl:1440px` as rezics-specific additions.

Each new Patterns page SHALL include at least one live demo (not a screenshot) and SHALL pair every "we do" example with a "we don't do this" rejection sample where the contrast is instructive.

#### Scenario: Seven Patterns pages register

- **WHEN** `bun -F @rezics/ui run build-storybook` is run
- **THEN** the resulting `storybook-static/index.json` SHALL contain doc entries titled `Foundation/Voice`, `Foundation/Patterns`, `Foundation/Patterns/Density`, `Foundation/Patterns/State Layer`, `Foundation/Patterns/Depth Without Shadow`, `Foundation/Patterns/Inverse Surface`, and `Foundation/Patterns/Layout and Breakpoints`

#### Scenario: Each new Patterns page has live demos and rejection samples

- **WHEN** any of the five new `Foundation/Patterns/<detail>` MDX files is parsed
- **THEN** it SHALL include at least one live `<Story>`, `<Canvas>`, or `<*Demo>` element from the `_gallery.tsx` helper
- **AND** SHALL include at least one "we don't do this" rejection sample where the contrast against MD3 / shadcn-default / Tailwind-default is instructive

### Requirement: Storybook toolbar exposes theme only

`package/storybook-config/src/preview.tsx` SHALL provide the existing Light/Dark theme toolbar using Storybook's `globalTypes` mechanism. It SHALL NOT provide a Density toolbar, and no decorator SHALL toggle density classes on `<html>`.

Density is documented in `Foundation/Patterns/Density` as an intrinsic component vocabulary. The page renders the nine fixed `--padding-*` tokens directly; there is no global compact/comfortable/spacious axis.

#### Scenario: No global density toolbar exists

- **WHEN** any package's Storybook (`@rezics/ui`, `@rezics/admin`, `@rezics/app`, `@rezics/folio`, `@rezics/editor`) is opened
- **THEN** only the Light/Dark theme toolbar SHALL appear from the shared rezics preview config
- **AND** `package/storybook-config/src/preview.tsx` SHALL contain no `density` `globalType`
- **AND** it SHALL contain no `density-compact` or `density-spacious` class toggle

### Requirement: Every shadcn primitive in `@rezics/ui` has a story file

Every primitive `.tsx` file directly under `package/ui/src/shadcn/` (excluding `index.ts`, the `sections/` directory, and any `*.stories.tsx`, `*.test.tsx`, or `*.fixture.ts` siblings) SHALL have a co-located `<primitive>.stories.tsx` file. Each story file SHALL cover, at minimum:

- A `Default` story (the most-common rendering).
- One story per documented user-facing variant.
- A `Disabled` story (where the primitive supports a disabled state).
- A `Loading` story (where applicable).
- An `InsideCard`, `InsideDialog`, or `InsideSidebar` embedded scenario for primitives where the surrounding surface affects the visual read.
It SHALL NOT include a `WithDensity` story axis. Density is intrinsic to the component type and documented in `Foundation/Patterns/Density`, not repeated per primitive.

Story file co-location SHALL match the existing flat structure: `package/ui/src/shadcn/<primitive>.stories.tsx` (sibling to `<primitive>.tsx`), not nested per-folder.

#### Scenario: Each shadcn primitive ships at least the Default story

- **WHEN** every `.tsx` file directly under `package/ui/src/shadcn/` (excluding `index.ts`, `sections/`, and `*.stories.tsx` / `*.test.tsx` / `*.fixture.ts`) is enumerated
- **THEN** each SHALL have a sibling `*.stories.tsx` file
- **AND** each story file SHALL define at least one `Default` story

#### Scenario: Primitive stories do not expose runtime density

- **WHEN** any `package/ui/src/shadcn/*.stories.tsx` file is inspected
- **THEN** it SHALL NOT define a `WithDensity` story
- **AND** it SHALL NOT render `density-compact` or `density-spacious`

### Requirement: Storybook reads tokens from CSS at runtime, not from TS imports

The `_gallery.tsx` helper module SHALL expose token-reading helpers that read computed values via `getComputedStyle(document.documentElement).getPropertyValue(name)` and re-run whenever the `<html>` element's `class` attribute changes (covering theme — `dark` — class toggles). Implementation SHALL use a `MutationObserver` watching `document.documentElement` for `attributes: ['class']`.

Foundation MDX galleries SHALL consume tokens via this hook, not via TS-level imports of `package/ui/src/config/tokens/`. Reasons: round-trip through the cascade to match production resolution, theme-and-density switching automatically updates galleries without source-data refetch, decouple gallery surface from TS-export surface.

#### Scenario: Hook re-runs on theme change

- **WHEN** the theme global toolbar switches from Light to Dark
- **THEN** every `useToken` invocation in the rendered Foundation pages SHALL return the dark-mode value within one render cycle
- **AND** every swatch / sample SHALL update without a full page reload

#### Scenario: Padding tokens render as fixed values

- **WHEN** the Density page reads a padding token (e.g. `--padding-table-row-y`)
- **THEN** the displayed value SHALL be the fixed computed length
- **AND** it SHALL NOT depend on a density global toolbar

#### Scenario: Galleries do not import from `package/ui/src/config/tokens/` for value display

- **WHEN** any `Foundation/Tokens/*` MDX file is parsed
- **THEN** it SHALL NOT import a TypeScript token module to read the displayed value
- **AND** the displayed value SHALL come from the `useToken` hook (or an equivalent runtime CSS-variable read)
