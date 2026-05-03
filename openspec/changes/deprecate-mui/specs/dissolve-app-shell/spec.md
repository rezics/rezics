## REMOVED Requirements

### Requirement: ~~App imports theme from @rezics/ui~~ (no longer applicable)

**Reason:** The MUI theme factory (`getTheme`, `getDynamicTheme`) is removed from `@rezics/ui` by this change. There is no theme factory to import from any package; theme is delivered exclusively via the `[data-theme]` attribute and the `--rezics-*` CSS custom-property cascade.

**Migration:** Any prior consumer that imported `getTheme` from `@rezics/ui` (or `@rezics/app-shell` historically) has been migrated to no-op — the `package/{app,admin}/.storybook/preview.tsx` files and the corresponding application bootstraps no longer wrap the React tree in a MUI `ThemeProvider`. The CSS custom-property cascade replaces the runtime theme object.

## ADDED Requirements

### Requirement: App boots without a theme factory import

`@rezics/app` and `@rezics/admin` SHALL boot without importing any theme factory or React theme provider component for design-system tokens. Token resolution SHALL flow exclusively through the imported `@rezics/ui/shared/styles/layers.css` cascade.

#### Scenario: App bootstrap inspected

- **WHEN** `package/app/src/main.tsx` (or its equivalent root entry) is inspected
- **THEN** there SHALL be no import of `getTheme`, `lightTheme`, `darkTheme`, or any function returning a MUI theme object
- **AND** there SHALL be no `<ThemeProvider>` element wrapping the React tree
- **AND** the import of `@rezics/ui/shared/styles/layers.css` SHALL appear at app entry

#### Scenario: Admin bootstrap inspected

- **WHEN** `package/admin/src/app/App.tsx` and the admin entry are inspected
- **THEN** the same constraints SHALL hold
