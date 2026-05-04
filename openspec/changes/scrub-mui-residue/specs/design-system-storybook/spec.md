## MODIFIED Requirements

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
