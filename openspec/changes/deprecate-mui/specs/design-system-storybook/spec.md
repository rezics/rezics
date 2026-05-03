## MODIFIED Requirements

### Requirement: Theme switching is wired into preview

Each `.storybook/preview.tsx` SHALL provide a Light/Dark global toolbar via Storybook globals that toggles the `[data-theme]` attribute on `<html>`. The CSS variable namespace SHALL switch instantly without component remount. There SHALL NOT be a MUI `ThemeProvider`, `StyledEngineProvider`, `CssBaseline`, or any other MUI runtime in the preview tree.

#### Scenario: Global theme toolbar present

- **WHEN** any package's Storybook preview loads
- **THEN** there SHALL be a Light/Dark toggle in the global toolbar
- **AND** switching SHALL update the `[data-theme]` attribute on `<html>`

#### Scenario: Layers CSS imported in every preview

- **WHEN** `package/{ui,editor,folio,admin,app}/.storybook/preview.tsx` is inspected
- **THEN** each SHALL import `@rezics/ui/shared/styles/layers.css` (directly or transitively via the shared preview)
- **AND** stories SHALL render with `--rezics-*` custom properties resolved

#### Scenario: No MUI runtime in preview

- **WHEN** `package/storybook-config/src/preview.tsx` and the per-package `.storybook/preview.tsx` files are inspected
- **THEN** there SHALL be no import from `@mui/material` or `@mui/material/styles`
- **AND** there SHALL be no `ThemeProvider`, `StyledEngineProvider`, or `CssBaseline` element rendered

### Requirement: Shared Storybook config is a workspace package

Common Storybook configuration (Vite plugin wiring, theme decorator, story patterns, addon list) SHALL live in `@rezics/storybook-config` as a workspace package. Per-package `.storybook/` shells SHALL be thin wrappers (≤ 20 lines per file) that import from the shared package. The shared package SHALL NOT declare `@mui/*` in `dependencies` or `peerDependencies`.

#### Scenario: Shared package exists and has two entry points

- **WHEN** `package/storybook-config/package.json` is inspected
- **THEN** the package name SHALL be `@rezics/storybook-config`
- **AND** the `exports` field SHALL include both `"."` (config helpers) and `"./preview"` (theme decorator)
- **AND** the `dependencies` and `peerDependencies` SHALL NOT contain any `@mui/*` entry

#### Scenario: UnoCSS is an optional peer

- **WHEN** the Storybook for `@rezics/editor` or the root host runs
- **THEN** the shared config SHALL accept `{ uno: false }` and SHALL NOT require UnoCSS to be installed
- **AND** UnoCSS SHALL only be loaded for callers that opt in
