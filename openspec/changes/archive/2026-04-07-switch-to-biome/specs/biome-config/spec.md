## ADDED Requirements

### Requirement: Root Biome configuration file
The project SHALL have a single `biome.json` at the repository root that configures both linting and formatting for the entire monorepo.

#### Scenario: Biome config exists and is valid
- **WHEN** a developer runs `biome check .` from the repo root
- **THEN** Biome loads `biome.json` and processes all packages without errors

### Requirement: Formatter matches project style
The Biome formatter SHALL use single quotes, trailing commas in all positions, 2-space indentation, and no bracket spacing — matching the existing Prettier configuration where Biome supports it.

#### Scenario: Formatting a TypeScript file
- **WHEN** a developer runs `biome format --write` on any `.ts`/`.tsx` file
- **THEN** the output uses single quotes, trailing commas, 2-space indent, and no bracket spacing

#### Scenario: Arrow function parentheses
- **WHEN** a developer formats a file containing arrow functions
- **THEN** Biome always adds parentheses around arrow function parameters (Biome does not support `arrowParens: "avoid"`)

### Requirement: TypeScript lint rules
Biome SHALL enforce TypeScript recommended rules with the following overrides: `noUnusedVariables` at warn severity (underscore-prefixed variables ignored), `useImportType` at warn severity, `noExplicitAny` disabled, `noNonNullAssertion` disabled.

#### Scenario: Unused variable with underscore prefix
- **WHEN** a variable named `_unused` is declared but not referenced
- **THEN** Biome does not report a warning

#### Scenario: Unused variable without underscore prefix
- **WHEN** a variable named `unused` is declared but not referenced
- **THEN** Biome reports a warning (not an error)

#### Scenario: Missing type import keyword
- **WHEN** a file imports a type without using `import type`
- **THEN** Biome reports a warning with an auto-fix available

### Requirement: React Hooks lint rules
Biome SHALL enforce React Hooks rules equivalent to `eslint-plugin-react-hooks` recommended config: `useHookAtTopLevel` and `useExhaustiveDependencies` at error severity.

#### Scenario: Hook called inside a conditional
- **WHEN** a React hook is called inside an `if` block
- **THEN** Biome reports an error via `useHookAtTopLevel`

#### Scenario: Missing dependency in useEffect
- **WHEN** a `useEffect` callback references a variable not listed in the dependency array
- **THEN** Biome reports an error via `useExhaustiveDependencies`

### Requirement: Accessibility lint rules
Biome SHALL enforce the `a11y` recommended rule group, covering equivalents of `eslint-plugin-jsx-a11y` recommended rules.

#### Scenario: Image without alt text
- **WHEN** a JSX `<img>` element is missing the `alt` attribute
- **THEN** Biome reports an error

### Requirement: React Refresh lint rule
Biome SHALL enforce `useComponentExportOnlyModules` to ensure Vite fast refresh compatibility.

#### Scenario: Module exports non-component alongside component
- **WHEN** a `.tsx` file exports both a React component and a plain constant
- **THEN** Biome reports a warning

### Requirement: Ignored paths
Biome SHALL ignore `node_modules`, `dist`, `build`, `.vite`, `coverage`, and generated files (e.g., `*.min.*`) — matching the current ESLint ignore patterns.

#### Scenario: File in dist directory
- **WHEN** Biome runs on the repository
- **THEN** files under any `dist/` directory are not checked

### Requirement: VS Code integration
The `.vscode/settings.json` SHALL set `biomejs.biome` as the default formatter. The `.vscode/extensions.json` SHALL recommend the `biomejs.biome` extension.

#### Scenario: Developer opens project in VS Code
- **WHEN** a developer opens the project without the Biome extension installed
- **THEN** VS Code prompts them to install the recommended `biomejs.biome` extension

#### Scenario: Developer saves a file
- **WHEN** a developer saves a `.ts`/`.tsx`/`.js`/`.jsx` file
- **THEN** VS Code formats it using Biome (not Prettier)

### Requirement: Root package scripts
The root `package.json` SHALL provide `lint`, `format`, `format:check`, and `check` scripts using Biome CLI commands.

#### Scenario: Running lint
- **WHEN** a developer runs `bun run lint` from the repo root
- **THEN** Biome lints all files in the monorepo and reports diagnostics

#### Scenario: Running format check in CI
- **WHEN** CI runs `bun run format:check`
- **THEN** Biome exits with non-zero code if any file is not formatted correctly

### Requirement: ESLint and Prettier removal
All ESLint config files, Prettier config files, and related devDependencies SHALL be removed from the project.

#### Scenario: No ESLint artifacts remain
- **WHEN** a developer searches the repo for `eslint.config` files outside `node_modules`
- **THEN** no results are found

#### Scenario: No Prettier config remains
- **WHEN** a developer searches for `.prettierrc` files outside `node_modules`
- **THEN** no results are found
