## Why

The project currently uses ESLint + Prettier across three frontend packages (`app`, `admin`, `app-shell`) with identical configs, while backend packages (`server`, `auth`, `jwt`, `contract`, `api`, `search`, `ui`) have no linting at all. Biome provides a single Rust-based tool that replaces both ESLint and Prettier with significantly faster execution, fewer dependencies, and unified configuration. This simplifies the toolchain and extends lint coverage to the entire monorepo.

## What Changes

- Remove ESLint configs (`eslint.config.js`) from `package/app`, `package/admin`, `package/app-shell`
- Remove `.prettierrc.json` from project root
- Remove all ESLint and Prettier devDependencies from affected packages
- Remove `format`/`format:check` scripts that use Prettier from package scripts
- Add a single root `biome.json` covering the entire monorepo
- Add `@biomejs/biome` as a root devDependency
- Update `.vscode/settings.json` to use the Biome VS Code extension as the default formatter
- Add root-level `format`, `format:check`, and `lint` scripts using Biome
- **BREAKING**: Biome formatting has minor differences from Prettier (e.g., `bracketSpacing: false` maps to Biome's formatter config, `arrowParens: "avoid"` is not supported — Biome always adds parens). A one-time reformat of the codebase is required.

## Capabilities

### New Capabilities
- `biome-config`: Root Biome configuration covering lint rules (TypeScript, React, React Hooks, a11y, React Refresh equivalents), formatter settings (matching current Prettier style where possible), and VS Code integration.

### Modified Capabilities
_(none — no existing spec-level requirements are changing)_

## Impact

- **Affected packages**: All packages in the monorepo. Frontend packages (`package/app`, `package/admin`, `package/app-shell`) lose ESLint+Prettier, gain Biome. Backend packages (`package/server`, `package/auth`, `package/jwt`, `package/contract`, `package/api`, `package/search`, `package/ui`) gain lint coverage for the first time.
- **Dependencies removed**: `eslint`, `@eslint/js`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react-refresh`, `globals`, `prettier` (and related packages)
- **Dependencies added**: `@biomejs/biome` (root only)
- **VS Code**: Default formatter switches from `esbenp.prettier-vscode` to `biomejs.biome`. Team members need the Biome VS Code extension.
- **CI**: Any CI steps running `eslint` or `prettier` commands must be updated to use `biome` equivalents.
- **Formatting diff**: One-time bulk reformat commit due to minor Biome/Prettier formatting differences (e.g., arrow function parens).
