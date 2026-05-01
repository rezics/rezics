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

### Requirement: Theme switching is wired into preview

Each `.storybook/preview.tsx` SHALL provide a Light/Dark global toolbar via Storybook globals that toggles both `[data-theme]` on `<html>` and the MUI theme via `withRezicsTheme`. The CSS variable namespace SHALL switch instantly without component remount.

#### Scenario: Global theme toolbar present

- **WHEN** any package's Storybook preview loads
- **THEN** there SHALL be a Light/Dark toggle in the global toolbar
- **AND** switching SHALL update both the MUI ThemeProvider and the `[data-theme]` attribute on `<html>`

#### Scenario: Layers CSS imported in every preview

- **WHEN** `package/{ui,editor,folio,admin,app}/.storybook/preview.tsx` is inspected
- **THEN** each SHALL import `@rezics/ui/shared/styles/layers.css` (directly or transitively via the shared preview)
- **AND** stories SHALL render with `--rezics-*` custom properties resolved

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
