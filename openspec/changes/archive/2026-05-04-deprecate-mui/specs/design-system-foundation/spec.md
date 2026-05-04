## ADDED Requirements

### Requirement: Token TypeScript modules are the single source of truth

The rezics design system SHALL define all foundation tokens (color, typography, spacing, radius, elevation, motion) as TypeScript constants under `package/ui/src/config/tokens/`. Every other consumer — UnoCSS preset, CSS custom properties in `layers.css`, breakpoint constants in `package/ui/src/config/breakpoints.ts` — SHALL derive from these modules. Token authors SHALL NOT introduce parallel sources of truth (Tailwind config literals, CSS-in-TS theme objects, MDX-only definitions, MUI theme adapter). Token modules SHALL NOT import from `@mui/*`.

#### Scenario: All token categories live under the tokens directory

- **WHEN** the contents of `package/ui/src/config/tokens/` are listed
- **THEN** the directory SHALL contain `colors.ts`, `typography.ts`, `spacing.ts`, `radius.ts`, `elevation.ts`, `motion.ts`, and `index.ts`
- **AND** `index.ts` SHALL re-export from each of the six token modules

#### Scenario: Token modules contain no MUI imports

- **WHEN** any file under `package/ui/src/config/tokens/` is inspected
- **THEN** there SHALL be no import from `@mui/*`
- **AND** no token value SHALL be a re-export of a MUI palette / spacing / typography construct

#### Scenario: UnoCSS preset binds to tokens via CSS variables

- **WHEN** `package/ui/src/config/uno-config.ts` defines theme colors / spacing / radius
- **THEN** the values SHALL be `var(--rezics-…)` strings, not raw hex / px literals
- **AND** the same UnoCSS class SHALL render different colors when `[data-theme="dark"]` is set on `<html>`

### Requirement: Theme switches via `[data-theme]` attribute alone

The light/dark theme SHALL switch via the `[data-theme]` attribute on the `<html>` element. The `--rezics-*` CSS custom-property cascade SHALL deliver all mode-sensitive token values. There SHALL NOT be a JavaScript-side theme object, a React context provider, or a MUI `ThemeProvider` / `StyledEngineProvider` in the runtime path. Consumers that previously imported `getTheme` / `getDynamicTheme` from `@rezics/ui` SHALL no longer do so; the prior MUI-theme contract is superseded by this attribute-based switching.

#### Scenario: Mode switch updates DOM attribute

- **WHEN** the user (or an app-level theme toggle) switches to dark mode
- **THEN** the `<html>` element SHALL receive `data-theme="dark"`
- **AND** the `--rezics-color-*` cascade SHALL resolve to dark-mode values
- **AND** no React component remount SHALL be required for the change to take effect

#### Scenario: No MUI ThemeProvider in runtime

- **WHEN** the running React tree of `@rezics/app` or `@rezics/admin` is inspected
- **THEN** there SHALL be no MUI `ThemeProvider` or `StyledEngineProvider` in the tree
- **AND** components SHALL receive token values exclusively through CSS custom properties
