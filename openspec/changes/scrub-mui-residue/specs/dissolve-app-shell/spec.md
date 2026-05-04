## MODIFIED Requirements

### Requirement: App boots without a theme factory import

`@rezics/app` and `@rezics/admin` SHALL boot without importing any theme factory or React theme provider component for design-system tokens. Token resolution SHALL flow exclusively through the imported `@rezics/ui/shared/styles/layers.css` cascade.

#### Scenario: App bootstrap inspected

- **WHEN** `package/app/src/main.tsx` (or its equivalent root entry) is inspected
- **THEN** there SHALL be no import of a theme factory function and no `<ThemeProvider>` element wrapping the React tree for design-system tokens
- **AND** the import of `@rezics/ui/shared/styles/layers.css` SHALL appear at app entry

#### Scenario: Admin bootstrap inspected

- **WHEN** `package/admin/src/app/App.tsx` and the admin entry are inspected
- **THEN** the same constraints SHALL hold

## REMOVED Requirements

### Requirement: Theme system lives in @rezics/ui

**Reason**: This requirement enumerated MUI theme-factory exports (`getTheme`, `getDynamicTheme`, `generateDynamicColors`, `dynamicColorsToPalette`, `extractColorFromImage`, `applyDynamicThemeToDOM`, `PRESET_COLORS`, `DynamicColorScheme` type) that no longer exist after the deprecate-mui change. The active theming system uses the `--rezics-*` CSS custom-property cascade toggled by the `[data-theme]` attribute (see `design-system-foundation/spec.md`). The non-theme parts of the original requirement (`createUnoConfig`) are not load-bearing and are documented by the actual `@rezics/ui` exports surface.

**Migration**: None at the codebase level — the MUI theme exports were removed during the deprecate-mui change. The active "Theme switches via `[data-theme]` attribute alone" requirement in `design-system-foundation/spec.md` is the sole authority for how theming works.
