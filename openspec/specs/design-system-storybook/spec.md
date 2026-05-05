# design-system-storybook Specification

## Purpose

Defines the multi-package Storybook topology that hosts the rezics design system documentation. Each UI-producing package owns an independent `.storybook/` directory; a root host aggregates them via Storybook composition (`refs`). Common configuration lives in the `@rezics/storybook-config` workspace package. Theme switching wires through Storybook globals and the `[data-theme]` attribute on `<html>`, with the `--rezics-*` CSS custom-property cascade resolving tokens at runtime.

## Requirements

### Requirement: Storybook is the canonical documentation surface

The rezics design system SHALL use Storybook 10 as the canonical documentation site. React Cosmos SHALL NOT be used. New component documentation SHALL be authored as `*.stories.tsx` (CSF) or `*.mdx` (docs) and surfaced through one of the package Storybooks.

#### Scenario: No Cosmos remnants

- **WHEN** `rg "react-cosmos|useFixtureInput|useFixtureSelect"` is run across all source code
- **THEN** there SHALL be zero matches outside of historical OpenSpec archive entries

#### Scenario: No Cosmos config files

- **WHEN** the repository is searched for `cosmos.config.json`, `cosmos.decorator.tsx`, `vite.cosmos.config.ts`
- **THEN** there SHALL be zero such files in any package

### Requirement: Multi-package Storybook composition topology

Each UI-producing package SHALL own an independent `.storybook/` directory and SHALL build a standalone `storybook-static/` distribution. A root `.storybook/` host SHALL aggregate them via `refs`. The port assignments SHALL be:

| Port | Owner            |
| ---- | ---------------- |
| 6006 | root host        |
| 6007 | `@rezics/ui`     |
| 6008 | `@rezics/editor` |
| 6009 | `@rezics/folio`  |
| 6010 | `@rezics/admin`  |
| 6011 | `@rezics/app`    |

Ports SHALL avoid Chrome's unsafe-port set (`:6000`, `:6566`, `:6665–6669`, `:6697`).

#### Scenario: Each UI package has a `.storybook/` directory

- **WHEN** `package/ui/`, `package/editor/`, `package/folio/`, `package/admin/`, `package/app/` are inspected
- **THEN** each SHALL contain a `.storybook/` directory with `main.ts`, `preview.tsx`, and (where applicable) `vite.config.ts`

#### Scenario: Root host references all five packages

- **WHEN** the root `.storybook/main.ts` is inspected
- **THEN** `refs` SHALL list ports 6007 through 6011 mapped to `ui`, `editor`, `folio`, `admin`, `app` respectively

#### Scenario: Standalone build per package

- **WHEN** `bun -F <pkg> run build-storybook` is run for any of the 5 packages
- **THEN** the package SHALL emit a complete `storybook-static/` directory with a valid `index.json` listing its stories
- **AND** the build SHALL not depend on any other package's Storybook running

### Requirement: Shared Storybook config is a workspace package

Common Storybook configuration (Vite plugin wiring, theme decorator, story patterns, addon list) SHALL live in `@rezics/storybook-config` as a workspace package. Per-package `.storybook/` shells SHALL be thin wrappers (≤ 20 lines per file) that import from the shared package.

#### Scenario: Shared package exists and has two entry points

- **WHEN** `package/storybook-config/package.json` is inspected
- **THEN** the package name SHALL be `@rezics/storybook-config`
- **AND** the `exports` field SHALL include both `"."` (config helpers) and `"./preview"` (theme decorator)

#### Scenario: UnoCSS is an optional peer

- **WHEN** the Storybook for `@rezics/editor` or the root host runs
- **THEN** the shared config SHALL accept `{ uno: false }` and SHALL NOT require UnoCSS to be installed
- **AND** UnoCSS SHALL only be loaded for callers that opt in

### Requirement: Foundation tokens documentation has seven MDX galleries

The `@rezics/ui` Storybook SHALL provide seven MDX token galleries under the `Foundation/Tokens` doc tree: **Colors, Typography, Spacing, Radius, Elevation, Motion, Iconography**. Each gallery SHALL render the live tokens as visual swatches / samples (not just text references) and SHALL conclude with a "Reference" callout naming the Apple HIG and / or Material Design 3 source and the rezics-specific divergence in one paragraph.

The seventh gallery — Iconography — SHALL document the `lucide-react` default icon library, the `@tabler/icons-react` named-fallback rule, the canonical mapping table from former MUI icon names to lucide names for icons currently used in the codebase, and the rezics standard icon sizes (16 / 20 / 24 px).

The Colors gallery SHALL display computed contrast ratios against the closest `on-*` foreground role for each surface swatch, with a pass/fail badge at the WCAG AA threshold (≥4.5:1 for text pairs, ≥3:1 for non-text UI pairs).

A shared helper module `_gallery.tsx` SHALL export `Grid`, `Swatch`, `Row`, `SpacingRuler`, `RadiusSample`, `ElevationSample`, `TypeSample`, `MotionSample`, `Do`, `Dont`, `Compare`, plus the Patterns-demo helpers `DensityDemo`, `StateLayerDemo`, `DepthDemo`, `InverseSurfaceDemo`.

#### Scenario: Galleries exist as MDX

- **WHEN** `package/ui/src/docs/tokens/` is listed
- **THEN** it SHALL contain `colors.mdx`, `typography.mdx`, `spacing.mdx`, `radius.mdx`, `elevation.mdx`, `motion.mdx`, `iconography.mdx`
- **AND** a shared helper module `_gallery.tsx` exporting `Grid`, `Swatch`, `Row`, `SpacingRuler`, `RadiusSample`, `ElevationSample`, `TypeSample`, `MotionSample`, `Do`, `Dont`, `Compare`, `DensityDemo`, `StateLayerDemo`, `DepthDemo`, `InverseSurfaceDemo`

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

### Requirement: Root scripts orchestrate multi-package Storybook

The root `package.json` SHALL provide `bun storybook` (concurrently runs the host + all 5 packages with color-prefixed labels) and `bun storybook:build` (builds host + all 5 packages). Selective dev SHALL be possible via `bun -F <pkg> storybook` for any single instance.

#### Scenario: Root scripts exist

- **WHEN** the root `package.json` is inspected
- **THEN** the `scripts` field SHALL contain `storybook` and `storybook:build` invoking `concurrently@^9` (or equivalent) over the host plus 5 packages

#### Scenario: Selective dev works

- **WHEN** `bun -F @rezics/ui storybook` is run
- **THEN** the `@rezics/ui` Storybook SHALL serve at `:6007` without requiring the host or other packages to be running

### Requirement: Shared config ships the a11y addon

`@rezics/storybook-config` SHALL include `@storybook/addon-a11y@^10` in its `baseStorybookConfig.addons` array. Per-package `.storybook/main.ts` files SHALL inherit the addon list from the shared config without per-package opt-in. The addon SHALL run at warning severity — failures SHALL surface in the Storybook UI panel but SHALL NOT fail builds.

#### Scenario: Addon registered in shared config

- **WHEN** the exported `baseStorybookConfig.addons` from `@rezics/storybook-config` is inspected
- **THEN** it SHALL include the string `@storybook/addon-a11y`

#### Scenario: All five package previews surface the a11y panel

- **WHEN** any of `package/{ui,editor,folio,admin,app}/.storybook/` runs `bun run storybook`
- **THEN** the served Storybook UI SHALL expose an "Accessibility" panel for each story

#### Scenario: Builds tolerate a11y warnings

- **WHEN** `bun run storybook:build` is run at the root with stories that emit a11y warnings
- **THEN** the build SHALL complete with exit code 0
- **AND** the warnings SHALL be observable in the served Storybook

### Requirement: Shared config supports play-function interaction stories

`@rezics/storybook-config` SHALL ship configuration sufficient for stories to use Storybook 10's `play` function (interaction testing) without per-package addon installation. The shared `basePreviewParameters` (or equivalent) SHALL expose `actions: { argTypesRegex: "^on.*" }` so action arguments are auto-spied for play-function assertions.

#### Scenario: argTypes regex set

- **WHEN** the exported `basePreviewParameters` from `@rezics/storybook-config` is inspected
- **THEN** it SHALL include `actions.argTypesRegex` set to a value matching event handlers (e.g. `"^on.*"`)

### Requirement: Per-cluster overview MDX docs register under `Domain/`

The `@rezics/app` Storybook SHALL provide six MDX overview docs under the `Domain/` doc tree, one per cluster: `Domain/Engagement`, `Domain/Cards`, `Domain/Posts`, `Domain/Shelves`, `Domain/Search`, `Domain/Profile`. Each MDX file SHALL live under `package/app/src/docs/`. Each SHALL embed at least one `<Story>` or `<Canvas>` from a story whose component is in that cluster, and SHALL cross-reference the abstraction-vs-split rule under `Foundation/Patterns`.

#### Scenario: Six overview docs registered

- **WHEN** `bun -F @rezics/app run build-storybook` is run
- **THEN** the resulting `storybook-static/index.json` SHALL contain doc entries titled `Domain/Engagement`, `Domain/Cards`, `Domain/Posts`, `Domain/Shelves`, `Domain/Search`, `Domain/Profile`

#### Scenario: Overview docs embed live stories

- **WHEN** any of the six `Domain/<Cluster>` MDX files is parsed
- **THEN** it SHALL include at least one `<Story>` or `<Canvas>` block referencing a story registered in the same Storybook
- **AND** it SHALL link or reference `Foundation/Patterns` for the abstraction-vs-split rule

### Requirement: Theme switching is wired into preview

Each `.storybook/preview.tsx` SHALL provide a Light/Dark global toolbar via Storybook globals that toggles the `[data-theme]` attribute on `<html>`. The CSS variable namespace SHALL switch instantly without component remount.

#### Scenario: Global theme toolbar present

- **WHEN** any package's Storybook preview loads
- **THEN** there SHALL be a Light/Dark toggle in the global toolbar
- **AND** switching SHALL update the `[data-theme]` attribute on `<html>`

#### Scenario: Layers CSS imported in every preview

- **WHEN** `package/{ui,editor,folio,admin,app}/.storybook/preview.tsx` is inspected
- **THEN** each SHALL import `@rezics/ui/shared/styles/layers.css` (directly or transitively via the shared preview)
- **AND** stories SHALL render with `--rezics-*` custom properties resolved
