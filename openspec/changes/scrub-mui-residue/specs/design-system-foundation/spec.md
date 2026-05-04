## MODIFIED Requirements

### Requirement: Token TypeScript modules are the single source of truth

The rezics design system SHALL define all foundation tokens (color, typography, spacing, radius, elevation, motion) as TypeScript constants under `package/ui/src/config/tokens/`. Every other consumer — UnoCSS preset, CSS custom properties in `layers.css`, breakpoint constants in `package/ui/src/config/breakpoints.ts` — SHALL derive from these modules. Token authors SHALL NOT introduce parallel sources of truth (Tailwind config literals, CSS-in-TS theme objects, MDX-only definitions).

#### Scenario: All token categories live under the tokens directory

- **WHEN** the contents of `package/ui/src/config/tokens/` are listed
- **THEN** the directory SHALL contain `colors.ts`, `typography.ts`, `spacing.ts`, `radius.ts`, `elevation.ts`, `motion.ts`, and `index.ts`
- **AND** `index.ts` SHALL re-export from each of the six token modules

#### Scenario: UnoCSS preset binds to tokens via CSS variables

- **WHEN** `package/ui/src/config/uno-config.ts` defines theme colors / spacing / radius
- **THEN** the values SHALL be `var(--rezics-…)` strings, not raw hex / px literals
- **AND** the same UnoCSS class SHALL render different colors when `[data-theme="dark"]` is set on `<html>`

### Requirement: Theme switches via `[data-theme]` attribute alone

The light/dark theme SHALL switch via the `[data-theme]` attribute on the `<html>` element. The `--rezics-*` CSS custom-property cascade SHALL deliver all mode-sensitive token values. There SHALL NOT be a JavaScript-side theme object, a React context provider, or a runtime theme-injection layer in the runtime path. Components SHALL receive token values exclusively through CSS custom properties.

#### Scenario: Mode switch updates DOM attribute

- **WHEN** the user (or an app-level theme toggle) switches to dark mode
- **THEN** the `<html>` element SHALL receive `data-theme="dark"`
- **AND** the `--rezics-color-*` cascade SHALL resolve to dark-mode values
- **AND** no React component remount SHALL be required for the change to take effect

#### Scenario: No JavaScript theme provider in runtime

- **WHEN** the running React tree of `@rezics/app` or `@rezics/admin` is inspected
- **THEN** there SHALL be no JavaScript-side theme provider injecting palette / spacing / typography values
- **AND** components SHALL receive token values exclusively through CSS custom properties

## REMOVED Requirements

### Requirement: MUI theme exposes light and dark themes

**Reason**: Superseded by "Theme switches via `[data-theme]` attribute alone" (preserved above). MUI is permanently removed from the project; `@rezics/ui` no longer exports `lightTheme`, `darkTheme`, `getTheme`, or `getDynamicTheme`. The active theme cascade is the `--rezics-*` CSS custom-property layer toggled by the `[data-theme]` attribute. Keeping the obsolete MUI-theme requirement creates two contradictory statements about how theming works.

**Migration**: None at the codebase level — MUI theme exports were removed during the deprecate-mui change. The surviving `[data-theme]` attribute-based switching (preserved as a MODIFIED requirement) is the sole authority going forward.
