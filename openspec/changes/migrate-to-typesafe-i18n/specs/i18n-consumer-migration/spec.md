## ADDED Requirements

### Requirement: Replace useTranslation with useI18nContext

All consumer components SHALL use `useI18nContext()` from `@package/i18n` instead of `useTranslation()` from `react-i18next`. The `LL` object returned by the context SHALL be used to access translations as typed function calls.

#### Scenario: Component accesses translation
- **WHEN** a component needs a translated string
- **THEN** it calls `const { LL } = useI18nContext()` and accesses keys via `LL.home.hero.title()` (for namespaced keys) or `LL.layout.header.toggle_language()` (for root keys)

#### Scenario: Translation with arguments
- **WHEN** a component needs an interpolated string (e.g., copyright with year)
- **THEN** it calls `LL.layout.footer.copyright({ year: 2026 })` and TypeScript enforces the argument type

### Requirement: Remove i18next dependencies

After all consumer components are migrated, the following SHALL be removed:
- `i18next` and `react-i18next` from `package/app`, `package/admin`, and `package/app-shell` dependencies
- `package/app/src/app/provider/i18n.ts` (i18next init)
- `package/app/src/shared/types/i18next.d.ts` (module augmentation)
- `package/app/src/locale/` directory (all 5 locale files)
- `package/admin/src/locale/` directory (all 5 locale files)

#### Scenario: No i18next references remain
- **WHEN** the migration is complete
- **THEN** searching the codebase for `i18next` or `useTranslation` yields zero results in application code

### Requirement: Provider replacement

The app and admin root components SHALL replace the i18next provider setup with the typesafe-i18n `<TypesafeI18n>` provider from `@package/i18n`.

#### Scenario: App root provider
- **WHEN** the app initializes
- **THEN** it loads the detected locale via `loadLocaleAsync(locale)`, then renders `<TypesafeI18n locale={locale}>` wrapping the app tree

#### Scenario: Locale switching triggers re-render
- **WHEN** the user changes locale via `setLocale(newLocale)`
- **THEN** all components consuming `useI18nContext()` re-render with the new translations

### Requirement: app-shell locale integration

`package/app-shell` SHALL update its locale management to use the new i18n API. Language persistence in localStorage SHALL continue to work as before.

#### Scenario: Language restored from storage
- **WHEN** the app starts and localStorage contains a saved locale preference
- **THEN** `loadLocaleAsync` is called with the stored locale and the UI renders in that language

#### Scenario: Language change persisted
- **WHEN** the user switches language
- **THEN** the new locale is persisted to localStorage and `setLocale()` + `loadLocaleAsync()` are called
