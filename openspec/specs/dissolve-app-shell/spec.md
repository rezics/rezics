## ADDED Requirements

### Requirement: Theme system lives in @rezics/ui

`@rezics/ui` SHALL export: `getTheme`, `getDynamicTheme`, `generateDynamicColors`, `dynamicColorsToPalette`, `extractColorFromImage`, `applyDynamicThemeToDOM`, `PRESET_COLORS`, `DynamicColorScheme` type, and `createUnoConfig()`. These SHALL be moved from `@rezics/app-shell` with no behavioral changes.

#### Scenario: App imports theme from @rezics/ui

- **WHEN** `@rezics/app` needs the MUI theme factory
- **THEN** it imports `getTheme` from `@rezics/ui` (not `@rezics/app-shell`)

#### Scenario: UnoCSS config imported from @rezics/ui

- **WHEN** `@rezics/app` or `@rezics/admin` configures UnoCSS
- **THEN** it imports `createUnoConfig` from `@rezics/ui/uno.config`

### Requirement: Auth state lives in @rezics/api

`@rezics/api` SHALL export: `AuthProvider`, `authSessionStore` (with `useAuthSessionStore`), `useServerPermission()`, token refresh logic, and retry policy. These SHALL be moved from `@rezics/app-shell` with no behavioral changes except the permission model update.

#### Scenario: App imports AuthProvider from @rezics/api

- **WHEN** `@rezics/app` sets up its authentication provider
- **THEN** it imports `AuthProvider` from `@rezics/api`

### Requirement: Each app owns its shell composition

`@rezics/app` and `@rezics/admin` SHALL each define their own provider composition (the equivalent of the former `AppShell` component). Each app SHALL own its local `appStore` and `alertStore`. There SHALL be no shared shell wrapper component.

#### Scenario: App defines its own provider tree

- **WHEN** `@rezics/app` renders its root
- **THEN** it composes its own provider tree (StrictMode, ErrorBoundary, ThemeProvider, ReactQueryProvider, etc.) locally, not via a shared `AppShell` component

#### Scenario: Admin defines independent provider tree

- **WHEN** `@rezics/admin` renders its root
- **THEN** it composes its own provider tree independently from `@rezics/app`

### Requirement: @rezics/app-shell package is deleted

The `@rezics/app-shell` package SHALL be removed from the monorepo. No package SHALL depend on `@rezics/app-shell`. The `package/app-shell/` directory SHALL not exist after this change.

#### Scenario: No remaining references to app-shell

- **WHEN** the change is complete
- **THEN** searching for `@rezics/app-shell` across the codebase yields zero results
## Requirements
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

