## Context

The monorepo currently uses ESLint (v9 flat config) + Prettier for frontend packages only. Three packages (`app`, `admin`, `app-shell`) maintain identical ESLint configs with 7 plugins. Backend packages have zero lint/format tooling. Prettier is configured at the root with `bracketSpacing: false`, `singleQuote: true`, `trailingComma: "all"`, `arrowParens: "avoid"`. VS Code is set to format-on-save with the Prettier extension.

## Goals / Non-Goals

**Goals:**
- Replace ESLint + Prettier with a single Biome config at the repo root
- Maintain equivalent lint rule coverage for React, hooks, a11y, TypeScript, and React Refresh
- Extend lint coverage to all backend packages
- Update VS Code settings for Biome formatter integration
- Provide root-level `lint`, `format`, and `check` scripts

**Non-Goals:**
- Enabling Biome's type-aware lint rules (requires tsconfig integration, deferred)
- Replacing other tools (knip, cSpell) — only ESLint and Prettier
- Changing any application logic or behavior
- Achieving pixel-identical formatting output vs Prettier (minor diffs are expected)

## Decisions

### 1. Single root `biome.json` (no per-package configs)

Biome supports `extends` for per-package overrides, but all three frontend packages already use identical ESLint configs, and backend packages need the same base rules. A single root config covers everything.

**Alternative**: Per-package `biome.json` files — rejected because there's no differentiation to warrant it.

### 2. Formatter settings mapping

| Prettier | Biome |
|---|---|
| `singleQuote: true` | `quoteStyle: "single"` |
| `trailingComma: "all"` | `trailingCommas: "all"` |
| `tabWidth: 2` | `indentWidth: 2` |
| `useTabs: false` | `indentStyle: "space"` |
| `bracketSpacing: false` | `bracketSpacing: false` |
| `arrowParens: "avoid"` | Not supported — Biome always uses parens |

The `arrowParens` difference is the only formatting change. This will produce a one-time diff across the codebase.

### 3. Lint rule mapping strategy

Enable Biome's `recommended` preset (covers JS + TS recommended rules), then configure React-specific rules:

- **React Hooks**: `useHookAtTopLevel` + `useExhaustiveDependencies` (both on by default in recommended)
- **a11y**: Biome `a11y` group `recommended` (covers jsx-a11y equivalents)
- **React Refresh**: `useComponentExportOnlyModules` (enabled manually, maps to `react-refresh/only-export-components`)
- **TypeScript**: `noUnusedVariables` (warn), `useImportType` (warn), `noExplicitAny` (off), `noNonNullAssertion` (off)
- **React**: `noUselessFragments` (warn)
- **Gap**: `react/self-closing-comp` has no Biome equivalent — accepted as a minor loss

### 4. VS Code integration

Replace `esbenp.prettier-vscode` with `biomejs.biome` as `editor.defaultFormatter`. Keep `editor.formatOnSave: true`. Add Biome extension to `.vscode/extensions.json` recommendations.

### 5. Script structure

Root `package.json` scripts:
- `"lint": "biome lint ."` — lint only
- `"format": "biome format --write ."` — format in-place
- `"format:check": "biome format ."` — check formatting (CI)
- `"check": "biome check --write ."` — lint + format in one pass

Per-package `format`/`format:check` scripts are removed (root scripts cover everything).

## Risks / Trade-offs

- **One-time formatting churn** → Mitigated by a dedicated reformat commit, separated from config changes. Use `git blame --ignore-rev` to skip it.
- **Team must install Biome VS Code extension** → Mitigated by adding to `.vscode/extensions.json` recommendations.
- **`react/self-closing-comp` lost** → Minor stylistic rule. Biome's formatter handles void HTML elements but not arbitrary JSX. Accepted as low-impact.
- **`arrowParens` always added** → Biome does not support `arrowParens: "avoid"`. This is a permanent style difference from the previous Prettier config. The added parens improve readability consistency.
