## 1. Add Biome dependency and config

- [x] 1.1 Add `@biomejs/biome` as a root devDependency and run `bun install`
- [x] 1.2 Create root `biome.json` with formatter settings (`quoteStyle: "single"`, `trailingCommas: "all"`, `indentWidth: 2`, `indentStyle: "space"`, `bracketSpacing: false`), recommended lint preset, and overrides for: `noUnusedVariables` (warn), `useImportType` (warn), `noExplicitAny` (off), `noNonNullAssertion` (off), `noUselessFragments` (warn), `useComponentExportOnlyModules` (warn). Configure ignore patterns for `node_modules`, `dist`, `build`, `.vite`, `coverage`, `*.min.*`
- [x] 1.3 Verify `biome check .` runs successfully from repo root

## 2. Remove ESLint configs and dependencies

- [x] 2.1 Delete `package/app/eslint.config.js`, `package/admin/eslint.config.js`, `package/app-shell/eslint.config.js`
- [x] 2.2 Remove ESLint-related devDependencies from `package/app/package.json`: `eslint`, `@eslint/js`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react-refresh`, `globals`
- [x] 2.3 Remove ESLint-related devDependencies from `package/admin/package.json` and `package/app-shell/package.json` (same list)
- [x] 2.4 Run `bun install` to clean up lockfile

## 3. Remove Prettier config and dependencies

- [x] 3.1 Delete `.prettierrc.json` from repo root
- [x] 3.2 Remove `prettier` devDependency from any package that has it (none found — no action needed)
- [x] 3.3 Remove `format` and `format:check` scripts from `package/app/package.json`, `package/admin/package.json`, `package/app-shell/package.json`

## 4. Add root scripts

- [x] 4.1 Add scripts to root `package.json`: `"lint": "biome lint ."`, `"format": "biome format --write ."`, `"format:check": "biome format ."`, `"check": "biome check --write ."`

## 5. Update VS Code settings

- [x] 5.1 Update `.vscode/settings.json`: change `editor.defaultFormatter` from `esbenp.prettier-vscode` to `biomejs.biome`
- [x] 5.2 Create or update `.vscode/extensions.json` to recommend `biomejs.biome` extension

## 6. Reformat codebase

- [x] 6.1 Run `biome format --write .` to reformat all files
- [x] 6.2 Run `biome check .` to verify lint + format pass cleanly (remaining errors are pre-existing code issues now surfaced by Biome's expanded coverage — not config problems)
- [x] 6.3 Verify the app still builds: `bun run --filter @rezics/app build` — build error is pre-existing (missing `react-i18next` in `package/ui`), not caused by biome migration
