## Why

The current i18n setup uses i18next with monolithic per-language TypeScript files that are all eagerly imported at startup. This means every user loads all 5 languages (~85KB of translation data) regardless of their locale, and there is no way to split translations by feature. Both `package/app` and `package/admin` maintain separate duplicate locale directories with their own init logic. Migrating to typesafe-i18n provides native TypeScript-first type safety (generated from the base locale rather than bolt-on module augmentation), a lightweight runtime (~1KB vs ~40KB), built-in lazy loading via dynamic imports, and namespace-based feature splitting — all of which align with the project's aggressive tree-shaking configuration.

## What Changes

- **New `@package/i18n` package**: Standalone shared package housing all translations, the typesafe-i18n generator output, formatters, and the React adapter.
- **Feature-based namespace splitting**: The current monolithic locale files are split into ~12 namespaces aligned with feature boundaries (home, book, readlist, review, quote, comment, search, user, tag, engagement, book-edit, admin). Root namespace contains only layout chrome and universal strings.
- **Lazy locale loading**: Only the active language is loaded at startup via dynamic `import()`. Switching languages loads the new locale on demand.
- **Namespace loading in route loaders**: Each TanStack Router route loads only the namespaces it needs via `Promise.all` in `beforeLoad`, enabling per-route translation code splitting.
- **Remove i18next**: Remove `i18next` and `react-i18next` dependencies from `package/app`, `package/admin`, and `package/app-shell`.
- **Remove duplicate locale directories**: `package/app/src/locale/` and `package/admin/src/locale/` are consolidated into `@package/i18n`.
- **BREAKING**: All `useTranslation()` call sites (~71 files in app, plus admin) must migrate to `useI18nContext()` with the new `LL` accessor pattern.

## Capabilities

### New Capabilities

- `i18n-package`: Standalone `@package/i18n` package with typesafe-i18n generator, feature-based namespaces, lazy locale loading, and React adapter.
- `i18n-route-loading`: Integration pattern for loading translation namespaces in TanStack Router route loaders.
- `i18n-consumer-migration`: Migration of all `useTranslation()` call sites in app and admin to the new `useI18nContext()` + `LL` pattern.

### Modified Capabilities

_(none — no existing spec-level requirements are changing)_

## Impact

- **Affected packages**: `package/app`, `package/admin`, `package/app-shell`, new `package/i18n`
- **Dependencies added**: `typesafe-i18n` (runtime + generator)
- **Dependencies removed**: `i18next`, `react-i18next` (from app, admin, app-shell)
- **~71 files in app** and admin files using `useTranslation()` must be updated
- **Type declaration file** `package/app/src/shared/types/i18next.d.ts` is removed
- **Build pipeline**: typesafe-i18n generator must run in watch mode during development and once during CI
- **No backend impact**: Server packages do not use i18n
