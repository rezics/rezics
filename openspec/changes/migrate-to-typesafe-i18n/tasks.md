## 1. Package Scaffold

- [ ] 1.1 Create `package/i18n/` directory with `package.json` (name: `@package/i18n`, `"sideEffects": false`, exports map, workspace dependency on `typesafe-i18n`), and `tsconfig.json` extending the root config
- [ ] 1.2 Add `typesafe-i18n` as a devDependency (generator) and dependency (runtime) in `package/i18n/package.json`. Add `@package/i18n` as a workspace dependency in `package/app`, `package/admin`, and `package/app-shell`
- [ ] 1.3 Create `.typesafe-i18n.json` in `package/i18n/` with config: adapter `react`, baseLocale `en-US`, outputPath `./src/i18n/`, outputFormat `TypeScript`, esmImports `true`
- [ ] 1.4 Add scripts to `package/i18n/package.json`: `"dev": "typesafe-i18n"` (watch mode), `"generate": "typesafe-i18n --no-watch"` (one-shot for CI)

## 2. Base Locale (en-US) — Split into Namespaces

- [ ] 2.1 Create `package/i18n/src/i18n/en-US/index.ts` with root-level keys only: `title`, `motto`, `layout.*`, `common.*`, `pages.*`
- [ ] 2.2 Create namespace files from the monolithic `en-US.ts`, one per feature domain: `home/index.ts`, `book/index.ts`, `book-edit/index.ts`, `readlist/index.ts`, `review/index.ts`, `quote/index.ts`, `comment/index.ts`, `search/index.ts`, `user/index.ts`, `engagement/index.ts`, `tag/index.ts`
- [ ] 2.3 Create `admin/index.ts` namespace by extracting admin-specific keys from `package/admin/src/locale/en-US.ts`
- [ ] 2.4 Convert i18next interpolation syntax (`{{var}}`) to typesafe-i18n syntax (`{var}`) and add type annotations to arguments where applicable (e.g., `{year:number}`, `{count:number}`)
- [ ] 2.5 Convert i18next pluralization patterns (`_one`/`_other` suffixes) to typesafe-i18n plural syntax (`{{singular|plural}}`)
- [ ] 2.6 Run the generator (`typesafe-i18n --no-watch`) to produce `i18n-types.ts`, `i18n-util.ts`, `i18n-util.async.ts`, `i18n-react.tsx`. Verify generated types compile cleanly

## 3. Derived Locales

- [ ] 3.1 Create `package/i18n/src/i18n/zh-SC/` with root `index.ts` and all namespace files, typed as `Translation` / namespace equivalents. Migrate content from `package/app/src/locale/zh-SC.ts` and `package/admin/src/locale/zh-SC.ts`
- [ ] 3.2 Repeat for `zh-TC/` — migrate from `package/app/src/locale/zh-TC.ts` and `package/admin/src/locale/zh-TC.ts`
- [ ] 3.3 Repeat for `de-DE/` — migrate from `package/app/src/locale/de-DE.ts` and `package/admin/src/locale/de-DE.ts`
- [ ] 3.4 Repeat for `ja-JP/` — migrate from `package/app/src/locale/ja-JP.ts` and `package/admin/src/locale/ja-JP.ts`
- [ ] 3.5 Run generator and verify all derived locales compile — TypeScript enforces key completeness against en-US base

## 4. Formatters and Custom Types

- [ ] 4.1 Create `package/i18n/src/i18n/formatters.ts` with formatters for patterns used in translations (e.g., number formatting for counts, date formatting if used)
- [ ] 4.2 Create `package/i18n/src/i18n/custom-types.ts` for any non-primitive argument types referenced in translations
- [ ] 4.3 Run generator again after formatters are defined, verify no type errors

## 5. Public API Surface

- [ ] 5.1 Create `package/i18n/src/index.ts` re-exporting: `TypesafeI18n` (provider), `useI18nContext` (hook), `loadLocaleAsync`, `loadNamespaceAsync`, `setLocale`, `getLocale`, `locales`, `isLocale`, type exports (`Locales`, `TranslationFunctions`, `Namespaces`)
- [ ] 5.2 Configure `package/i18n/package.json` exports field with entry points and types
- [ ] 5.3 Verify `@package/i18n` is importable from `package/app` and `package/admin` — run `tsc --noEmit` in both

## 6. Provider Integration

- [ ] 6.1 In `package/app/src/app/App.tsx`, replace i18next `initI18n()` with typesafe-i18n provider: load detected locale via `loadLocaleAsync()`, render `<TypesafeI18n locale={locale}>` wrapping the app tree
- [ ] 6.2 In `package/admin`, replace admin i18n initialization with the same `<TypesafeI18n>` provider pattern from `@package/i18n`
- [ ] 6.3 Update `package/app-shell` locale management: replace `i18n.changeLanguage()` calls with `setLocale()` + `loadLocaleAsync()`. Preserve localStorage persistence logic

## 7. Route Namespace Loading

- [ ] 7.1 Add `loadNamespaceAsync` calls in `beforeLoad` for the home route (`/`): namespaces `home`, `readlist`, `review`, `quote`, `search`
- [ ] 7.2 Add namespace loading for book routes (`/book/$bookId/*`): namespace `book`, plus `tag`, `quote`, `review` for the info tab
- [ ] 7.3 Add namespace loading for readlist routes: `readlist`, `comment`, `engagement`, `review`, `user`
- [ ] 7.4 Add namespace loading for review routes: `review`, `search`, `engagement`
- [ ] 7.5 Add namespace loading for remaining routes: `quote`, `comment`, `search`, `tag`, `user`, `book-edit`, `engagement` — each route loads only what it needs
- [ ] 7.6 Add namespace loading for admin routes: `admin` namespace, plus `user` for shared user management

## 8. Consumer Migration — App

- [ ] 8.1 Migrate `package/app/src/home/` components: replace `useTranslation()` → `useI18nContext()`, `t('page.home.x')` → `LL.home.x()`
- [ ] 8.2 Migrate `package/app/src/book-library/` components: `t('page.book.x')` → `LL.book.x()`
- [ ] 8.3 Migrate `package/app/src/book-edit/` components: `t('page.book_edit.x')` → `LL.bookEdit.x()`
- [ ] 8.4 Migrate `package/app/src/readlist/` components
- [ ] 8.5 Migrate `package/app/src/review/` components
- [ ] 8.6 Migrate `package/app/src/quote/` components
- [ ] 8.7 Migrate `package/app/src/comment/` components
- [ ] 8.8 Migrate `package/app/src/search/` components
- [ ] 8.9 Migrate `package/app/src/user/` components
- [ ] 8.10 Migrate `package/app/src/engagement/` components
- [ ] 8.11 Migrate `package/app/src/tag/` components
- [ ] 8.12 Migrate `package/app/src/core/` (layout, header, footer) — these use root namespace keys: `LL.layout.x()`
- [ ] 8.13 Migrate remaining feature directories (`feedback`, `preferences`, `inbox`, etc.)
- [ ] 8.14 Run `tsc --noEmit` in `package/app` to verify all migrations compile

## 9. Consumer Migration — Admin

- [ ] 9.1 Migrate all admin components from `useTranslation()` to `useI18nContext()` with `LL.admin.x()` and shared namespace accessors
- [ ] 9.2 Run `tsc --noEmit` in `package/admin` to verify

## 10. Cleanup

- [ ] 10.1 Remove `i18next` and `react-i18next` from `package/app/package.json`, `package/admin/package.json`, and `package/app-shell/package.json`
- [ ] 10.2 Delete `package/app/src/locale/` directory (all 5 locale files)
- [ ] 10.3 Delete `package/admin/src/locale/` directory (all 5 locale files)
- [ ] 10.4 Delete `package/app/src/app/provider/i18n.ts` (i18next init)
- [ ] 10.5 Delete `package/app/src/shared/types/i18next.d.ts` (i18next module augmentation)
- [ ] 10.6 Grep codebase for any remaining `i18next`, `useTranslation`, `react-i18next` references — verify zero results in application code
- [ ] 10.7 Run `tsc --noEmit` across all affected packages, run `bun run app:dev` to verify the app starts and translations render correctly
