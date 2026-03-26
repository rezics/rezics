## ADDED Requirements

### Requirement: Standalone i18n package

The system SHALL provide a standalone `@package/i18n` workspace package that contains all translation content, the typesafe-i18n generator configuration, generated type utilities, and the React adapter.

#### Scenario: Package is consumable by app and admin
- **WHEN** `package/app` or `package/admin` adds `@package/i18n` as a workspace dependency
- **THEN** it can import the React provider, locale loading functions, and typed translation accessors from `@package/i18n`

#### Scenario: Package builds without errors
- **WHEN** `typesafe-i18n --no-watch` is run in `package/i18n`
- **THEN** all type files are generated successfully and `tsc` compiles without errors

### Requirement: Base locale with generated types

The system SHALL use `en-US` as the typesafe-i18n base locale. All translation types SHALL be generated from the base locale file. Derived locales (`zh-SC`, `zh-TC`, `de-DE`, `ja-JP`) SHALL be typed against the base locale, ensuring compile-time enforcement of key completeness.

#### Scenario: Missing key in derived locale
- **WHEN** a derived locale file (e.g., `zh-SC/index.ts`) omits a key that exists in `en-US/index.ts`
- **THEN** TypeScript SHALL report a compile error

#### Scenario: Extra key in derived locale
- **WHEN** a derived locale file includes a key not present in the base locale
- **THEN** TypeScript SHALL report a compile error

### Requirement: Feature-based namespace splitting

Translations SHALL be organized into feature-aligned namespaces as subdirectories under each locale. The root namespace SHALL contain only layout chrome and universally shared strings. Each feature namespace SHALL map to an existing feature domain.

Required namespaces:
- *(root)*: `title`, `motto`, `layout.*`, `common.*`
- `home`, `book`, `book-edit`, `readlist`, `review`, `quote`, `comment`, `search`, `user`, `engagement`, `tag`, `admin`

#### Scenario: Namespace files exist for all locales
- **WHEN** the generator runs
- **THEN** every locale directory SHALL contain the same set of namespace subdirectories, each with an `index.ts` file

#### Scenario: Root namespace is minimal
- **WHEN** inspecting the root `index.ts` of any locale
- **THEN** it SHALL contain only layout, common, and app-level keys — no feature-specific translations

### Requirement: Lazy locale loading

The system SHALL load only the active locale at startup. Other locales SHALL NOT be included in the initial bundle. Switching locales at runtime SHALL dynamically import the target locale.

#### Scenario: Initial page load
- **WHEN** the app starts with locale set to `zh-SC`
- **THEN** only the `zh-SC` locale chunks are fetched — `en-US`, `de-DE`, `ja-JP`, `zh-TC` chunks are NOT loaded

#### Scenario: Language switch
- **WHEN** the user changes language from `zh-SC` to `en-US`
- **THEN** the `en-US` locale is loaded via dynamic import and the UI re-renders with English translations

### Requirement: Formatters

The system SHALL provide formatters for any interpolation patterns used in translations (e.g., date formatting, number formatting). Formatters SHALL be defined in the user-editable `formatters.ts` file.

#### Scenario: Interpolation with year
- **WHEN** a translation contains `{year}` (e.g., copyright string)
- **THEN** the formatter resolves the argument and the rendered string includes the provided year value

### Requirement: Package exports

The `@package/i18n` package.json SHALL declare exports that allow consumers to import the public API. The package SHALL set `"sideEffects": false` to enable tree-shaking.

#### Scenario: Consumer imports provider
- **WHEN** a consumer imports `{ TypesafeI18n, useI18nContext }` from `@package/i18n`
- **THEN** the imports resolve correctly and are fully typed

#### Scenario: Unused namespaces are excluded
- **WHEN** admin imports `@package/i18n` but never calls `loadNamespaceAsync(locale, 'home')`
- **THEN** the `home` namespace chunks for all locales are excluded from the admin build output
