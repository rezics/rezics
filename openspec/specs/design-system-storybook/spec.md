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

### Requirement: Token galleries are MDX docs under `Foundation/Tokens`

The `@rezics/ui` Storybook SHALL provide six MDX token galleries under the `Foundation/Tokens` doc tree: colors, typography, spacing, radius, elevation, motion. Each gallery SHALL render the live tokens as visual swatches / samples (not just text references).

#### Scenario: Galleries exist as MDX

- **WHEN** `package/ui/src/docs/tokens/` is listed
- **THEN** it SHALL contain `colors.mdx`, `typography.mdx`, `spacing.mdx`, `radius.mdx`, `elevation.mdx`, `motion.mdx`
- **AND** a shared helper module `_gallery.tsx` exporting `Grid`, `Swatch`, `Row`, `SpacingRuler`, `RadiusSample`, `ElevationSample`, `TypeSample`, `MotionSample`, `Do`, `Dont`, `Compare`

#### Scenario: Galleries register under Foundation/Tokens

- **WHEN** `bun -F @rezics/ui run build-storybook` is run
- **THEN** the resulting `storybook-static/index.json` SHALL contain doc entries titled `Foundation/Tokens/Colors`, `Foundation/Tokens/Typography`, `Foundation/Tokens/Spacing`, `Foundation/Tokens/Radius`, `Foundation/Tokens/Elevation`, `Foundation/Tokens/Motion`

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
